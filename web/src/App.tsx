import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Shell } from "./components/Shell";

interface Phrase {
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

interface Pair {
  nativeLang: string;
  targetLang: string;
}

const STORAGE_KEY = "mandarin-english:phrases:v2";
const PAIR_KEY = "mandarin-english:pair";
const NATIVE_LANG_KEY = "mandarin-english:native-lang";
const SPEECH_RATE_KEY = "mandarin-english:speech-rate";
const TAB_KEY = "mandarin-english:tab";
const LEGACY_KEY = "mandarin-english:phrases";
const LEGACY_DIRECTION_KEY = "mandarin-english:direction";

const COMMON_LANGUAGES = [
  "Mandarin", "English", "Spanish", "French", "German", "Italian",
  "Portuguese", "Japanese", "Korean", "Cantonese", "Russian", "Arabic",
  "Hindi", "Vietnamese", "Indonesian",
];

const LANG_CODES: Record<string, string> = {
  Mandarin: "zh", English: "en", Spanish: "es", French: "fr", German: "de",
  Italian: "it", Portuguese: "pt", Japanese: "ja", Korean: "ko",
  Cantonese: "zh", Russian: "ru", Arabic: "ar", Hindi: "hi",
  Vietnamese: "vi", Indonesian: "id",
};

const CJK_LANGS = new Set(["zh", "ja", "ko", "ar", "hi", "ru"]);

async function fetchPronunciation(text: string, lang: string): Promise<string | null> {
  const code = LANG_CODES[lang];
  if (!code || !CJK_LANGS.has(code)) return null;
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${code}&tl=en&dt=rm&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json() as unknown[][];
    const rmBlock = data?.[0] as unknown[][] | undefined;
    if (!Array.isArray(rmBlock)) return null;
    const parts: string[] = [];
    for (const seg of rmBlock) {
      const rom = (seg as string[])[3];
      if (typeof rom === "string" && rom.trim()) parts.push(rom.trim());
    }
    return parts.length > 0 ? parts.join(" ") : null;
  } catch { return null; }
}

async function autoTranslate(text: string, sourceLang: string, targetLang: string): Promise<string | null> {
  const sourceCode = LANG_CODES[sourceLang];
  const targetCode = LANG_CODES[targetLang];
  if (!sourceCode || !targetCode || !text.trim()) return null;
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceCode}&tl=${targetCode}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json() as unknown[][];
      const segments = data?.[0] as unknown[][];
      if (Array.isArray(segments)) {
        const translated = segments.map((s) => (s as string[])[0]).join("");
        if (translated) return translated;
      }
    }
  } catch { /* fall through */ }
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceCode}|${targetCode}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json() as { responseStatus: number; responseData?: { translatedText?: string } };
    if (data.responseStatus !== 200) return null;
    return data.responseData?.translatedText ?? null;
  } catch { return null; }
}

function loadNativeLang(): string {
  try { const raw = localStorage.getItem(NATIVE_LANG_KEY); if (raw) return raw; } catch {}
  return "English";
}

function loadSpeechRate(): number {
  try {
    const raw = localStorage.getItem(SPEECH_RATE_KEY);
    if (raw) { const n = parseFloat(raw); if (n >= 0.3 && n <= 2) return n; }
  } catch {}
  return 0.85;
}

const SEED_PHRASES: Phrase[] = [
  { id: "seed-1", nativeLang: "English", targetLang: "Mandarin", target: "你好,我叫…", native: "Hi, my name is…", pronunciation: "nǐ hǎo, wǒ jiào…", topic: "intro", practiced: false, createdAt: Date.now() - 4 },
  { id: "seed-2", nativeLang: "English", targetLang: "Mandarin", target: "我来自悉尼。", native: "I'm from Sydney.", pronunciation: "wǒ lái zì xī ní.", topic: "intro", practiced: false, createdAt: Date.now() - 3 },
  { id: "seed-3", nativeLang: "Mandarin", targetLang: "English", target: "What do you do for work?", native: "你做什么工作?", pronunciation: "", topic: "intro", practiced: false, createdAt: Date.now() - 2 },
];

function loadPhrases(): Phrase[] {
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
  return SEED_PHRASES;
}

function loadPair(): Pair {
  try {
    const raw = localStorage.getItem(PAIR_KEY);
    if (raw) { const parsed = JSON.parse(raw) as Pair; if (parsed.nativeLang && parsed.targetLang) return parsed; }
    const legacyDir = localStorage.getItem(LEGACY_DIRECTION_KEY);
    if (legacyDir === "to-english") return { nativeLang: "Mandarin", targetLang: "English" };
  } catch {}
  return { nativeLang: "English", targetLang: "Mandarin" };
}

function newId(): string {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function speak(text: string, lang: string, rate?: number) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const code = LANG_CODES[lang];
  if (code) u.lang = code;
  u.rate = rate ?? loadSpeechRate();
  window.speechSynthesis.speak(u);
}

type Tab = "phrases" | "practice" | "settings";

function loadTab(): Tab {
  try {
    const raw = localStorage.getItem(TAB_KEY);
    if (raw === "phrases" || raw === "practice" || raw === "settings") return raw;
  } catch {}
  return "phrases";
}

export default function App() {
  const [phrases, setPhrases] = useState<Phrase[]>(() => loadPhrases());
  const [pair, setPair] = useState<Pair>(() => loadPair());
  const [nativeLang, setNativeLang] = useState<string>(() => loadNativeLang());
  const [speechRate, setSpeechRate] = useState<number>(() => loadSpeechRate());
  const [tab, setTab] = useState<Tab>(() => loadTab());
  const [topicFilter, setTopicFilter] = useState<string>("");
  const [showOnlyUnpractised, setShowOnlyUnpractised] = useState(false);

  useEffect(() => { setTopicFilter(""); }, [pair.nativeLang, pair.targetLang]);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(phrases)); }, [phrases]);
  useEffect(() => { localStorage.setItem(PAIR_KEY, JSON.stringify(pair)); }, [pair]);
  useEffect(() => { localStorage.setItem(NATIVE_LANG_KEY, nativeLang); }, [nativeLang]);
  useEffect(() => { localStorage.setItem(SPEECH_RATE_KEY, String(speechRate)); }, [speechRate]);
  useEffect(() => { localStorage.setItem(TAB_KEY, tab); }, [tab]);

  const attemptedPronunciation = useRef(new Set<string>());
  useEffect(() => {
    const missing = phrases.filter(
      (p) => !p.pronunciation && p.target.trim() && CJK_LANGS.has(LANG_CODES[p.targetLang] ?? "") && !attemptedPronunciation.current.has(p.id),
    );
    if (missing.length === 0) return;
    for (const p of missing) attemptedPronunciation.current.add(p.id);
    let cancelled = false;
    (async () => {
      for (const p of missing) {
        if (cancelled) break;
        const rom = await fetchPronunciation(p.target, p.targetLang);
        if (cancelled) break;
        if (rom) setPhrases((prev) => prev.map((x) => (x.id === p.id && !x.pronunciation ? { ...x, pronunciation: rom } : x)));
      }
    })();
    return () => { cancelled = true; };
  }, [phrases]);

  const knownPairs = useMemo(() => {
    const seen = new Map<string, Pair>();
    for (const p of phrases) {
      const k = `${p.nativeLang}→${p.targetLang}`;
      if (!seen.has(k)) seen.set(k, { nativeLang: p.nativeLang, targetLang: p.targetLang });
    }
    const currentKey = `${pair.nativeLang}→${pair.targetLang}`;
    if (!seen.has(currentKey)) seen.set(currentKey, pair);
    return Array.from(seen.values());
  }, [phrases, pair]);

  const filtered = useMemo(() => {
    return phrases
      .filter((p) => p.nativeLang === pair.nativeLang && p.targetLang === pair.targetLang)
      .filter((p) => (topicFilter ? p.topic === topicFilter : true))
      .filter((p) => (showOnlyUnpractised ? !p.practiced : true))
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [phrases, pair, topicFilter, showOnlyUnpractised]);

  const topics = useMemo(() => {
    const set = new Set(
      phrases.filter((p) => p.nativeLang === pair.nativeLang && p.targetLang === pair.targetLang).map((p) => p.topic).filter(Boolean),
    );
    return Array.from(set).sort();
  }, [phrases, pair]);

  function add(p: Omit<Phrase, "id" | "practiced" | "createdAt">) {
    setPhrases((prev) => [{ ...p, id: newId(), practiced: false, createdAt: Date.now() }, ...prev]);
  }
  function update(id: string, patch: Partial<Phrase>) {
    setPhrases((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }
  function remove(id: string) {
    setPhrases((prev) => prev.filter((p) => p.id !== id));
  }
  function resetPracticed() {
    setPhrases((prev) => prev.map((p) => p.nativeLang === pair.nativeLang && p.targetLang === pair.targetLang ? { ...p, practiced: false } : p));
  }

  return (
    <Shell>
      <main style={{ flex: 1, overflow: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={{ maxWidth: "600px", margin: "0 auto", padding: "1rem 1rem 1.5rem" }}>
          {tab !== "settings" && (
            <PairBar pair={pair} onChange={setPair} knownPairs={knownPairs} />
          )}

          {tab === "phrases" && (
            <PhrasesTab
              pair={pair}
              phrases={filtered}
              topics={topics}
              topicFilter={topicFilter}
              onTopicFilterChange={setTopicFilter}
              showOnlyUnpractised={showOnlyUnpractised}
              onShowOnlyUnpractisedChange={setShowOnlyUnpractised}
              onAdd={add}
              onUpdate={update}
              onRemove={remove}
            />
          )}

          {tab === "practice" && (
            <PracticeTab
              phrases={filtered}
              onMarkPractised={(id) => update(id, { practiced: true })}
              onResetAll={resetPracticed}
            />
          )}

          {tab === "settings" && (
            <SettingsTab
              pair={pair}
              onPairChange={setPair}
              knownPairs={knownPairs}
              nativeLang={nativeLang}
              onNativeLangChange={setNativeLang}
              speechRate={speechRate}
              onSpeechRateChange={setSpeechRate}
            />
          )}
        </div>
      </main>

      <BottomNav tab={tab} onChange={setTab} />
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// Bottom navigation bar
// ---------------------------------------------------------------------------

const NAV_ITEMS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: "phrases",
    label: "Phrases",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="8" y1="13" x2="16" y2="13" />
        <line x1="8" y1="17" x2="16" y2="17" />
      </svg>
    ),
  },
  {
    id: "practice",
    label: "Practice",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polygon points="10 8 16 12 10 16 10 8" />
      </svg>
    ),
  },
  {
    id: "settings",
    label: "Settings",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

function BottomNav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav
      style={{
        display: "flex",
        alignItems: "stretch",
        justifyContent: "space-around",
        borderTop: "1px solid var(--line)",
        background: "var(--dock)",
        flexShrink: 0,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {NAV_ITEMS.map((item) => {
        const active = tab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.2rem",
              padding: "0.6rem 0 0.45rem",
              border: 0,
              background: "transparent",
              color: active ? "var(--accent)" : "var(--muted)",
              fontFamily: "inherit",
              fontSize: "0.68rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "color 0.15s",
            }}
          >
            {item.icon}
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Pair switcher bar (compact, shown on phrases + practice tabs)
// ---------------------------------------------------------------------------

function PairBar({ pair, onChange, knownPairs }: { pair: Pair; onChange: (p: Pair) => void; knownPairs: Pair[] }) {
  return (
    <div
      style={{
        display: "flex",
        gap: "0.35rem",
        marginBottom: "0.85rem",
        overflowX: "auto",
        WebkitOverflowScrolling: "touch",
        paddingBottom: "0.15rem",
      }}
    >
      {knownPairs.map((p) => {
        const k = `${p.nativeLang}→${p.targetLang}`;
        const active = p.nativeLang === pair.nativeLang && p.targetLang === pair.targetLang;
        return (
          <button
            key={k}
            type="button"
            onClick={() => onChange(p)}
            style={{
              padding: "0.4rem 0.85rem",
              borderRadius: "999px",
              border: active ? "1.5px solid var(--accent)" : "1px solid var(--line)",
              fontFamily: "inherit",
              fontWeight: 600,
              fontSize: "0.82rem",
              cursor: "pointer",
              background: active ? "var(--accent)" : "var(--panel)",
              color: active ? "white" : "var(--ink)",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {p.nativeLang} → {p.targetLang}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phrases tab
// ---------------------------------------------------------------------------

function PhrasesTab(props: {
  pair: Pair;
  phrases: Phrase[];
  topics: string[];
  topicFilter: string;
  onTopicFilterChange: (t: string) => void;
  showOnlyUnpractised: boolean;
  onShowOnlyUnpractisedChange: (v: boolean) => void;
  onAdd: (p: Omit<Phrase, "id" | "practiced" | "createdAt">) => void;
  onUpdate: (id: string, patch: Partial<Phrase>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <>
      <AddForm pair={props.pair} onAdd={props.onAdd} />

      {(props.topics.length > 0 || props.showOnlyUnpractised) && (
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", margin: "0.85rem 0 0.6rem" }}>
          <select
            value={props.topicFilter}
            onChange={(e) => props.onTopicFilterChange(e.target.value)}
            style={{
              padding: "0.4rem 0.5rem",
              border: "1px solid var(--line)",
              borderRadius: "0.5rem",
              background: "var(--paper)",
              color: "var(--ink)",
              fontFamily: "inherit",
              fontSize: "16px",
            }}
          >
            <option value="">All topics</option>
            {props.topics.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.85rem" }}>
            <input
              type="checkbox"
              checked={props.showOnlyUnpractised}
              onChange={(e) => props.onShowOnlyUnpractisedChange(e.target.checked)}
            />
            Unpractised only
          </label>
        </div>
      )}

      {props.phrases.length === 0 ? (
        <p style={{ color: "var(--muted)", padding: "2.5rem 0", textAlign: "center", fontSize: "0.92rem" }}>
          No phrases yet. Add one above.
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {props.phrases.map((p) => (
            <PhraseRow key={p.id} phrase={p} onUpdate={props.onUpdate} onRemove={props.onRemove} />
          ))}
        </ul>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Add form
// ---------------------------------------------------------------------------

function AddForm({ pair, onAdd }: { pair: Pair; onAdd: (p: Omit<Phrase, "id" | "practiced" | "createdAt">) => void }) {
  const [target, setTarget] = useState("");
  const [native, setNative] = useState("");
  const [pronunciation, setPronunciation] = useState("");
  const [topic, setTopic] = useState("");
  const [justAdded, setJustAdded] = useState(false);
  const [translatingField, setTranslatingField] = useState<"target" | "native" | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const targetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nativeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const targetIsUserTyped = useRef(true);
  const nativeIsUserTyped = useRef(true);
  const pronIsUserTyped = useRef(false);
  const translateVersion = useRef(0);
  const nativeRef = useRef(native);
  nativeRef.current = native;
  const targetRef = useRef(target);
  targetRef.current = target;

  function cancelAllTimers() {
    if (targetTimerRef.current) { clearTimeout(targetTimerRef.current); targetTimerRef.current = null; }
    if (nativeTimerRef.current) { clearTimeout(nativeTimerRef.current); nativeTimerRef.current = null; }
  }

  const handleTargetChange = useCallback((val: string) => {
    setTarget(val);
    targetIsUserTyped.current = true;
    cancelAllTimers();
    if (!val.trim()) { setTranslatingField(null); return; }
    const version = ++translateVersion.current;
    targetTimerRef.current = setTimeout(() => {
      if (!pronIsUserTyped.current) {
        fetchPronunciation(val, pair.targetLang).then((rom) => {
          if (version !== translateVersion.current) return;
          if (rom) setPronunciation(rom);
        });
      }
      if (!nativeIsUserTyped.current || !nativeRef.current.trim()) {
        setTranslatingField("native");
        autoTranslate(val, pair.targetLang, pair.nativeLang).then((result) => {
          if (version !== translateVersion.current) return;
          if (result) { nativeIsUserTyped.current = false; setNative(result); }
          setTranslatingField(null);
        });
      }
    }, 500);
  }, [pair.targetLang, pair.nativeLang]);

  const handleNativeChange = useCallback((val: string) => {
    setNative(val);
    nativeIsUserTyped.current = true;
    cancelAllTimers();
    if (!val.trim()) { setTranslatingField(null); return; }
    const version = ++translateVersion.current;
    nativeTimerRef.current = setTimeout(() => {
      if (!targetIsUserTyped.current || !targetRef.current.trim()) {
        setTranslatingField("target");
        autoTranslate(val, pair.nativeLang, pair.targetLang).then((result) => {
          if (version !== translateVersion.current) return;
          if (result) {
            targetIsUserTyped.current = false;
            setTarget(result);
            if (!pronIsUserTyped.current) {
              fetchPronunciation(result, pair.targetLang).then((rom) => {
                if (version !== translateVersion.current) return;
                if (rom) setPronunciation(rom);
              });
            }
          }
          setTranslatingField(null);
        });
      }
    }, 500);
  }, [pair.nativeLang, pair.targetLang]);

  const handlePronunciationChange = useCallback((val: string) => {
    setPronunciation(val);
    pronIsUserTyped.current = val.trim().length > 0;
  }, []);

  useEffect(() => {
    return () => {
      if (targetTimerRef.current) clearTimeout(targetTimerRef.current);
      if (nativeTimerRef.current) clearTimeout(nativeTimerRef.current);
    };
  }, []);

  const submit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTarget = target.trim();
    const trimmedNative = native.trim();
    if (!trimmedTarget || !trimmedNative) return;
    onAdd({
      nativeLang: pair.nativeLang, targetLang: pair.targetLang,
      target: trimmedTarget, native: trimmedNative,
      pronunciation: pronunciation.trim(), topic: topic.trim(),
    });
    setTarget(""); setNative(""); setPronunciation("");
    targetIsUserTyped.current = true;
    pronIsUserTyped.current = false;
    nativeIsUserTyped.current = true;
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
    requestAnimationFrame(() => { listRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); });
  }, [target, native, pronunciation, topic, pair, onAdd]);

  return (
    <>
      <form
        onSubmit={submit}
        style={{
          padding: "0.85rem",
          border: "1px solid var(--line)",
          borderRadius: "0.75rem",
          background: "var(--panel)",
          display: "grid",
          gap: "0.5rem",
        }}
      >
        <Field
          label={`${pair.targetLang} (what you'll say)`}
          value={target}
          onChange={handleTargetChange}
          trailing={translatingField === "target" ? "translating..." : undefined}
        />
        <Field
          label={`${pair.nativeLang} meaning`}
          value={native}
          onChange={handleNativeChange}
          trailing={translatingField === "native" ? "translating..." : undefined}
        />
        <Field label="Pronunciation" value={pronunciation} onChange={handlePronunciationChange} />
        <Field label="Topic" value={topic} onChange={setTopic} placeholder="intro, weather, food..." />
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <button
            type="submit"
            style={{ ...primaryButton, ...(!target.trim() || !native.trim() ? { opacity: 0.4, cursor: "default" } : {}) }}
            disabled={!target.trim() || !native.trim()}
          >
            Add phrase
          </button>
          {justAdded && <span style={{ fontSize: "0.82rem", color: "var(--accent)", fontWeight: 600 }}>Added!</span>}
        </div>
      </form>
      <div ref={listRef} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Phrase row + edit form
// ---------------------------------------------------------------------------

function PhraseRow({ phrase, onUpdate, onRemove }: { phrase: Phrase; onUpdate: (id: string, patch: Partial<Phrase>) => void; onRemove: (id: string) => void }) {
  const [editing, setEditing] = useState(false);
  return (
    <li
      style={{
        padding: "0.75rem 0",
        borderBottom: "1px solid var(--line)",
        display: "grid",
        gap: "0.3rem",
        opacity: phrase.practiced ? 0.55 : 1,
      }}
    >
      {editing ? (
        <EditForm phrase={phrase} onSave={(patch) => { onUpdate(phrase.id, patch); setEditing(false); }} onCancel={() => setEditing(false)} />
      ) : (
        <>
          <p
            style={{ fontSize: "1.02rem", fontWeight: 600, lineHeight: 1.4, cursor: "pointer", margin: 0 }}
            onClick={() => speak(phrase.target, phrase.targetLang)}
          >
            {phrase.target} <span style={{ fontSize: "0.7rem", opacity: 0.45 }}>🔊</span>
          </p>
          {phrase.pronunciation && (
            <p style={{ color: "var(--muted)", fontSize: "0.82rem", fontStyle: "italic", margin: 0 }}>{phrase.pronunciation}</p>
          )}
          <p style={{ color: "var(--muted)", fontSize: "0.88rem", margin: 0 }}>{phrase.native}</p>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.3rem", fontSize: "0.78rem", flexWrap: "wrap" }}>
            {phrase.topic && (
              <span style={{ padding: "0.12rem 0.5rem", background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "999px", color: "var(--muted)" }}>
                {phrase.topic}
              </span>
            )}
            <label style={{ display: "flex", gap: "0.25rem", alignItems: "center", color: "var(--muted)", cursor: "pointer" }}>
              <input type="checkbox" checked={phrase.practiced} onChange={(e) => onUpdate(phrase.id, { practiced: e.target.checked })} />
              Practised
            </label>
            <button type="button" onClick={() => setEditing(true)} style={linkButton}>Edit</button>
            <button type="button" onClick={() => { if (confirm("Delete this phrase?")) onRemove(phrase.id); }} style={linkButton}>Delete</button>
          </div>
        </>
      )}
    </li>
  );
}

function EditForm({ phrase, onSave, onCancel }: { phrase: Phrase; onSave: (patch: Partial<Phrase>) => void; onCancel: () => void }) {
  const [target, setTarget] = useState(phrase.target);
  const [native, setNative] = useState(phrase.native);
  const [pronunciation, setPronunciation] = useState(phrase.pronunciation);
  const [topic, setTopic] = useState(phrase.topic);
  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSave({ target: target.trim(), native: native.trim(), pronunciation: pronunciation.trim(), topic: topic.trim() });
  }
  return (
    <form onSubmit={submit} style={{ display: "grid", gap: "0.5rem" }}>
      <Field label={`${phrase.targetLang}`} value={target} onChange={setTarget} />
      <Field label={`${phrase.nativeLang}`} value={native} onChange={setNative} />
      <Field label="Pronunciation" value={pronunciation} onChange={setPronunciation} />
      <Field label="Topic" value={topic} onChange={setTopic} />
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.2rem" }}>
        <button type="submit" style={primaryButton}>Save</button>
        <button type="button" onClick={onCancel} style={secondaryButton}>Cancel</button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Practice tab
// ---------------------------------------------------------------------------

function PracticeTab({ phrases, onMarkPractised, onResetAll }: { phrases: Phrase[]; onMarkPractised: (id: string) => void; onResetAll: () => void }) {
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    setIndex((i) => (phrases.length > 0 ? Math.min(i, phrases.length - 1) : 0));
  }, [phrases.length]);

  if (phrases.length === 0) {
    return (
      <div style={{ color: "var(--muted)", padding: "3rem 1rem", textAlign: "center" }}>
        <p style={{ fontSize: "0.95rem", marginBottom: "0.5rem" }}>No phrases for this pair yet.</p>
        <p style={{ fontSize: "0.85rem" }}>Switch to the Phrases tab to add some.</p>
      </div>
    );
  }

  const safeIndex = Math.min(index, phrases.length - 1);
  const p = phrases[safeIndex]!;
  const allPractised = phrases.every((q) => q.practiced);

  function next() { setIndex((i) => (i + 1) % phrases.length); }
  function prev() { setIndex((i) => (i - 1 + phrases.length) % phrases.length); }
  function gotIt() { onMarkPractised(p.id); if (safeIndex < phrases.length - 1) next(); }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <span style={{ color: "var(--muted)", fontSize: "0.85rem", fontWeight: 600 }}>
          {safeIndex + 1} / {phrases.length}
        </span>
        <button
          type="button"
          onClick={() => {
            const root = document.documentElement;
            if (root.requestFullscreen) root.requestFullscreen().catch(() => {});
            setFullscreen(true);
          }}
          style={{ ...secondaryButton, padding: "0.4rem 0.8rem", fontSize: "0.82rem" }}
        >
          Full screen
        </button>
      </div>

      <div
        style={{
          padding: "2rem 1.25rem",
          border: "1px solid var(--line)",
          borderRadius: "1rem",
          background: "var(--panel)",
          minHeight: "200px",
          display: "grid",
          gap: "0.5rem",
          alignContent: "center",
          textAlign: "center",
        }}
      >
        <p
          style={{ fontSize: "1.5rem", fontWeight: 700, lineHeight: 1.3, cursor: "pointer", margin: 0 }}
          onClick={() => speak(p.target, p.targetLang)}
        >
          {p.target} <span style={{ fontSize: "0.85rem", opacity: 0.45 }}>🔊</span>
        </p>
        {p.pronunciation && <p style={{ color: "var(--muted)", fontStyle: "italic", margin: 0 }}>{p.pronunciation}</p>}
        <p style={{ color: "var(--muted)", margin: 0 }}>{p.native}</p>
        {p.topic && (
          <p style={{ color: "var(--muted)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
            {p.topic}
          </p>
        )}
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
        <button type="button" style={{ ...secondaryButton, flex: 1 }} onClick={prev}>← Prev</button>
        <button type="button" style={{ ...primaryButton, flex: 2 }} onClick={gotIt}>Got it →</button>
        <button type="button" style={{ ...secondaryButton, flex: 1 }} onClick={next}>Skip</button>
      </div>

      {allPractised && (
        <div style={{ marginTop: "1.25rem", padding: "1rem", border: "1px solid var(--line)", borderRadius: "0.75rem", textAlign: "center" }}>
          <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>All practised!</p>
          <button type="button" onClick={onResetAll} style={secondaryButton}>Reset and go again</button>
        </div>
      )}

      {fullscreen && (
        <FullscreenView phrases={phrases} index={safeIndex} onPrev={prev} onNext={next} onClose={() => setFullscreen(false)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings tab
// ---------------------------------------------------------------------------

function SettingsTab({
  pair, onPairChange, knownPairs, nativeLang, onNativeLangChange, speechRate, onSpeechRateChange,
}: {
  pair: Pair; onPairChange: (p: Pair) => void; knownPairs: Pair[];
  nativeLang: string; onNativeLangChange: (lang: string) => void;
  speechRate: number; onSpeechRateChange: (rate: number) => void;
}) {
  const [addingPair, setAddingPair] = useState(false);
  const [draftNative, setDraftNative] = useState(pair.nativeLang);
  const [draftTarget, setDraftTarget] = useState(pair.targetLang);

  function savePair(e: React.FormEvent) {
    e.preventDefault();
    const native = draftNative.trim();
    const target = draftTarget.trim();
    if (!native || !target || native === target) return;
    onPairChange({ nativeLang: native, targetLang: target });
    setAddingPair(false);
  }

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <h2 style={{ fontFamily: "Fraunces, serif", fontSize: "1.25rem", fontWeight: 800, margin: 0 }}>Settings</h2>

      {/* Language pairs */}
      <Section title="Language pairs">
        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
          {knownPairs.map((p) => {
            const k = `${p.nativeLang}→${p.targetLang}`;
            const active = p.nativeLang === pair.nativeLang && p.targetLang === pair.targetLang;
            return (
              <button
                key={k}
                type="button"
                onClick={() => onPairChange(p)}
                style={{
                  padding: "0.4rem 0.85rem",
                  borderRadius: "999px",
                  border: active ? "1.5px solid var(--accent)" : "1px solid var(--line)",
                  fontFamily: "inherit",
                  fontWeight: 600,
                  fontSize: "0.82rem",
                  cursor: "pointer",
                  background: active ? "var(--accent)" : "transparent",
                  color: active ? "white" : "var(--ink)",
                }}
              >
                {p.nativeLang} → {p.targetLang}
              </button>
            );
          })}
        </div>
        {addingPair ? (
          <form onSubmit={savePair} style={{ display: "grid", gap: "0.5rem" }}>
            <Field label="I speak" value={draftNative} onChange={setDraftNative} datalist="settings-lang-opts" placeholder="English" />
            <Field label="I'm practising" value={draftTarget} onChange={setDraftTarget} datalist="settings-lang-opts" placeholder="Mandarin" />
            <datalist id="settings-lang-opts">
              {COMMON_LANGUAGES.map((l) => <option key={l} value={l} />)}
            </datalist>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="submit"
                style={{ ...primaryButton, ...(!draftNative.trim() || !draftTarget.trim() || draftNative.trim() === draftTarget.trim() ? { opacity: 0.4, cursor: "default" } : {}) }}
                disabled={!draftNative.trim() || !draftTarget.trim() || draftNative.trim() === draftTarget.trim()}
              >
                Add pair
              </button>
              <button type="button" onClick={() => setAddingPair(false)} style={secondaryButton}>Cancel</button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => { setDraftNative(nativeLang); setDraftTarget(""); setAddingPair(true); }}
            style={{ ...secondaryButton, fontSize: "0.85rem", padding: "0.45rem 0.9rem" }}
          >
            + Add pair
          </button>
        )}
      </Section>

      {/* Native language */}
      <Section title="Native language">
        <select
          value={nativeLang}
          onChange={(e) => onNativeLangChange(e.target.value)}
          style={{
            padding: "0.5rem 0.6rem",
            border: "1px solid var(--line)",
            borderRadius: "0.5rem",
            background: "var(--paper)",
            color: "var(--ink)",
            fontFamily: "inherit",
            fontSize: "16px",
            width: "100%",
          }}
        >
          {COMMON_LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </Section>

      {/* Speech speed */}
      <Section title={`Speech speed: ${speechRate.toFixed(2)}x`}>
        <input
          type="range"
          min="0.3"
          max="1.5"
          step="0.05"
          value={speechRate}
          onChange={(e) => onSpeechRateChange(parseFloat(e.target.value))}
          style={{ width: "100%", accentColor: "var(--accent)" }}
        />
        <span style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--muted)" }}>
          <span>Slow</span>
          <span>Fast</span>
        </span>
      </Section>

      {/* About */}
      <Section title="About">
        <p style={{ color: "var(--muted)", lineHeight: 1.6, fontSize: "0.88rem", margin: 0 }}>
          Add phrases you want to say, then practise them out loud. Tap any phrase to hear it spoken. Type in either field and the other auto-translates.
        </p>
        <p style={{ color: "var(--muted)", lineHeight: 1.6, fontSize: "0.85rem", marginTop: "0.5rem" }}>
          Everything is saved locally in your browser.
        </p>
        <a
          href="https://freeappstore.online"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "inline-block", marginTop: "0.6rem", color: "var(--muted)", fontSize: "0.78rem" }}
        >
          Part of FreeAppStore — free forever
        </a>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "0.85rem",
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: "0.75rem",
        display: "grid",
        gap: "0.5rem",
      }}
    >
      <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {title}
      </span>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fullscreen practice view
// ---------------------------------------------------------------------------

function FullscreenView({ phrases, index, onPrev, onNext, onClose }: {
  phrases: Phrase[]; index: number; onPrev: () => void; onNext: () => void; onClose: () => void;
}) {
  const p = phrases[index]!;

  useEffect(() => {
    return () => { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); };
  }, []);

  useEffect(() => {
    function onFullscreenChange() { if (!document.fullscreenElement) onClose(); }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, [onClose]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") onPrev();
      else if (e.key === "ArrowRight") onNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);

  return (
    <div
      role="dialog"
      aria-label="Phrase fullscreen"
      style={{ position: "fixed", inset: 0, background: "var(--paper)", zIndex: 1000, display: "grid", gridTemplateRows: "auto 1fr auto" }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1rem", borderBottom: "1px solid var(--line)" }}>
        <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
          {index + 1} / {phrases.length}{p.topic && <> · {p.topic}</>}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Exit fullscreen"
          style={{ background: "transparent", border: "1px solid var(--line)", color: "var(--ink)", padding: "0.4rem 0.7rem", borderRadius: "0.5rem", fontFamily: "inherit", fontSize: "0.85rem", cursor: "pointer" }}
        >
          ✕ Close
        </button>
      </div>

      <div style={{ position: "relative", display: "grid", alignContent: "center", textAlign: "center", padding: "1.5rem", gap: "1rem", overflow: "auto" }}>
        <p
          style={{ fontSize: "clamp(2rem, 9vw, 5rem)", fontWeight: 700, lineHeight: 1.2, wordBreak: "break-word", cursor: "pointer", position: "relative", zIndex: 10, margin: 0 }}
          onClick={(e) => { e.stopPropagation(); speak(p.target, p.targetLang); }}
        >
          {p.target}
        </p>
        {p.pronunciation && (
          <p style={{ color: "var(--muted)", fontStyle: "italic", fontSize: "clamp(1rem, 3.5vw, 1.75rem)", margin: 0 }}>{p.pronunciation}</p>
        )}
        <p style={{ color: "var(--muted)", fontSize: "clamp(1rem, 3vw, 1.5rem)", margin: 0 }}>{p.native}</p>
        <button type="button" aria-label="Previous phrase" onClick={onPrev} style={tapZoneLeft} />
        <button type="button" aria-label="Next phrase" onClick={onNext} style={tapZoneRight} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", padding: "0.75rem 1.25rem", borderTop: "1px solid var(--line)", color: "var(--muted)", fontSize: "0.82rem" }}>
        <span>← tap left</span>
        <span>tap right →</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared components & styles
// ---------------------------------------------------------------------------

function Field({ label, value, onChange, placeholder, datalist, trailing }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; datalist?: string; trailing?: string;
}) {
  return (
    <label style={{ display: "grid", gap: "0.2rem" }}>
      <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600 }}>{label}</span>
        {trailing && <span style={{ fontSize: "0.7rem", color: "var(--muted)", fontStyle: "italic" }}>{trailing}</span>}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        list={datalist}
        style={{
          padding: "0.5rem 0.6rem",
          border: "1px solid var(--line)",
          borderRadius: "0.5rem",
          background: "var(--paper)",
          color: "var(--ink)",
          fontFamily: "inherit",
          fontSize: "16px",
          width: "100%",
        }}
      />
    </label>
  );
}

const tapZoneLeft: React.CSSProperties = {
  position: "absolute", top: 0, left: 0, width: "50%", height: "100%",
  background: "transparent", border: 0, cursor: "pointer", outline: "none",
};

const tapZoneRight: React.CSSProperties = { ...tapZoneLeft, left: "50%" };

const primaryButton: React.CSSProperties = {
  background: "var(--accent)", color: "white", border: 0,
  padding: "0.5rem 1rem", borderRadius: "0.5rem",
  fontFamily: "inherit", fontWeight: 600, fontSize: "0.88rem", cursor: "pointer",
};

const secondaryButton: React.CSSProperties = {
  background: "transparent", color: "var(--ink)", border: "1px solid var(--line)",
  padding: "0.5rem 1rem", borderRadius: "0.5rem",
  fontFamily: "inherit", fontWeight: 600, fontSize: "0.88rem", cursor: "pointer",
};

const linkButton: React.CSSProperties = {
  background: "transparent", color: "var(--muted)", border: 0, padding: 0,
  fontFamily: "inherit", fontSize: "0.78rem", cursor: "pointer", textDecoration: "underline",
};
