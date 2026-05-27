export interface Phrase {
  id: string;
  nativeLang: string;
  targetLang: string;
  target: string;
  native: string;
  pronunciation: string;
  topic: string;
  practiced: boolean;
  createdAt: number;
}

export interface Pair {
  nativeLang: string;
  targetLang: string;
}

export type Contrast = "normal" | "high" | "max";
export type Tab = "phrases" | "practice" | "settings";

export const STORAGE_KEY = "mandarin-english:phrases:v2";
export const PAIR_KEY = "mandarin-english:pair";
export const NATIVE_LANG_KEY = "mandarin-english:native-lang";
export const SPEECH_RATE_KEY = "mandarin-english:speech-rate";
export const FONT_SCALE_KEY = "mandarin-english:font-scale";
export const CONTRAST_KEY = "mandarin-english:contrast";
export const TAB_KEY = "mandarin-english:tab";
export const LEGACY_KEY = "mandarin-english:phrases";
export const LEGACY_DIRECTION_KEY = "mandarin-english:direction";

export const COMMON_LANGUAGES = [
  "Mandarin", "English", "Spanish", "French", "German", "Italian",
  "Portuguese", "Japanese", "Korean", "Cantonese", "Russian", "Arabic",
  "Hindi", "Vietnamese", "Indonesian",
];

export const LANG_CODES: Record<string, string> = {
  Mandarin: "zh", English: "en", Spanish: "es", French: "fr", German: "de",
  Italian: "it", Portuguese: "pt", Japanese: "ja", Korean: "ko",
  Cantonese: "zh", Russian: "ru", Arabic: "ar", Hindi: "hi",
  Vietnamese: "vi", Indonesian: "id",
};

export const CJK_LANGS = new Set(["zh", "ja", "ko", "ar", "hi", "ru"]);

export function seedPhrases(): Phrase[] {
  const now = Date.now();
  return [
    { id: "seed-1", nativeLang: "English", targetLang: "Mandarin", target: "你好,我叫…", native: "Hi, my name is…", pronunciation: "nǐ hǎo, wǒ jiào…", topic: "intro", practiced: false, createdAt: now - 4 },
    { id: "seed-2", nativeLang: "English", targetLang: "Mandarin", target: "我来自悉尼。", native: "I'm from Sydney.", pronunciation: "wǒ lái zì xī ní.", topic: "intro", practiced: false, createdAt: now - 3 },
    { id: "seed-3", nativeLang: "Mandarin", targetLang: "English", target: "What do you do for work?", native: "你做什么工作?", pronunciation: "", topic: "intro", practiced: false, createdAt: now - 2 },
  ];
}

export function loadPhrases(): Phrase[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed as Phrase[];
    }
  } catch {}
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy !== null) {
      const parsed = JSON.parse(legacy) as Array<{
        id: string; direction: "to-mandarin" | "to-english"; target: string;
        native: string; pinyin?: string; topic: string; practiced: boolean; createdAt: number;
      }>;
      if (Array.isArray(parsed)) {
        return parsed.map((p) => ({
          id: p.id,
          nativeLang: p.direction === "to-mandarin" ? "English" : "Mandarin",
          targetLang: p.direction === "to-mandarin" ? "Mandarin" : "English",
          target: p.target, native: p.native, pronunciation: p.pinyin ?? "",
          topic: p.topic, practiced: p.practiced, createdAt: p.createdAt,
        }));
      }
    }
  } catch {}
  return seedPhrases();
}

export function loadPair(): Pair {
  try {
    const raw = localStorage.getItem(PAIR_KEY);
    if (raw) { const parsed = JSON.parse(raw) as Pair; if (parsed.nativeLang && parsed.targetLang) return parsed; }
    const legacyDir = localStorage.getItem(LEGACY_DIRECTION_KEY);
    if (legacyDir === "to-english") return { nativeLang: "Mandarin", targetLang: "English" };
  } catch {}
  return { nativeLang: "English", targetLang: "Mandarin" };
}

export function loadNativeLang(): string {
  try { const raw = localStorage.getItem(NATIVE_LANG_KEY); if (raw) return raw; } catch {}
  return "English";
}

export function loadSpeechRate(): number {
  try {
    const raw = localStorage.getItem(SPEECH_RATE_KEY);
    if (raw) { const n = parseFloat(raw); if (n >= 0.3 && n <= 2) return n; }
  } catch {}
  return 0.85;
}

export function loadFontScale(): number {
  try {
    const raw = localStorage.getItem(FONT_SCALE_KEY);
    if (raw) { const n = parseFloat(raw); if (n >= 0.8 && n <= 1.6) return n; }
  } catch {}
  return 1;
}

export function loadContrast(): Contrast {
  try {
    const raw = localStorage.getItem(CONTRAST_KEY);
    if (raw === "normal" || raw === "high" || raw === "max") return raw;
  } catch {}
  return "normal";
}

export function loadTab(): Tab {
  try {
    const raw = localStorage.getItem(TAB_KEY);
    if (raw === "phrases" || raw === "practice" || raw === "settings") return raw;
  } catch {}
  return "phrases";
}

export function newId(): string {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
