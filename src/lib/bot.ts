import { db } from "@/db";
import { diagnoses, news, pharmacies, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { aiDiagnose, transcribeAudio } from "@/lib/ai";
import { getWeatherAdvice, resolvePlace } from "@/lib/geo";
import { ensureSeed } from "@/lib/seed";

const API = () => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

// --- Telegram API yordamchilari ---

type Chat = { id: number };
type TgUser = { id: number; first_name?: string; last_name?: string; username?: string };
type PhotoSize = { file_id: string; width: number; height: number };
type Message = {
  message_id: number;
  chat: Chat;
  from?: TgUser;
  text?: string;
  caption?: string;
  photo?: PhotoSize[];
  voice?: { file_id: string; mime_type?: string };
  audio?: { file_id: string; mime_type?: string };
  location?: { latitude: number; longitude: number };
};
type CallbackQuery = { id: string; from: TgUser; data?: string; message?: { chat: Chat } };
export type TgUpdate = {
  update_id: number;
  message?: Message;
  callback_query?: CallbackQuery;
};

type InlineKeyboard = { text: string; callback_data: string }[][];

const MAIN_KEYBOARD: InlineKeyboard = [
  [
    { text: "🌿 Ekin tashxis", callback_data: "diag:crop" },
    { text: "🐄 Hayvon tashxis", callback_data: "diag:animal" },
  ],
  [
    { text: "💊 Dorixona", callback_data: "pharma:all" },
    { text: "🌤 Ob-havo", callback_data: "weather:loc" },
  ],
  [
    { text: "📰 Yangiliklar", callback_data: "news:list" },
    { text: "👤 Profil", callback_data: "me:info" },
  ],
];

async function callApi(method: string, payload: Record<string, unknown>) {
  try {
    const res = await fetch(`${API()}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
    return (await res.json()) as { ok: boolean; result?: { message_id?: number } };
  } catch {
    return { ok: false };
  }
}

function sendMessage(chatId: number, text: string, keyboard?: InlineKeyboard) {
  return callApi("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: keyboard
      ? { inline_keyboard: keyboard }
      : { inline_keyboard: MAIN_KEYBOARD },
  });
}

function sendVenue(
  chatId: number,
  lat: number,
  lng: number,
  title: string,
  address: string,
) {
  return callApi("sendVenue", { chat_id: chatId, latitude: lat, longitude: lng, title, address });
}

function answerCallback(cbId: string, text?: string) {
  return callApi("answerCallbackQuery", { callback_query_id: cbId, text });
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function setChatAction(chatId: number, action: "typing" | "upload_photo" | "record_voice") {
  return callApi("sendChatAction", { chat_id: chatId, action });
}

// --- Tashxis sessiyasi (bir necha xabarni ketma-ket yuborish uchun) ---

const diagSession = new Map<number, "crop" | "animal">();

// --- Yordamchi: kategoriyani matndan aniqlash ---

const CROP_KEYS = ["bug'doy", "bugdoy", "sholi", "paxta", "kartoshka", "pomidor", "bodring", "uzum", "olma", "o'simlik", "ekin", "barg", "dalа", "dala", "non", "g'alla", "makkajo'xori", "sabzavot", "meva"];
const ANIMAL_KEYS = ["mol", "qoy", "echki", "tovuq", "murqa", "murg'ob", "kon", "ot", "tuya", "sigir", "buqa", "cho'chqa", "hayvon", "chorva", "parranda", "yelin", "sut", "jun", "boqiy", "vet"];

function detectCategory(text: string): "crop" | "animal" | null {
  const t = (text || "").toLowerCase();
  const crop = CROP_KEYS.some((k) => t.includes(k));
  const animal = ANIMAL_KEYS.some((k) => t.includes(k));
  if (crop && !animal) return "crop";
  if (animal && !crop) return "animal";
  return null;
}

// --- AI so'rovlar ---

type DiagResult = Awaited<ReturnType<typeof aiDiagnose>>;

async function diagnoseFromImage(category: "crop" | "animal", caption: string, fileId: string): Promise<DiagResult> {
  const file = await getFilePath(fileId);
  if (!file) return aiDiagnose({ category, text: caption });
  const imageUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
  const blob = await fetchBlob(imageUrl);
  const dataUrl = blob
    ? `data:image/jpeg;base64,${Buffer.from(await blob.arrayBuffer()).toString("base64")}`
    : null;
  return aiDiagnose({ category, text: caption, imageDataUrl: dataUrl });
}

async function diagnoseFromVoice(category: "crop" | "animal", fileId: string): Promise<DiagResult> {
  const file = await getFilePath(fileId);
  if (!file) return aiDiagnose({ category, text: "" });
  const blob = await fetchBlob(`https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`);
  if (!blob) return aiDiagnose({ category, text: "" });
  const text = await transcribeAudio(blob);
  if (!text) {
    return {
      disease: "Ovozni tushunmadim",
      solution: "Iltimos, muammoni qisqacha matn ko'rinishida yozing yoki rasmini yuboring.",
      medicines: [],
      severity: "past",
      prevention: "",
      source: "offline",
    };
  }
  return aiDiagnose({ category, text });
}

async function getFilePath(fileId: string): Promise<{ file_path: string } | null> {
  try {
    const res = await fetch(`${API()}/getFile?file_id=${encodeURIComponent(fileId)}`, {
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await res.json()) as { ok: boolean; result?: { file_path: string } };
    return json.ok && json.result ? { file_path: json.result.file_path } : null;
  } catch {
    return null;
  }
}

async function fetchBlob(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    return res.ok ? await res.blob() : null;
  } catch {
    return null;
  }
}

// --- Tashxis natijasi xabari ---

const SEVERITY_EMOJI: Record<string, string> = {
  past: "🟢",
  orta: "🟡",
  yuqori: "🔴",
};

function diagnosisMessage(r: DiagResult): string {
  const sev = SEVERITY_EMOJI[r.severity] ?? "🟡";
  const lines = [
    `${sev} <b>${escapeHtml(r.disease)}</b>`,
    "",
    `🩺 <b>Nima qilish kerak:</b>`,
    escapeHtml(r.solution),
  ];
  if (r.medicines.length > 0) {
    lines.push("", `💊 <b>Dorilar:</b> ${r.medicines.map(escapeHtml).join(", ")}`);
  }
  if (r.prevention) {
    lines.push("", `🛡 <b>Oldini olish:</b> ${escapeHtml(r.prevention)}`);
  }
  lines.push("", `📍 <i>Manba: ${r.source === "ai" ? "AI tahlil" : "offline ma'lumotlar bazasi"}</i>`);
  lines.push("💊 Dorixonani topish uchun «Dorixona» tugmasini bosing.");
  return lines.join("\n");
}

async function saveDiagnosis(userId: number | null, category: "crop" | "animal", text: string, hasImage: boolean, r: DiagResult) {
  await db.insert(diagnoses).values({
    userId,
    category,
    inputText: text || null,
    hasImage,
    diseaseName: r.disease,
    solution: [r.solution, r.prevention ? `Oldini olish: ${r.prevention}` : ""].filter(Boolean).join("\n\n"),
    medicines: JSON.stringify(r.medicines),
    severity: r.severity,
    source: r.source,
  });
}

async function ensureUser(from: TgUser): Promise<number | null> {
  const tgId = from.id;
  const name = [from.first_name, from.last_name].filter(Boolean).join(" ") || null;
  const existing = await db.select().from(users).where(eq(users.telegramId, tgId)).limit(1);
  if (existing.length > 0) {
    if (name && existing[0].name !== name) {
      await db.update(users).set({ name }).where(eq(users.id, existing[0].id));
    }
    return existing[0].id;
  }
  const inserted = await db
    .insert(users)
    .values({ telegramId: tgId, name })
    .returning({ id: users.id });
  return inserted[0]?.id ?? null;
}

// --- Xizmatlar ---

async function handleDiagnosis(m: Message, category: "crop" | "animal", text: string, hasImage: boolean, fileId?: string) {
  const chatId = m.chat.id;
  await setChatAction(chatId, hasImage ? "upload_photo" : "typing");
  let result: DiagResult;
  if (fileId && m.photo) {
    result = await diagnoseFromImage(category, text, fileId);
  } else if (fileId && (m.voice || m.audio)) {
    result = await diagnoseFromVoice(category, fileId);
  } else {
    result = await aiDiagnose({ category, text });
  }
  const user = m.from ? await ensureUser(m.from) : null;
  await saveDiagnosis(user, category, text, hasImage, result);
  diagSession.delete(chatId);
  await sendMessage(chatId, diagnosisMessage(result));
}

async function handlePharmacies(chatId: number, lat: number, lng: number, kind: string) {
  await setChatAction(chatId, "typing");
  await ensureSeed();
  const all = await db.select().from(pharmacies);
  const filtered = kind === "all" ? all : all.filter((p) => p.kind === kind);
  const R = 6371;
  const dist = (aLat: number, aLng: number, bLat: number, bLng: number) => {
    const dLat = ((bLat - aLat) * Math.PI) / 180;
    const dLng = ((bLng - aLng) * Math.PI) / 180;
    const s =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  };
  const nearest = filtered
    .map((p) => ({ p, km: dist(lat, lng, p.lat, p.lng) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, 5);

  if (nearest.length === 0) {
    await sendMessage(chatId, "😔 Yaqin atrofda dorixona topilmadi.");
    return;
  }
  await sendMessage(chatId, `💊 <b>Eng yaqin ${nearest.length} ta nuqta:</b>`);
  for (const { p, km } of nearest) {
    const kindIcon = p.kind === "vet" ? "🐾" : "🌿";
    const text = [
      `${kindIcon} <b>${escapeHtml(p.name)}</b>`,
      `📍 ${escapeHtml(p.address)} (${km.toFixed(1)} km)`,
      `📞 ${escapeHtml(p.phone)}`,
      p.workHours ? `🕒 ${escapeHtml(p.workHours)}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    await sendMessage(chatId, text);
    await sendVenue(chatId, p.lat, p.lng, p.name, p.address);
  }
}

async function handleWeather(chatId: number, lat: number, lng: number) {
  await setChatAction(chatId, "typing");
  const [w, place] = await Promise.all([getWeatherAdvice(lat, lng), resolvePlace(lat, lng)]);
  const levelEmoji: Record<string, string> = { ok: "✅", caution: "⚠️", warning: "🚠", danger: "🚫" };
  const text = [
    `🌤 <b>Ob-havo — ${escapeHtml(place.region)}${place.district ? `, ${escapeHtml(place.district)}` : ""}</b>`,
    "",
    `🌡 Harorat: <b>${w.temp}°C</b>`,
    `💧 Namlik: ${w.humidity}%`,
    `💨 Shamol: ${w.wind} m/s`,
    `🌧 Yomg'ir: ${w.rain} mm`,
    "",
    `${levelEmoji[w.level] ?? "•"} ${escapeHtml(w.advice)}`,
  ].join("\n");
  await sendMessage(chatId, text);
}

async function handleNews(chatId: number) {
  await setChatAction(chatId, "typing");
  await ensureSeed();
  const rows = await db.select().from(news).orderBy(desc(news.id)).limit(5);
  if (rows.length === 0) {
    await sendMessage(chatId, "📰 Hozircha yangiliklar yo'q.");
    return;
  }
  const text = [
    "📰 <b>Oxirgi yangiliklar:</b>",
    "",
    ...rows.map(
      (n) =>
        `${escapeHtml(n.tag ?? "Umumiy")}: <b>${escapeHtml(n.title)}</b>\n${escapeHtml(n.body).slice(0, 160)}...`,
    ),
  ].join("\n\n");
  await sendMessage(chatId, text);
}

async function handleProfile(chatId: number, from: TgUser) {
  const userId = await ensureUser(from);
  if (!userId) {
    await sendMessage(chatId, "❌ Profil topilmadi. /start ni bosing.");
    return;
  }
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const u = rows[0];
  const diagCount = await db.select({ id: diagnoses.id }).from(diagnoses).where(eq(diagnoses.userId, userId));
  const recent = await db
    .select()
    .from(diagnoses)
    .where(eq(diagnoses.userId, userId))
    .orderBy(desc(diagnoses.id))
    .limit(3);
  const text = [
    "👤 <b>Profilingiz</b>",
    "",
    `📛 Ism: ${escapeHtml(u?.name ?? from.first_name ?? "Noma'lum")}`,
    u?.region ? `🗺 Viloyat: ${escapeHtml(u.region)}` : "",
    u?.district ? `📍 Tuman: ${escapeHtml(u.district)}` : "",
    `🆔 Telegram ID: <code>${from.id}</code>`,
    `🩺 Tashxislar soni: ${diagCount.length}`,
    recent.length > 0
      ? "\n<b>Oxirgi tashxislar:</b>\n" +
        recent.map((d) => `• ${escapeHtml(d.diseaseName)}`).join("\n")
      : "",
  ]
    .filter(Boolean)
    .join("\n");
  await sendMessage(chatId, text);
}

// --- Asosiy handler ---

const HELP_TEXT = [
  "🌾 <b>AgroVet AI — buyruqlar</b>",
  "",
  "🌿 <b>Ekin tashxis</b> — rasm yoki matn yuboring (kasallik aniqlanadi)",
  "🐄 <b>Hayvon tashxis</b> — rasm, ovoz yoki matn yuboring",
  "💊 <b>Dorixona</b> — joylashuvni yuboring, eng yaqin nuqtalar chiqadi",
  "🌤 <b>Ob-havo</b> — joylashuv bo'yicha purkash maslahati",
  "📰 <b>Yangiliklar</b> — so'nggi 5 xabar",
  "👤 <b>Profil</b> — shaxsiy ma'lumot va tarix",
  "",
  "<i>Maslahat: aniq rasm + qisqa matn (masalan «kartoshka bargi qarayapti») eng yaxshi natija beradi.</i>",
].join("\n");

const WELCOME_TEXT = [
  "👋 <b>AgroVet AI'ga xush kelibsiz!</b>",
  "",
  "Men dehqon va chorvador yordamchisiman:",
  "🌿 Ekin kasalliklarini rasm bo'yicha aniqlayman",
  "🐄 Chorva kasalliklariga tashxis qo'yaman",
  "💊 Yaqin agro/vet dorixonalarni topaman",
  "🌤 Purkash uchun ob-havo maslahati beraman",
  "📰 Agro yangiliklarni yetkazaman",
  "",
  "Quyidagi tugmalardan foydalaning 👇",
].join("\n");

async function handleMessage(m: Message) {
  const chatId = m.chat.id;
  const session = diagSession.get(chatId);

  // Joylashuv
  if (m.location) {
    if (session) {
      // Tashxis sessiyasi davomida joylashuv kelib qolsa, dorixona sifatida ko'ramiz.
      await handlePharmacies(chatId, m.location.latitude, m.location.longitude, "all");
      return;
    }
    const detected = await detectOrAskKindForLocation(m);
    void detected;
    return;
  }

  // Rasm
  if (m.photo && m.photo.length > 0) {
    const fileId = m.photo[m.photo.length - 1].file_id;
    const caption = m.caption?.trim() || "";
    const category = session ?? detectCategory(caption) ?? "crop";
    await handleDiagnosis(m, category, caption, true, fileId);
    return;
  }

  // Ovoz
  if (m.voice || m.audio) {
    const fileId = m.voice?.file_id ?? m.audio?.file_id ?? "";
    const category = session ?? "crop";
    await handleDiagnosis(m, category, "", false, fileId);
    return;
  }

  // Matn
  const text = m.text?.trim() ?? "";
  if (!text) return;

  if (text.startsWith("/start")) {
    if (m.from) await ensureUser(m.from);
    await sendMessage(chatId, WELCOME_TEXT);
    return;
  }
  if (text.startsWith("/help")) {
    await sendMessage(chatId, HELP_TEXT);
    return;
  }

  if (session) {
    await handleDiagnosis(m, session, text, false);
    return;
  }

  // Sessiya yo'q: matndan kategoriyani taxmin qilamiz.
  const category = detectCategory(text);
  await handleDiagnosis(m, category ?? "crop", text, false);
}

async function detectOrAskKindForLocation(m: Message): Promise<void> {
  const chatId = m.chat.id;
  if (!m.location) return;
  const place = await resolvePlace(m.location.latitude, m.location.longitude);
  const keyboard: InlineKeyboard = [
    [
      { text: "🌿 Hamma nuqtalar", callback_data: `pharma:geo:${m.location.latitude},${m.location.longitude}` },
      { text: "🐾 Vet", callback_data: `pharma:geo:${m.location.latitude},${m.location.longitude}:vet` },
    ],
  ];
  await sendMessage(
    chatId,
    `📍 <b>${escapeHtml(place.region)}${place.district ? `, ${escapeHtml(place.district)}` : ""}</b>\nQaysi turdagi dorixonalarni ko'rasiz?`,
    keyboard,
  );
}

async function handleCallback(cb: CallbackQuery) {
  const data = cb.data ?? "";
  const chatId = cb.message?.chat.id ?? cb.from.id;

  if (data === "diag:crop" || data === "diag:animal") {
    diagSession.set(chatId, data === "diag:crop" ? "crop" : "animal");
    await answerCallback(cb.id);
    await sendMessage(
      chatId,
      data === "diag:crop"
        ? "🌿 <b>Ekin tashxis</b>\n\nRasm yuboring (yoki ovoz/matn). Masalan: «bug'doy bargi sariq dog'lar chiqyapti»"
        : "🐄 <b>Hayvon tashxis</b>\n\nRasm, ovoz yoki matn yuboring. Masalan: «sigirim yelinini shishib qoldi»",
    );
    return;
  }

  if (data === "pharma:all" || data === "pharma:agro" || data === "pharma:vet") {
    await answerCallback(cb.id);
    const kind = data === "pharma:all" ? "all" : data === "pharma:agro" ? "agro" : "vet";
    await callApi("sendMessage", {
      chat_id: chatId,
      text: "💊 Eng yaqin dorixonalar uchun joylashuvingizni yuboring 📍",
      reply_markup: {
        keyboard: [[{ text: "📍 Joylashuvni yuborish", request_location: true }]],
        one_time_keyboard: true,
        resize_keyboard: true,
      },
    });
    lastPharmaKind.set(chatId, kind);
    return;
  }

  if (data.startsWith("pharma:geo:")) {
    await answerCallback(cb.id);
    const parts = data.split(":");
    const [latStr, lngStr] = (parts[2] ?? "").split(",");
    const kind = parts[3] ?? "all";
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      await handlePharmacies(chatId, lat, lng, kind);
    }
    return;
  }

  if (data === "weather:loc") {
    await answerCallback(cb.id);
    await callApi("sendMessage", {
      chat_id: chatId,
      text: "🌤 Ob-havo uchun joylashuvingizni yuboring 📍",
      reply_markup: {
        keyboard: [[{ text: "📍 Joylashuvni yuborish", request_location: true }]],
        one_time_keyboard: true,
        resize_keyboard: true,
      },
    });
    lastWeatherMode.add(chatId);
    return;
  }

  if (data === "news:list") {
    await answerCallback(cb.id);
    await handleNews(chatId);
    return;
  }

  if (data === "me:info") {
    await answerCallback(cb.id);
    await handleProfile(chatId, cb.from);
    return;
  }

  await answerCallback(cb.id);
}

// Joylashuv keldi: dorixona yoki ob-havo rejimini aniqlash uchun vaqtincha xotira.
const lastPharmaKind = new Map<number, string>();
const lastWeatherMode = new Set<number>();

export async function handleTelegramUpdate(update: TgUpdate): Promise<void> {
  if (update.callback_query) {
    await handleCallback(update.callback_query);
    return;
  }
  const m = update.message;
  if (!m) return;
  const chatId = m.chat.id;

  // Joylashuv: rejim xotirasiga qarab dorixona yoki ob-havo.
  if (m.location) {
    const isWeather = lastWeatherMode.delete(chatId);
    const kind = lastPharmaKind.get(chatId);
    lastPharmaKind.delete(chatId);
    if (isWeather) {
      await handleWeather(chatId, m.location.latitude, m.location.longitude);
    } else if (kind) {
      await handlePharmacies(chatId, m.location.latitude, m.location.longitude, kind);
    } else {
      await detectOrAskKindForLocation(m);
    }
    return;
  }

  lastWeatherMode.delete(chatId);

  await handleMessage(m);
}
