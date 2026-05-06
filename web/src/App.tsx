import { useEffect, useMemo, useState } from "react";
import { Shell } from "./components/Shell";

// Multilingual phrase prep for face-to-face language exchange. Pick a
// language pair (you-speak ↔ you're-learning), add the lines you want to
// say at the meetup, then step through them in Practice mode.

interface Phrase {
  id: string;
  nativeLang: string;        // the language YOU speak (translation)
  targetLang: string;        // the language you're PRACTISING
  target: string;            // what you'll say (in targetLang)
  native: string;            // its meaning (in nativeLang)
  pronunciation: string;     // optional romanization / IPA / pinyin
  topic: string;             // free-form tag, e.g. "intro", "food"
  practiced: boolean;
  createdAt: number;
}

interface Pair {
  nativeLang: string;
  targetLang: string;
}

const STORAGE_KEY = "mandarin-english:phrases:v2";
const PAIR_KEY = "mandarin-english:pair";
const LEGACY_KEY = "mandarin-english:phrases";       // pre-multilingual
const LEGACY_DIRECTION_KEY = "mandarin-english:direction";

// Common language pairs — exposed as quick-pick presets. The user can
// always type a custom language; this is just to short-circuit the
// 90% case.
const COMMON_LANGUAGES = [
  "Mandarin",
  "English",
  "Spanish",
  "French",
  "German",
  "Italian",
  "Portuguese",
  "Japanese",
  "Korean",
  "Cantonese",
  "Russian",
  "Arabic",
  "Hindi",
  "Vietnamese",
  "Indonesian",
];

const SEED_PHRASES: Phrase[] = [
  {
    id: "seed-1",
    nativeLang: "English",
    targetLang: "Mandarin",
    target: "你好,我叫…",
    native: "Hi, my name is…",
    pronunciation: "nǐ hǎo, wǒ jiào…",
    topic: "intro",
    practiced: false,
    createdAt: Date.now() - 4,
  },
  {
    id: "seed-2",
    nativeLang: "English",
    targetLang: "Mandarin",
    target: "我来自悉尼。",
    native: "I'm from Sydney.",
    pronunciation: "wǒ lái zì xī ní.",
    topic: "intro",
    practiced: false,
    createdAt: Date.now() - 3,
  },
  {
    id: "seed-3",
    nativeLang: "Mandarin",
    targetLang: "English",
    target: "What do you do for work?",
    native: "你做什么工作?",
    pronunciation: "",
    topic: "intro",
    practiced: false,
    createdAt: Date.now() - 2,
  },
];

function loadPhrases(): Phrase[] {
  // v2: native + target language strings.
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed as Phrase[];
    }
  } catch {
    // fall through to migration
  }

  // v1 migration: old `direction: "to-mandarin"|"to-english"` rows
  // become English↔Mandarin pairs. `pinyin` becomes `pronunciation`.
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy !== null) {
      const parsed = JSON.parse(legacy) as Array<{
        id: string;
        direction: "to-mandarin" | "to-english";
        target: string;
        native: string;
        pinyin?: string;
        topic: string;
        practiced: boolean;
        createdAt: number;
      }>;
      if (Array.isArray(parsed)) {
        return parsed.map((p) => ({
          id: p.id,
          nativeLang: p.direction === "to-mandarin" ? "English" : "Mandarin",
          targetLang: p.direction === "to-mandarin" ? "Mandarin" : "English",
          target: p.target,
          native: p.native,
          pronunciation: p.pinyin ?? "",
          topic: p.topic,
          practiced: p.practiced,
          createdAt: p.createdAt,
        }));
      }
    }
  } catch {
    // fall through to seed
  }

  return SEED_PHRASES;
}

function loadPair(): Pair {
  try {
    const raw = localStorage.getItem(PAIR_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Pair;
      if (parsed.nativeLang && parsed.targetLang) return parsed;
    }
  } catch {
    // fall through
  }
  // Legacy: v1 stored a `direction` enum. Map it to a pair.
  const legacyDir = localStorage.getItem(LEGACY_DIRECTION_KEY);
  if (legacyDir === "to-english") return { nativeLang: "Mandarin", targetLang: "English" };
  return { nativeLang: "English", targetLang: "Mandarin" };
}

function newId(): string {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

type View = "list" | "practice";

export default function App() {
  const [phrases, setPhrases] = useState<Phrase[]>(() => loadPhrases());
  const [pair, setPair] = useState<Pair>(() => loadPair());
  const [view, setView] = useState<View>("list");
  const [topicFilter, setTopicFilter] = useState<string>("");
  const [showOnlyUnpractised, setShowOnlyUnpractised] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(phrases));
  }, [phrases]);

  useEffect(() => {
    localStorage.setItem(PAIR_KEY, JSON.stringify(pair));
  }, [pair]);

  // All distinct language pairs the user has phrases for — drives the
  // pair quick-switcher so they can flip between the two pairs they're
  // actively prepping for.
  const knownPairs = useMemo(() => {
    const seen = new Map<string, Pair>();
    for (const p of phrases) {
      const k = `${p.nativeLang}→${p.targetLang}`;
      if (!seen.has(k)) seen.set(k, { nativeLang: p.nativeLang, targetLang: p.targetLang });
    }
    // Always include the current pair, even if no phrases yet.
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
      phrases
        .filter((p) => p.nativeLang === pair.nativeLang && p.targetLang === pair.targetLang)
        .map((p) => p.topic)
        .filter(Boolean),
    );
    return Array.from(set).sort();
  }, [phrases, pair]);

  function add(p: Omit<Phrase, "id" | "practiced" | "createdAt">) {
    setPhrases((prev) => [
      { ...p, id: newId(), practiced: false, createdAt: Date.now() },
      ...prev,
    ]);
  }

  function update(id: string, patch: Partial<Phrase>) {
    setPhrases((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function remove(id: string) {
    setPhrases((prev) => prev.filter((p) => p.id !== id));
  }

  function resetPracticed() {
    setPhrases((prev) =>
      prev.map((p) =>
        p.nativeLang === pair.nativeLang && p.targetLang === pair.targetLang
          ? { ...p, practiced: false }
          : p,
      ),
    );
  }

  return (
    <Shell>
      <div style={{ maxWidth: "780px", margin: "0 auto", padding: "1rem 0 4rem" }}>
        <Header />

        <PairPicker pair={pair} onChange={setPair} knownPairs={knownPairs} />

        <ViewTabs view={view} onChange={setView} />

        {view === "list" ? (
          <ListView
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
        ) : (
          <PracticeView
            phrases={filtered}
            onMarkPractised={(id) => update(id, { practiced: true })}
            onResetAll={resetPracticed}
          />
        )}
      </div>
    </Shell>
  );
}

function Header() {
  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <h1
        style={{
          fontFamily: "Fraunces, serif",
          fontSize: "1.75rem",
          fontWeight: 800,
          marginBottom: "0.25rem",
        }}
      >
        Phrase prep
      </h1>
      <p style={{ color: "var(--muted)", lineHeight: 1.55 }}>
        Pick a language pair, add the lines you want to say at the meetup, then practise them out loud
        before you speak with strangers. Any languages — all saved in your browser.
      </p>
    </div>
  );
}

function PairPicker({
  pair,
  onChange,
  knownPairs,
}: {
  pair: Pair;
  onChange: (p: Pair) => void;
  knownPairs: Pair[];
}) {
  const [editing, setEditing] = useState(false);
  const [draftNative, setDraftNative] = useState(pair.nativeLang);
  const [draftTarget, setDraftTarget] = useState(pair.targetLang);

  function save(e: React.FormEvent) {
    e.preventDefault();
    const native = draftNative.trim();
    const target = draftTarget.trim();
    if (!native || !target || native === target) return;
    onChange({ nativeLang: native, targetLang: target });
    setEditing(false);
  }

  if (editing) {
    return (
      <form
        onSubmit={save}
        style={{
          padding: "1rem",
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "0.75rem",
          marginBottom: "1rem",
          display: "grid",
          gap: "0.6rem",
        }}
      >
        <Field
          label="I speak"
          value={draftNative}
          onChange={setDraftNative}
          datalist="lang-options"
          placeholder="English"
        />
        <Field
          label="I'm practising"
          value={draftTarget}
          onChange={setDraftTarget}
          datalist="lang-options"
          placeholder="Mandarin"
        />
        <datalist id="lang-options">
          {COMMON_LANGUAGES.map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="submit"
            style={primaryButton}
            disabled={!draftNative.trim() || !draftTarget.trim() || draftNative.trim() === draftTarget.trim()}
          >
            Use this pair
          </button>
          <button type="button" onClick={() => setEditing(false)} style={secondaryButton}>
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        gap: "0.5rem",
        padding: "0.4rem",
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: "0.75rem",
        marginBottom: "1rem",
        alignItems: "center",
        flexWrap: "wrap",
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
              padding: "0.45rem 0.9rem",
              borderRadius: "0.5rem",
              border: 0,
              fontFamily: "inherit",
              fontWeight: 600,
              fontSize: "0.88rem",
              cursor: "pointer",
              background: active ? "var(--accent)" : "transparent",
              color: active ? "white" : "var(--ink)",
            }}
          >
            {p.nativeLang} → {p.targetLang}
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => {
          setDraftNative(pair.nativeLang);
          setDraftTarget(pair.targetLang);
          setEditing(true);
        }}
        style={{
          marginLeft: "auto",
          padding: "0.45rem 0.9rem",
          borderRadius: "0.5rem",
          border: "1px dashed var(--line)",
          fontFamily: "inherit",
          fontWeight: 600,
          fontSize: "0.85rem",
          cursor: "pointer",
          background: "transparent",
          color: "var(--muted)",
        }}
      >
        + Pair
      </button>
    </div>
  );
}

function ViewTabs({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div
      style={{
        display: "flex",
        gap: "1.5rem",
        marginBottom: "1rem",
        borderBottom: "1px solid var(--line)",
      }}
    >
      {(["list", "practice"] as const).map((v) => {
        const active = view === v;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            style={{
              padding: "0.7rem 0",
              border: 0,
              background: "transparent",
              fontFamily: "inherit",
              fontSize: "0.95rem",
              fontWeight: 600,
              cursor: "pointer",
              color: active ? "var(--ink)" : "var(--muted)",
              borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
              marginBottom: "-1px",
            }}
          >
            {v === "list" ? "List" : "Practice"}
          </button>
        );
      })}
    </div>
  );
}

function ListView(props: {
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
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", margin: "1rem 0 0.75rem" }}>
          <select
            value={props.topicFilter}
            onChange={(e) => props.onTopicFilterChange(e.target.value)}
            style={{
              padding: "0.45rem 0.6rem",
              border: "1px solid var(--line)",
              borderRadius: "0.5rem",
              background: "var(--paper)",
              color: "var(--ink)",
              fontFamily: "inherit",
              fontSize: "0.88rem",
            }}
          >
            <option value="">All topics</option>
            {props.topics.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.88rem" }}>
            <input
              type="checkbox"
              checked={props.showOnlyUnpractised}
              onChange={(e) => props.onShowOnlyUnpractisedChange(e.target.checked)}
            />
            Only unpractised
          </label>
        </div>
      )}

      {props.phrases.length === 0 ? (
        <p style={{ color: "var(--muted)", padding: "2rem 0", textAlign: "center" }}>
          No phrases for {props.pair.nativeLang} → {props.pair.targetLang} yet. Add one above.
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

function AddForm({
  pair,
  onAdd,
}: {
  pair: Pair;
  onAdd: (p: Omit<Phrase, "id" | "practiced" | "createdAt">) => void;
}) {
  const [target, setTarget] = useState("");
  const [native, setNative] = useState("");
  const [pronunciation, setPronunciation] = useState("");
  const [topic, setTopic] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!target.trim() || !native.trim()) return;
    onAdd({
      nativeLang: pair.nativeLang,
      targetLang: pair.targetLang,
      target: target.trim(),
      native: native.trim(),
      pronunciation: pronunciation.trim(),
      topic: topic.trim(),
    });
    setTarget("");
    setNative("");
    setPronunciation("");
    // keep topic — usually you batch-add to one topic at a time
  }

  return (
    <form
      onSubmit={submit}
      style={{
        padding: "1rem",
        border: "1px solid var(--line)",
        borderRadius: "0.75rem",
        background: "var(--panel)",
        display: "grid",
        gap: "0.6rem",
      }}
    >
      <Field
        label={`${pair.targetLang} (what you'll say)`}
        value={target}
        onChange={setTarget}
      />
      <Field
        label={`${pair.nativeLang} meaning`}
        value={native}
        onChange={setNative}
      />
      <Field
        label="Pronunciation (optional — pinyin, romaji, IPA, etc.)"
        value={pronunciation}
        onChange={setPronunciation}
      />
      <Field
        label="Topic (optional)"
        value={topic}
        onChange={setTopic}
        placeholder="intro, weather, food…"
      />
      <div>
        <button type="submit" style={primaryButton} disabled={!target.trim() || !native.trim()}>
          Add phrase
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  datalist,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  datalist?: string;
}) {
  return (
    <label style={{ display: "grid", gap: "0.25rem" }}>
      <span style={{ fontSize: "0.78rem", color: "var(--muted)", fontWeight: 600 }}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        list={datalist}
        style={{
          padding: "0.55rem 0.7rem",
          border: "1px solid var(--line)",
          borderRadius: "0.5rem",
          background: "var(--paper)",
          color: "var(--ink)",
          fontFamily: "inherit",
          fontSize: "0.95rem",
          width: "100%",
        }}
      />
    </label>
  );
}

function PhraseRow({
  phrase,
  onUpdate,
  onRemove,
}: {
  phrase: Phrase;
  onUpdate: (id: string, patch: Partial<Phrase>) => void;
  onRemove: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <li
      style={{
        padding: "0.85rem 0",
        borderBottom: "1px solid var(--line)",
        display: "grid",
        gap: "0.35rem",
        opacity: phrase.practiced ? 0.55 : 1,
      }}
    >
      {editing ? (
        <EditForm
          phrase={phrase}
          onSave={(patch) => {
            onUpdate(phrase.id, patch);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <p style={{ fontSize: "1.05rem", fontWeight: 600, lineHeight: 1.45 }}>{phrase.target}</p>
          {phrase.pronunciation && (
            <p style={{ color: "var(--muted)", fontSize: "0.85rem", fontStyle: "italic" }}>
              {phrase.pronunciation}
            </p>
          )}
          <p style={{ color: "var(--muted)", fontSize: "0.92rem" }}>{phrase.native}</p>
          <div
            style={{
              display: "flex",
              gap: "0.6rem",
              alignItems: "center",
              marginTop: "0.4rem",
              fontSize: "0.82rem",
              flexWrap: "wrap",
            }}
          >
            {phrase.topic && (
              <span
                style={{
                  padding: "0.15rem 0.55rem",
                  background: "var(--panel)",
                  border: "1px solid var(--line)",
                  borderRadius: "999px",
                  color: "var(--muted)",
                }}
              >
                {phrase.topic}
              </span>
            )}
            <label
              style={{
                display: "flex",
                gap: "0.3rem",
                alignItems: "center",
                color: "var(--muted)",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={phrase.practiced}
                onChange={(e) => onUpdate(phrase.id, { practiced: e.target.checked })}
              />
              Practised
            </label>
            <button type="button" onClick={() => setEditing(true)} style={linkButton}>
              Edit
            </button>
            <button type="button" onClick={() => onRemove(phrase.id)} style={linkButton}>
              Delete
            </button>
          </div>
        </>
      )}
    </li>
  );
}

function EditForm({
  phrase,
  onSave,
  onCancel,
}: {
  phrase: Phrase;
  onSave: (patch: Partial<Phrase>) => void;
  onCancel: () => void;
}) {
  const [target, setTarget] = useState(phrase.target);
  const [native, setNative] = useState(phrase.native);
  const [pronunciation, setPronunciation] = useState(phrase.pronunciation);
  const [topic, setTopic] = useState(phrase.topic);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      target: target.trim(),
      native: native.trim(),
      pronunciation: pronunciation.trim(),
      topic: topic.trim(),
    });
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: "0.5rem" }}>
      <Field label={`${phrase.targetLang} (what you'll say)`} value={target} onChange={setTarget} />
      <Field label={`${phrase.nativeLang} meaning`} value={native} onChange={setNative} />
      <Field
        label="Pronunciation"
        value={pronunciation}
        onChange={setPronunciation}
      />
      <Field label="Topic" value={topic} onChange={setTopic} />
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
        <button type="submit" style={primaryButton}>
          Save
        </button>
        <button type="button" onClick={onCancel} style={secondaryButton}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function PracticeView({
  phrases,
  onMarkPractised,
  onResetAll,
}: {
  phrases: Phrase[];
  onMarkPractised: (id: string) => void;
  onResetAll: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  if (phrases.length === 0) {
    return (
      <p style={{ color: "var(--muted)", padding: "2rem 0", textAlign: "center" }}>
        No phrases for this pair yet. Add some in the List tab.
      </p>
    );
  }

  const safeIndex = Math.min(index, phrases.length - 1);
  const p = phrases[safeIndex]!;
  const allPractised = phrases.every((q) => q.practiced);

  function next() {
    setIndex((i) => (i + 1) % phrases.length);
  }
  function prev() {
    setIndex((i) => (i - 1 + phrases.length) % phrases.length);
  }
  function gotIt() {
    onMarkPractised(p.id);
    next();
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1.25rem",
        }}
      >
        <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
          {safeIndex + 1} / {phrases.length}
        </span>
        <button
          type="button"
          onClick={() => {
            // Request real OS fullscreen synchronously inside the click
            // handler so iOS Safari + strict browsers accept it (they
            // require an active user gesture). Calling this from the
            // FullscreenView's useEffect was too late — the gesture
            // window had already closed and the request was rejected.
            const root = document.documentElement;
            if (root.requestFullscreen) {
              root.requestFullscreen().catch(() => {
                // Denied — modal still works as full-viewport.
              });
            }
            setFullscreen(true);
          }}
          style={{ ...secondaryButton, padding: "0.45rem 0.9rem", fontSize: "0.85rem" }}
        >
          ⛶ Full screen
        </button>
      </div>

      <div
        style={{
          padding: "2rem 1.5rem",
          border: "1px solid var(--line)",
          borderRadius: "0.75rem",
          background: "var(--panel)",
          minHeight: "180px",
          display: "grid",
          gap: "0.6rem",
          alignContent: "center",
          textAlign: "center",
        }}
      >
        <p style={{ fontSize: "1.6rem", fontWeight: 700, lineHeight: 1.3 }}>{p.target}</p>
        {p.pronunciation && <p style={{ color: "var(--muted)", fontStyle: "italic" }}>{p.pronunciation}</p>}
        <p style={{ color: "var(--muted)" }}>{p.native}</p>
        {p.topic && (
          <p
            style={{
              color: "var(--muted)",
              fontSize: "0.78rem",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {p.topic}
          </p>
        )}
      </div>

      <div style={{ display: "flex", gap: "0.6rem", marginTop: "1.25rem", flexWrap: "wrap" }}>
        <button type="button" style={secondaryButton} onClick={prev}>
          ← Previous
        </button>
        <button type="button" style={primaryButton} onClick={gotIt}>
          Got it — next →
        </button>
        <button type="button" style={secondaryButton} onClick={next}>
          Skip
        </button>
      </div>

      {allPractised && (
        <div
          style={{
            marginTop: "1.5rem",
            padding: "1rem",
            border: "1px solid var(--line)",
            borderRadius: "0.5rem",
            textAlign: "center",
          }}
        >
          <p style={{ fontWeight: 600 }}>All practised. 🎉</p>
          <button type="button" onClick={onResetAll} style={{ ...secondaryButton, marginTop: "0.6rem" }}>
            Reset and go again
          </button>
        </div>
      )}

      {fullscreen && (
        <FullscreenView
          phrases={phrases}
          index={safeIndex}
          onPrev={prev}
          onNext={next}
          onClose={() => setFullscreen(false)}
        />
      )}
    </div>
  );
}

/**
 * Big-text presentation mode for showing the phrase to the person you're
 * speaking with. Tap the left half = previous, right half = next. Esc or
 * the × button exits. Tries to engage the browser's real fullscreen API
 * (so notches / browser chrome get out of the way) but works without it
 * — the modal is full-viewport either way.
 */
function FullscreenView({
  phrases,
  index,
  onPrev,
  onNext,
  onClose,
}: {
  phrases: Phrase[];
  index: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const p = phrases[index]!;

  // OS-level fullscreen is engaged by the click handler on the trigger
  // button (sync, inside the user gesture). Here we just ensure we exit
  // OS fullscreen when the modal closes for any reason.
  useEffect(() => {
    return () => {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  // Sync modal state with OS fullscreen: if the user presses Esc / F11 /
  // swipes-down to leave OS fullscreen, close our modal too. Otherwise
  // they'd be stuck looking at the modal with no chrome cue that they
  // can exit.
  useEffect(() => {
    function onFullscreenChange() {
      if (!document.fullscreenElement) onClose();
    }
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
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--paper)",
        zIndex: 1000,
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.75rem 1rem",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
          {index + 1} / {phrases.length}
          {p.topic && <> · {p.topic}</>}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Exit fullscreen"
          style={{
            background: "transparent",
            border: "1px solid var(--line)",
            color: "var(--ink)",
            padding: "0.4rem 0.7rem",
            borderRadius: "0.5rem",
            fontFamily: "inherit",
            fontSize: "0.85rem",
            cursor: "pointer",
          }}
        >
          ✕ Close
        </button>
      </div>

      <div
        style={{
          position: "relative",
          display: "grid",
          alignContent: "center",
          textAlign: "center",
          padding: "1.5rem",
          gap: "1rem",
          overflow: "auto",
        }}
      >
        <p
          style={{
            fontSize: "clamp(2rem, 9vw, 5rem)",
            fontWeight: 700,
            lineHeight: 1.2,
            wordBreak: "break-word",
          }}
        >
          {p.target}
        </p>
        {p.pronunciation && (
          <p
            style={{
              color: "var(--muted)",
              fontStyle: "italic",
              fontSize: "clamp(1rem, 3.5vw, 1.75rem)",
            }}
          >
            {p.pronunciation}
          </p>
        )}
        <p
          style={{
            color: "var(--muted)",
            fontSize: "clamp(1rem, 3vw, 1.5rem)",
          }}
        >
          {p.native}
        </p>

        {/* Tappable halves: left half = prev, right half = next.
            Sit above the text so the whole viewport is interactive,
            but transparent so the text underneath stays readable.
            aria-label so screen readers can find them. */}
        <button
          type="button"
          aria-label="Previous phrase"
          onClick={onPrev}
          style={tapZoneLeft}
        />
        <button
          type="button"
          aria-label="Next phrase"
          onClick={onNext}
          style={tapZoneRight}
        />
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "0.75rem 1.25rem",
          borderTop: "1px solid var(--line)",
          color: "var(--muted)",
          fontSize: "0.82rem",
        }}
      >
        <span>← tap left for previous</span>
        <span>tap right for next →</span>
      </div>
    </div>
  );
}

const tapZoneLeft: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  width: "50%",
  height: "100%",
  background: "transparent",
  border: 0,
  cursor: "pointer",
  // No focus ring — would distract from the phrase. Keyboard users
  // get arrow-key navigation instead.
  outline: "none",
};

const tapZoneRight: React.CSSProperties = {
  ...tapZoneLeft,
  left: "50%",
};

const primaryButton: React.CSSProperties = {
  background: "var(--accent)",
  color: "white",
  border: 0,
  padding: "0.55rem 1.1rem",
  borderRadius: "0.5rem",
  fontFamily: "inherit",
  fontWeight: 600,
  fontSize: "0.92rem",
  cursor: "pointer",
};

const secondaryButton: React.CSSProperties = {
  background: "transparent",
  color: "var(--ink)",
  border: "1px solid var(--line)",
  padding: "0.55rem 1.1rem",
  borderRadius: "0.5rem",
  fontFamily: "inherit",
  fontWeight: 600,
  fontSize: "0.92rem",
  cursor: "pointer",
};

const linkButton: React.CSSProperties = {
  background: "transparent",
  color: "var(--muted)",
  border: 0,
  padding: 0,
  fontFamily: "inherit",
  fontSize: "0.82rem",
  cursor: "pointer",
  textDecoration: "underline",
};
