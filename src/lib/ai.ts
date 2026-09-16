import OpenAI from "openai";

export const SYSTEM_PROMPT = `Sen O'zbekistondagi tajribali agro-konsultant va veterinarsan. Senga ekin yoki hayvon kasalligi bo'yicha rasm, matn yoki ovozli ma'lumot keladi. Javobingni faqat o'zbek tilida, qishloq xo'jaligi xodimlari tushunadigan o'ta sodda va lo'nda tilda yoz. Murakkab ilmiy terminlarni ishlatma.
Javobni QAT'IY JSON formatida qaytar:
{"disease":"Kasallik nomi","solution":"Qisqa yechim, 2-4 ta qadam","medicines":["dori1","dori2"],"severity":"past|orta|yuqori","prevention":"Kelgusida oldini olish uchun 1-2 jumla"}
Dorilar faqat O'zbekiston bozorida topiladigan nomlar bo'lsin.`;

export type DiagnosisResult = {
  disease: string;
  solution: string;
  medicines: string[];
  severity: string;
  prevention: string;
  source: "ai" | "offline";
};

type OfflineCase = {
  keys: string[];
  disease: string;
  solution: string;
  medicines: string[];
  severity: string;
  prevention: string;
};

const CROP_CASES: OfflineCase[] = [
  {
    keys: ["sariq", "dog", "zang", "bug'doy", "bugdoy"],
    disease: "Sariq zang (bug'doy zangi)",
    solution:
      "1. Kasallangan barglarni tekshiring. 2. Fungitsid bilan purkang (ertalab yoki kechqurun). 3. 10-12 kundan keyin purkashni takrorlang. 4. Azotli o'g'itni kamaytiring.",
    medicines: ["Topaz", "Oltingugurt (kolloid)", "Mis kuporosi (Bordo suyuqligi)"],
    severity: "yuqori",
    prevention: "Chidamli navlarni eking va ekin almashlab ekishga rioya qiling.",
  },
  {
    keys: ["qora", "chiriy", "fitoftor", "kartoshka", "pomidor"],
    disease: "Fitoftoroz (qora chirish)",
    solution:
      "1. Kasal barg va mevalarni yig'ib, dalaga tashlamang. 2. Ridomil Gold bilan purkang. 3. Sug'orishni kamaytiring, tomchilatib suging. 4. 10 kundan so'ng takrorlang.",
    medicines: ["Ridomil Gold", "Mis kuporosi (Bordo suyuqligi)", "Fitosporin-M"],
    severity: "yuqori",
    prevention: "Qator oralig'ini kengaytiring, kechqurun sug'ormang.",
  },
  {
    keys: ["shira", "bit", "qurt", "kapalak", "zararkunanda", "tripls", "trips"],
    disease: "Shira (o'simlik biti) zarari",
    solution:
      "1. Barg ostini tekshiring. 2. Aktara yoki Karate Zeon bilan purkang. 3. Shamolsiz kunda, ertalab purkang. 4. 7 kundan keyin takrorlang.",
    medicines: ["Aktara", "Karate Zeon", "Konfidor"],
    severity: "orta",
    prevention: "Begona o'tlarni yulib tashlang, foydali hasharotlarni saqlang.",
  },
  {
    keys: ["oq", "kul", "un", "shudring", "uzum", "mildyu"],
    disease: "Un-shudring (oq kukun kasalligi)",
    solution:
      "1. Zararlangan barglarni kesib oling. 2. Oltingugurt yoki Topaz bilan purkang. 3. Havo aylanishi uchun butang. 4. 2 hafta ichida 2 marta purkang.",
    medicines: ["Oltingugurt (kolloid)", "Topaz", "Mis kuporosi (Bordo suyuqligi)"],
    severity: "orta",
    prevention: "Quyuq eklishdan saqlaning, muntazam butash qiling.",
  },
  {
    keys: ["ildiz", "so'lish", "solish", "quriy", "so'lib"],
    disease: "Ildiz chirishi (so'lish)",
    solution:
      "1. Sug'orishni to'xtating, tuproqni quriting. 2. Kasal tupni yulib olib yo'q qiling. 3. Fitosporin-M eritmasi bilan tup tagini suging. 4. Tuproqni yumshating.",
    medicines: ["Fitosporin-M", "Mis kuporosi (Bordo suyuqligi)"],
    severity: "orta",
    prevention: "Ortiqcha sug'ormang, drenajni yaxshilang.",
  },
];

const ANIMAL_CASES: OfflineCase[] = [
  {
    keys: ["yo'tal", "yotal", "nafas", "isitma", "shamol", "pnevmon", "o'pka"],
    disease: "O'pka shamollashi (pnevmoniya)",
    solution:
      "1. Hayvonni iliq, shamol tegmaydigan joyga oling. 2. Nitoks 200 yoki Okstetratsiklin ni vet ko'rsatmasi bo'yicha uring. 3. Ko'p iliq suv bering. 4. 3 kun ichida yaxshilanmasa veterinarni chaqiring.",
    medicines: ["Nitoks 200", "Okstetratsiklin 200 LA", "Vitam (vitamin kompleksi)"],
    severity: "yuqori",
    prevention: "Molxonani shamoldan to'sing, nam somonni almashtiring.",
  },
  {
    keys: ["sut", "yelin", "mastit", "shishgan", "qon"],
    disease: "Mastit (yelin yallig'lanishi)",
    solution:
      "1. Yelinni iliq suv bilan yuvib, to'liq sog'ib tashlang. 2. Mastimetrin ni yelin kanaliga yuboring. 3. 3-5 kun davolang, sutni ichmang. 4. Sog'ishni kuniga 4 marta qiling.",
    medicines: ["Mastimetrin", "Okstetratsiklin 200 LA"],
    severity: "yuqori",
    prevention: "Sog'ishdan oldin yelinni yuving, to'shakni toza saqlang.",
  },
  {
    keys: ["ich", "ketish", "diareya", "suyuq", "qorin"],
    disease: "Ich ketishi (diareya)",
    solution:
      "1. 12 soat yem bermang, faqat suv va tuz-shakar eritmasi bering. 2. Gijjaga tekshiring. 3. Okstetratsiklin bering. 4. Suvsizlanish bo'lsa tomir orqali eritma quying.",
    medicines: ["Okstetratsiklin 200 LA", "Albendazol 10%", "Vitam (vitamin kompleksi)"],
    severity: "orta",
    prevention: "Toza suv bering, buzilgan yemni bermang.",
  },
  {
    keys: ["qo'tir", "qotir", "teri", "kana", "junsiz", "qichish", "parazit", "gijja"],
    disease: "Teri paraziti (qo'tir) yoki gijja",
    solution:
      "1. Ivermektin 1% ni teri ostiga yuboring. 2. Molxonani dezinfeksiya qiling. 3. 14 kundan keyin takrorlang. 4. Kasal hayvonni ajratib boqing.",
    medicines: ["Ivermektin 1%", "Albendazol 10%"],
    severity: "orta",
    prevention: "Har 3 oyda profilaktik dehelmintizatsiya o'tkazing.",
  },
  {
    keys: ["yiqil", "turolmay", "tug'ruq", "tugruq", "parez", "titray"],
    disease: "Tug'ruqdan keyingi parez (kalsiy yetishmovchiligi)",
    solution:
      "1. Zudlik bilan Kalsiy borglyukonat ni tomirga sekin yuboring. 2. Hayvonni to'shakka yotqizing. 3. Vet shifokorni chaqiring. 4. Yemga bo'r va mineral qo'shing.",
    medicines: ["Kalsiy borglyukonat", "Vitam (vitamin kompleksi)"],
    severity: "yuqori",
    prevention: "Tug'ruq oldidan mineral-vitamin qo'shimchalari bering.",
  },
];

export function offlineDiagnose(category: "crop" | "animal", text: string): DiagnosisResult {
  const cases = category === "crop" ? CROP_CASES : ANIMAL_CASES;
  const t = (text || "").toLowerCase();
  let best: OfflineCase | null = null;
  let bestScore = 0;
  for (const c of cases) {
    const score = c.keys.reduce((acc, k) => (t.includes(k) ? acc + 1 : acc), 0);
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  const chosen = best ?? cases[0];
  return {
    disease: chosen.disease + (bestScore === 0 ? " (ehtimoliy)" : ""),
    solution: chosen.solution,
    medicines: chosen.medicines,
    severity: chosen.severity,
    prevention: chosen.prevention,
    source: "offline",
  };
}

// --- OpenAI-compatible client (OpenAI, Gemini, Groq, vLLM, va h.k.) ---
// Tashxis (chat/vision) OPENAI_* envlardan, ovoz (STT) esa STT_* envlardan
// o'qiydi; STT_* berilmagan bo'lsa OPENAI_* ga tushadi.
const clientCache = new Map<string, OpenAI>();

function makeClient(name: string, key: string | undefined, baseUrl: string | undefined): OpenAI | null {
  const trimmed = key?.trim();
  if (!trimmed) return null;
  const cached = clientCache.get(name);
  if (cached) return cached;
  const client = new OpenAI({
    apiKey: trimmed,
    baseURL: baseUrl?.trim() ? baseUrl.trim().replace(/\/$/, "") : undefined,
    timeout: 50_000,
    maxRetries: 2,
  });
  clientCache.set(name, client);
  return client;
}

function getClient(): OpenAI | null {
  return makeClient("chat", process.env.OPENAI_API_KEY, process.env.OPENAI_BASE_URL);
}

function getSttClient(): OpenAI | null {
  const key = process.env.STT_API_KEY || process.env.OPENAI_API_KEY;
  const baseUrl = process.env.STT_BASE_URL || process.env.OPENAI_BASE_URL;
  return makeClient("stt", key, baseUrl);
}

function getModel(): string {
  return process.env.AI_MODEL?.trim() || "gpt-4o";
}

// Model markdown kod bloki ichiga solib qo'ysa ham JSON ni topib oladi.
function extractJson(raw: string): Partial<DiagnosisResult> | null {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed) as Partial<DiagnosisResult>;
  } catch {
    // continue
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim()) as Partial<DiagnosisResult>;
    } catch {
      // continue
    }
  }
  const brace = trimmed.match(/\{[\s\S]*\}/);
  if (brace) {
    try {
      return JSON.parse(brace[0]) as Partial<DiagnosisResult>;
    } catch {
      // continue
    }
  }
  return null;
}

type ChatMessage = OpenAI.ChatCompletionMessageParam;

function buildMessages(category: "crop" | "animal", text: string, imageDataUrl?: string | null): ChatMessage[] {
  const subject = category === "crop" ? "Ekin (o'simlik)" : "Hayvon (chorva)";
  const content: OpenAI.ChatCompletionContentPart[] = [
    {
      type: "text",
      text: `Bo'lim: ${subject}. Foydalanuvchi tavsifi: ${text || "(matn berilmadi, faqat rasm)"}`,
    },
  ];
  if (imageDataUrl) {
    content.push({ type: "image_url", image_url: { url: imageDataUrl } });
  }
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content },
  ];
}

async function requestDiagnosis(messages: ChatMessage[], useJsonMode: boolean): Promise<string> {
  const client = getClient();
  if (!client) throw new Error("AI kaliti sozlanmagan");
  const res = await client.chat.completions.create({
    model: getModel(),
    ...(useJsonMode ? { response_format: { type: "json_object" as const } } : {}),
    messages,
    max_tokens: 700,
  });
  return res.choices?.[0]?.message?.content ?? "";
}

export async function aiDiagnose(params: {
  category: "crop" | "animal";
  text: string;
  imageDataUrl?: string | null;
}): Promise<DiagnosisResult> {
  const { category, text, imageDataUrl } = params;
  const client = getClient();
  if (!client) return offlineDiagnose(category, text);

  const messages = buildMessages(category, text, imageDataUrl);

  let raw = "";
  try {
    // Avval JSON rejimida sinab ko'ramiz; ba'zi open-source serverlar
    // (vLLM va h.k.) buni qo'llab-quvvatlamasa, oddiy rejimda qayta urinamiz.
    try {
      raw = await requestDiagnosis(messages, true);
    } catch {
      raw = await requestDiagnosis(messages, false);
    }
    const parsed = extractJson(raw);
    if (!parsed?.disease) throw new Error("AI javobida kasallik nomi yo'q");
    return {
      disease: String(parsed.disease),
      solution: String(parsed.solution ?? ""),
      medicines: Array.isArray(parsed.medicines) ? parsed.medicines.map(String) : [],
      severity: String(parsed.severity ?? "orta"),
      prevention: String(parsed.prevention ?? ""),
      source: "ai",
    };
  } catch {
    return offlineDiagnose(category, text);
  }
}

export async function transcribeAudio(file: Blob): Promise<string> {
  const client = getSttClient();
  if (!client) return "";
  try {
    const isOgg = (file.type || "").includes("ogg");
    const audioFile = new File([file], isOgg ? "audio.ogg" : "audio.webm", {
      type: file.type || (isOgg ? "audio/ogg" : "audio/webm"),
    });
    const res = await client.audio.transcriptions.create({
      file: audioFile,
      model: process.env.STT_MODEL?.trim() || process.env.ASR_MODEL?.trim() || "whisper-1",
      language: "uz",
    });
    return res.text ?? "";
  } catch {
    return "";
  }
}
