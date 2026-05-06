import { useEffect, useMemo, useState } from "react";
import { Shell } from "./components/Shell";

// Tool for preparing language-exchange phrases. You list the lines you
// want to say in your target language, organize by topic, and step
// through them at the meetup so you can practice with strangers.

type Direction = "to-mandarin" | "to-english";

interface Phrase {
  id: string;
  direction: Direction;
  target: string;        // what you want to say (in the target language)
  native: string;        // translation in your native language
  pinyin: string;        // optional pronunciation guide (Mandarin)
  topic: string;         // free-form tag, e.g. "intro", "weather"
  practiced: boolean;
  createdAt: number;
}

const STORAGE_KEY = "mandarin-english:phrases";
const DIRECTION_KEY = "mandarin-english:direction";

const DIRECTION_LABEL: Record<Direction, string> = {
  "to-mandarin": "I'm practising Mandarin",
  "to-english": "I'm practising English",
};

const SEED_PHRASES: Phrase[] = [
  {
    id: "seed-1",
    direction: "to-mandarin",
    target: "你好,我叫…",
    native: "Hi, my name is…",
    pinyin: "nǐ hǎo, wǒ jiào…",
    topic: "intro",
    practiced: false,
    createdAt: Date.now() - 4,
  },
  {
    id: "seed-2",
    direction: "to-mandarin",
    target: "我来自悉尼。",
    native: "I'm from Sydney.",
    pinyin: "wǒ lái zì xī ní.",
    topic: "intro",
    practiced: false,
    createdAt: Date.now() - 3,
  },
  {
    id: "seed-3",
    direction: "to-english",
    target: "What do you do for work?",
    native: "你做什么工作?",
    pinyin: "",
    topic: "intro",
    practiced: false,
    createdAt: Date.now() - 2,
  },
  {
    id: "seed-4",
    direction: "to-english",
    target: "How long have you lived in Sydney?",
    native: "你在悉尼住了多久?",
    pinyin: "",
    topic: "smalltalk",
    practiced: false,
    createdAt: Date.now() - 1,
  },
];

function loadPhrases(): Phrase[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return SEED_PHRASES;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Phrase[]) : [];
  } catch {
    return [];
  }
}

function loadDirection(): Direction {
  const raw = localStorage.getItem(DIRECTION_KEY);
  return raw === "to-english" ? "to-english" : "to-mandarin";
}

function newId(): string {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

type View = "list" | "practice";

export default function App() {
  const [phrases, setPhrases] = useState<Phrase[]>(() => loadPhrases());
  const [direction, setDirection] = useState<Direction>(() => loadDirection());
  const [view, setView] = useState<View>("list");
  const [topicFilter, setTopicFilter] = useState<string>("");
  const [showOnlyUnpractised, setShowOnlyUnpractised] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(phrases));
  }, [phrases]);

  useEffect(() => {
    localStorage.setItem(DIRECTION_KEY, direction);
  }, [direction]);

  const filtered = useMemo(() => {
    return phrases
      .filter((p) => p.direction === direction)
      .filter((p) => (topicFilter ? p.topic === topicFilter : true))
      .filter((p) => (showOnlyUnpractised ? !p.practiced : true))
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [phrases, direction, topicFilter, showOnlyUnpractised]);

  const topics = useMemo(() => {
    const set = new Set(phrases.filter((p) => p.direction === direction).map((p) => p.topic).filter(Boolean));
    return Array.from(set).sort();
  }, [phrases, direction]);

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
      prev.map((p) => (p.direction === direction ? { ...p, practiced: false } : p)),
    );
  }

  return (
    <Shell>
      <div style={{ maxWidth: "780px", margin: "0 auto", padding: "1rem 0 4rem" }}>
        <Header />

        <DirectionPicker value={direction} onChange={setDirection} />

        <ViewTabs view={view} onChange={setView} />

        {view === "list" ? (
          <ListView
            phrases={filtered}
            topics={topics}
            topicFilter={topicFilter}
            onTopicFilterChange={setTopicFilter}
            showOnlyUnpractised={showOnlyUnpractised}
            onShowOnlyUnpractisedChange={setShowOnlyUnpractised}
            direction={direction}
            onAdd={add}
            onUpdate={update}
            onRemove={remove}
          />
        ) : (
          <PracticeView phrases={filtered} onMarkPractised={(id) => update(id, { practiced: true })} onResetAll={resetPracticed} />
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
        Mandarin–English prep
      </h1>
      <p style={{ color: "var(--muted)", lineHeight: 1.55 }}>
        Prepare phrases you want to say at the meetup, then practise them out loud before you speak with strangers. All saved in your browser.
      </p>
    </div>
  );
}

function DirectionPicker({ value, onChange }: { value: Direction; onChange: (v: Direction) => void }) {
  return (
    <div
      style={{
        display: "flex",
        gap: "0.5rem",
        padding: "0.35rem",
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: "0.75rem",
        marginBottom: "1rem",
      }}
    >
      {(["to-mandarin", "to-english"] as const).map((d) => {
        const active = value === d;
        return (
          <button
            key={d}
            type="button"
            onClick={() => onChange(d)}
            style={{
              flex: 1,
              padding: "0.55rem 0.75rem",
              borderRadius: "0.5rem",
              fontFamily: "inherit",
              fontWeight: 600,
              fontSize: "0.9rem",
              cursor: "pointer",
              border: 0,
              background: active ? "var(--accent)" : "transparent",
              color: active ? "white" : "var(--ink)",
            }}
          >
            {DIRECTION_LABEL[d]}
          </button>
        );
      })}
    </div>
  );
}

function ViewTabs({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div style={{ display: "flex", gap: "1.5rem", marginBottom: "1rem", borderBottom: "1px solid var(--line)" }}>
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
  phrases: Phrase[];
  topics: string[];
  topicFilter: string;
  onTopicFilterChange: (t: string) => void;
  showOnlyUnpractised: boolean;
  onShowOnlyUnpractisedChange: (v: boolean) => void;
  direction: Direction;
  onAdd: (p: Omit<Phrase, "id" | "practiced" | "createdAt">) => void;
  onUpdate: (id: string, patch: Partial<Phrase>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <>
      <AddForm direction={props.direction} onAdd={props.onAdd} />

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

function AddForm({
  direction,
  onAdd,
}: {
  direction: Direction;
  onAdd: (p: Omit<Phrase, "id" | "practiced" | "createdAt">) => void;
}) {
  const [target, setTarget] = useState("");
  const [native, setNative] = useState("");
  const [pinyin, setPinyin] = useState("");
  const [topic, setTopic] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!target.trim() || !native.trim()) return;
    onAdd({
      direction,
      target: target.trim(),
      native: native.trim(),
      pinyin: pinyin.trim(),
      topic: topic.trim(),
    });
    setTarget("");
    setNative("");
    setPinyin("");
    // keep topic — usually you batch-add to one topic at a time
  }

  const targetIsMandarin = direction === "to-mandarin";

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
        label={targetIsMandarin ? "中文 (what you'll say)" : "English (what you'll say)"}
        value={target}
        onChange={setTarget}
        placeholder={targetIsMandarin ? "你好,我叫…" : "Hi, my name is…"}
      />
      <Field
        label={targetIsMandarin ? "English meaning" : "中文 meaning"}
        value={native}
        onChange={setNative}
        placeholder={targetIsMandarin ? "Hi, my name is…" : "你好,我叫…"}
      />
      {targetIsMandarin && (
        <Field
          label="Pinyin (optional)"
          value={pinyin}
          onChange={setPinyin}
          placeholder="nǐ hǎo, wǒ jiào…"
        />
      )}
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label style={{ display: "grid", gap: "0.25rem" }}>
      <span style={{ fontSize: "0.78rem", color: "var(--muted)", fontWeight: 600 }}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
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
        <EditForm phrase={phrase} onSave={(patch) => { onUpdate(phrase.id, patch); setEditing(false); }} onCancel={() => setEditing(false)} />
      ) : (
        <>
          <p style={{ fontSize: "1.05rem", fontWeight: 600, lineHeight: 1.45 }}>{phrase.target}</p>
          {phrase.pinyin && (
            <p style={{ color: "var(--muted)", fontSize: "0.85rem", fontStyle: "italic" }}>{phrase.pinyin}</p>
          )}
          <p style={{ color: "var(--muted)", fontSize: "0.92rem" }}>{phrase.native}</p>
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", marginTop: "0.4rem", fontSize: "0.82rem" }}>
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
            <label style={{ display: "flex", gap: "0.3rem", alignItems: "center", color: "var(--muted)", cursor: "pointer" }}>
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
  const [pinyin, setPinyin] = useState(phrase.pinyin);
  const [topic, setTopic] = useState(phrase.topic);
  const targetIsMandarin = phrase.direction === "to-mandarin";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSave({ target: target.trim(), native: native.trim(), pinyin: pinyin.trim(), topic: topic.trim() });
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: "0.5rem" }}>
      <Field
        label={targetIsMandarin ? "中文" : "English"}
        value={target}
        onChange={setTarget}
      />
      <Field label={targetIsMandarin ? "English meaning" : "中文 meaning"} value={native} onChange={setNative} />
      {targetIsMandarin && <Field label="Pinyin" value={pinyin} onChange={setPinyin} />}
      <Field label="Topic" value={topic} onChange={setTopic} />
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
        <button type="submit" style={primaryButton}>Save</button>
        <button type="button" onClick={onCancel} style={secondaryButton}>Cancel</button>
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

  if (phrases.length === 0) {
    return (
      <p style={{ color: "var(--muted)", padding: "2rem 0", textAlign: "center" }}>
        No phrases for this direction yet. Add some in the List tab.
      </p>
    );
  }

  const safeIndex = Math.min(index, phrases.length - 1);
  const p = phrases[safeIndex]!;
  const allPractised = phrases.every((q) => q.practiced);

  return (
    <div>
      <div style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "1.25rem" }}>
        {safeIndex + 1} / {phrases.length}
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
        {p.pinyin && <p style={{ color: "var(--muted)", fontStyle: "italic" }}>{p.pinyin}</p>}
        <p style={{ color: "var(--muted)" }}>{p.native}</p>
        {p.topic && (
          <p style={{ color: "var(--muted)", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {p.topic}
          </p>
        )}
      </div>

      <div style={{ display: "flex", gap: "0.6rem", marginTop: "1.25rem", flexWrap: "wrap" }}>
        <button
          type="button"
          style={secondaryButton}
          onClick={() => setIndex((i) => (i - 1 + phrases.length) % phrases.length)}
        >
          ← Previous
        </button>
        <button
          type="button"
          style={primaryButton}
          onClick={() => {
            onMarkPractised(p.id);
            setIndex((i) => (i + 1) % phrases.length);
          }}
        >
          Got it — next →
        </button>
        <button
          type="button"
          style={secondaryButton}
          onClick={() => setIndex((i) => (i + 1) % phrases.length)}
        >
          Skip
        </button>
      </div>

      {allPractised && (
        <div style={{ marginTop: "1.5rem", padding: "1rem", border: "1px solid var(--line)", borderRadius: "0.5rem", textAlign: "center" }}>
          <p style={{ fontWeight: 600 }}>All practised. 🎉</p>
          <button type="button" onClick={onResetAll} style={{ ...secondaryButton, marginTop: "0.6rem" }}>
            Reset and go again
          </button>
        </div>
      )}
    </div>
  );
}

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
