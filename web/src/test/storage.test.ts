import { beforeEach, describe, expect, it } from "vitest";
import {
  loadPhrases, loadPair, loadNativeLang, loadSpeechRate, loadFontScale, loadContrast, loadTab, newId,
  seedPhrases,
  STORAGE_KEY, PAIR_KEY, NATIVE_LANG_KEY, SPEECH_RATE_KEY, FONT_SCALE_KEY, CONTRAST_KEY, TAB_KEY,
  LEGACY_KEY, LEGACY_DIRECTION_KEY,
} from "../storage";

beforeEach(() => { localStorage.clear(); });

describe("loadPhrases", () => {
  it("returns seed phrases when localStorage is empty", () => {
    const phrases = loadPhrases();
    expect(phrases).toHaveLength(3);
    expect(phrases[0]!.id).toBe("seed-1");
    expect(phrases[0]!.targetLang).toBe("Mandarin");
  });

  it("parses v2 storage", () => {
    const data = [{ id: "x", nativeLang: "English", targetLang: "French", target: "bonjour", native: "hello", pronunciation: "", topic: "", practiced: false, createdAt: 1 }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    expect(loadPhrases()).toEqual(data);
  });

  it("migrates legacy v1 'to-mandarin' direction to English→Mandarin", () => {
    const legacy = [{ id: "a", direction: "to-mandarin", target: "你好", native: "hello", pinyin: "nǐ hǎo", topic: "intro", practiced: false, createdAt: 1 }];
    localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy));
    const result = loadPhrases();
    expect(result).toHaveLength(1);
    expect(result[0]!.nativeLang).toBe("English");
    expect(result[0]!.targetLang).toBe("Mandarin");
    expect(result[0]!.pronunciation).toBe("nǐ hǎo");
  });

  it("migrates legacy v1 'to-english' direction to Mandarin→English", () => {
    const legacy = [{ id: "b", direction: "to-english", target: "hello", native: "你好", topic: "", practiced: false, createdAt: 1 }];
    localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy));
    const result = loadPhrases();
    expect(result[0]!.nativeLang).toBe("Mandarin");
    expect(result[0]!.targetLang).toBe("English");
    expect(result[0]!.pronunciation).toBe("");
  });

  it("falls back to seed on invalid JSON", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(loadPhrases()).toHaveLength(3);
  });

  it("falls back to seed when v2 contains non-array", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ foo: "bar" }));
    expect(loadPhrases()).toHaveLength(3);
  });
});

describe("loadPair", () => {
  it("returns English→Mandarin by default", () => {
    expect(loadPair()).toEqual({ nativeLang: "English", targetLang: "Mandarin" });
  });

  it("parses stored pair", () => {
    localStorage.setItem(PAIR_KEY, JSON.stringify({ nativeLang: "French", targetLang: "German" }));
    expect(loadPair()).toEqual({ nativeLang: "French", targetLang: "German" });
  });

  it("migrates legacy direction=to-english to Mandarin→English", () => {
    localStorage.setItem(LEGACY_DIRECTION_KEY, "to-english");
    expect(loadPair()).toEqual({ nativeLang: "Mandarin", targetLang: "English" });
  });

  it("ignores stored pair missing fields", () => {
    localStorage.setItem(PAIR_KEY, JSON.stringify({ nativeLang: "French" }));
    expect(loadPair()).toEqual({ nativeLang: "English", targetLang: "Mandarin" });
  });

  it("falls back on invalid JSON", () => {
    localStorage.setItem(PAIR_KEY, "not-json");
    expect(loadPair()).toEqual({ nativeLang: "English", targetLang: "Mandarin" });
  });
});

describe("loadNativeLang", () => {
  it("defaults to English", () => {
    expect(loadNativeLang()).toBe("English");
  });
  it("reads stored value", () => {
    localStorage.setItem(NATIVE_LANG_KEY, "Russian");
    expect(loadNativeLang()).toBe("Russian");
  });
});

describe("loadSpeechRate", () => {
  it("defaults to 0.85", () => {
    expect(loadSpeechRate()).toBe(0.85);
  });
  it("reads valid value", () => {
    localStorage.setItem(SPEECH_RATE_KEY, "1.2");
    expect(loadSpeechRate()).toBe(1.2);
  });
  it("rejects out-of-range value (too high)", () => {
    localStorage.setItem(SPEECH_RATE_KEY, "5.0");
    expect(loadSpeechRate()).toBe(0.85);
  });
  it("rejects out-of-range value (too low)", () => {
    localStorage.setItem(SPEECH_RATE_KEY, "0.1");
    expect(loadSpeechRate()).toBe(0.85);
  });
  it("rejects non-numeric", () => {
    localStorage.setItem(SPEECH_RATE_KEY, "fast");
    expect(loadSpeechRate()).toBe(0.85);
  });
});

describe("loadFontScale", () => {
  it("defaults to 1", () => {
    expect(loadFontScale()).toBe(1);
  });
  it("reads valid value", () => {
    localStorage.setItem(FONT_SCALE_KEY, "1.3");
    expect(loadFontScale()).toBe(1.3);
  });
  it("rejects below 0.8", () => {
    localStorage.setItem(FONT_SCALE_KEY, "0.5");
    expect(loadFontScale()).toBe(1);
  });
  it("rejects above 1.6", () => {
    localStorage.setItem(FONT_SCALE_KEY, "2.0");
    expect(loadFontScale()).toBe(1);
  });
});

describe("loadContrast", () => {
  it("defaults to normal", () => {
    expect(loadContrast()).toBe("normal");
  });
  it("accepts high", () => {
    localStorage.setItem(CONTRAST_KEY, "high");
    expect(loadContrast()).toBe("high");
  });
  it("accepts max", () => {
    localStorage.setItem(CONTRAST_KEY, "max");
    expect(loadContrast()).toBe("max");
  });
  it("rejects invalid value", () => {
    localStorage.setItem(CONTRAST_KEY, "extreme");
    expect(loadContrast()).toBe("normal");
  });
});

describe("loadTab", () => {
  it("defaults to phrases", () => {
    expect(loadTab()).toBe("phrases");
  });
  it("accepts each valid tab", () => {
    for (const t of ["phrases", "practice", "settings"] as const) {
      localStorage.setItem(TAB_KEY, t);
      expect(loadTab()).toBe(t);
    }
  });
  it("rejects invalid tab", () => {
    localStorage.setItem(TAB_KEY, "stats");
    expect(loadTab()).toBe("phrases");
  });
});

describe("newId", () => {
  it("produces unique ids", () => {
    const ids = new Set(Array.from({ length: 50 }, () => newId()));
    expect(ids.size).toBe(50);
  });
  it("uses the p- prefix", () => {
    expect(newId()).toMatch(/^p-/);
  });
});

describe("seedPhrases", () => {
  it("returns three phrases with intro topic", () => {
    const seeds = seedPhrases();
    expect(seeds).toHaveLength(3);
    expect(seeds.every((p) => p.topic === "intro")).toBe(true);
  });
  it("includes both directions of English↔Mandarin", () => {
    const seeds = seedPhrases();
    const pairs = new Set(seeds.map((p) => `${p.nativeLang}→${p.targetLang}`));
    expect(pairs.has("English→Mandarin")).toBe(true);
    expect(pairs.has("Mandarin→English")).toBe(true);
  });
});
