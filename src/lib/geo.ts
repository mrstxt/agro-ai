export type Place = {
  region: string;
  district: string | null;
};

// Viloyat markazlari va yirik shaharlar (taxminiy markaziy koordinatalar).
export const REGION_CENTERS: Record<string, { lat: number; lng: number }> = {
  Toshkent: { lat: 41.3111, lng: 69.2797 },
  "Toshkent viloyati": { lat: 41.0, lng: 69.4 },
  Samarqand: { lat: 39.627, lng: 66.975 },
  Buxoro: { lat: 39.7681, lng: 64.4556 },
  Andijon: { lat: 40.7821, lng: 72.3442 },
  Fargona: { lat: 40.3864, lng: 71.7864 },
  Namangan: { lat: 40.9983, lng: 71.6726 },
  Qashqadaryo: { lat: 38.8629, lng: 65.7847 },
  Surxondaryo: { lat: 37.9358, lng: 67.5789 },
  Jizzax: { lat: 40.1158, lng: 67.8422 },
  Sirdaryo: { lat: 40.3864, lng: 68.7864 },
  Navoiy: { lat: 40.0844, lng: 65.3792 },
  Xorazm: { lat: 41.35, lng: 60.6167 },
  "Qoraqalpogiston": { lat: 42.4667, lng: 59.6 },
};

// Toshkent tumanlari (dolzarb koordinatalar bilan).
const TASHKENT_DISTRICTS: { name: string; lat: number; lng: number }[] = [
  { name: "Bektemir", lat: 41.2205, lng: 69.3359 },
  { name: "Chilonzor", lat: 41.2756, lng: 69.2044 },
  { name: "Mirobod", lat: 41.2873, lng: 69.3016 },
  { name: "Mirzo Ulug'bek", lat: 41.3325, lng: 69.3449 },
  { name: "Olmazor", lat: 41.3561, lng: 69.2242 },
  { name: "Sergeli", lat: 41.2263, lng: 69.2164 },
  { name: "Shayxontohur", lat: 41.3234, lng: 69.2285 },
  { name: "Uchtepa", lat: 41.3094, lng: 69.1816 },
  { name: "Yakkasaroy", lat: 41.2892, lng: 69.2522 },
  { name: "Yashnobod", lat: 41.2875, lng: 69.3452 },
  { name: "Yunusobod", lat: 41.3695, lng: 69.2902 },
];

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

type BigDataCloudResponse = {
  localityInfo?: {
    administrative?: { name?: string; adminLevel?: number }[];
  };
  city?: string;
  locality?: string;
  principalSubdivision?: string;
};

/** GPS koordinatani viloyat/tuman nomiga aylantiradi (bepul BigDataCloud API). */
export async function resolvePlace(lat: number, lng: number): Promise<Place> {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=uz`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) throw new Error("geocode");
    const json = (await res.json()) as BigDataCloudResponse;

    const admins = json.localityInfo?.administrative ?? [];
    // adminLevel o'sib boradi (4-6 = viloyat/davra, 8+ = tuman).
    const region = [...admins]
      .sort((a, b) => (a.adminLevel ?? 99) - (b.adminLevel ?? 99))
      .find((a) => (a.adminLevel ?? 99) >= 4 && (a.adminLevel ?? 99) <= 6)?.name ?? json.principalSubdivision ?? "";

    // Toshkent shahri uchun tumanlarni statik ro'yxatdan topamiz.
    let district: string | null = json.locality ?? json.city ?? null;
    if (region.toLowerCase().includes("toshkent")) {
      const nearest = TASHKENT_DISTRICTS.map((d) => ({ name: d.name, km: distanceKm(lat, lng, d.lat, d.lng) }))
        .sort((a, b) => a.km - b.km)[0];
      if (nearest && nearest.km < 12) district = `${nearest.name} tumani`;
    }

    return {
      region: normalizeRegion(region) || "Toshkent",
      district: district || null,
    };
  } catch {
    // Geocoding ishlamasa eng yaqin viloyat markazini topamiz.
    const entries = Object.entries(REGION_CENTERS).map(([name, c]) => ({ name, km: distanceKm(lat, lng, c.lat, c.lng) }));
    entries.sort((a, b) => a.km - b.km);
    return { region: entries[0]?.name ?? "Toshkent", district: null };
  }
}

function normalizeRegion(region: string): string {
  const t = region.toLowerCase();
  for (const key of Object.keys(REGION_CENTERS)) {
    if (t.includes(key.toLowerCase().slice(0, 6))) return key;
  }
  return region;
}

export type WeatherAdvice = {
  ok: boolean;
  temp: number;
  wind: number;
  humidity: number;
  rain: number;
  level: "ok" | "caution" | "warning" | "danger";
  advice: string;
};

type OpenMeteo = {
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    wind_speed_10m?: number;
    precipitation?: number;
  };
};

function levelOf(temp: number, wind: number, rain: number, humidity: number): WeatherAdvice["level"] {
  if (wind >= 5 || rain > 0.3) return "danger";
  if (temp >= 33 || temp <= 3) return "warning";
  if (humidity >= 80) return "caution";
  return "ok";
}

function adviceText(temp: number, wind: number, rain: number, humidity: number): string {
  if (wind >= 5) return "Bugun dori sepmang — shamol kuchli, dori nishonga tushmaydi.";
  if (rain > 0.3) return "Yomg'ir bor — purkash samarasiz, yomg'irdan keyin 1 kun kuting.";
  if (temp >= 33) return "Jazirama issiq — hayvonlarga soya va toza suv bering, purkashni kechqurun qiling.";
  if (humidity >= 80) return "Namlik yuqori — zamburug' kasalliklari xavfi bor, profilaktika purkash qiling.";
  if (temp <= 3) return "Sovuq — ekinlarni sovuqdan himoya qiling, molxonani isiting.";
  return "Ob-havo qulay — purkash va dala ishlari uchun yaxshi kun.";
}

export async function getWeatherAdvice(lat: number, lng: number): Promise<WeatherAdvice> {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) throw new Error("weather");
    const json = (await res.json()) as OpenMeteo;
    const c = json.current ?? {};
    const temp = Math.round(c.temperature_2m ?? 22);
    const wind = Math.round((c.wind_speed_10m ?? 2) * 10) / 10;
    const humidity = Math.round(c.relative_humidity_2m ?? 45);
    const rain = c.precipitation ?? 0;
    return {
      ok: true,
      temp,
      wind,
      humidity,
      rain,
      level: levelOf(temp, wind, rain, humidity),
      advice: adviceText(temp, wind, rain, humidity),
    };
  } catch {
    return {
      ok: false,
      temp: 24,
      wind: 2.5,
      humidity: 45,
      rain: 0,
      level: "caution",
      advice: "Ob-havo ma'lumoti yangilanmadi. Dala ishlarida ehtiyot bo'ling.",
    };
  }
}
