import { useEffect, useRef, useState } from "react";
import { S, C } from "../theme.js";
import { TOPICS, VERDICTS } from "../lm/scoring.js";
import { generate, coverage } from "../lm/ngram.js";

const coverageColor = (known, total) => {
  const r = total ? known / total : 0;
  return r >= 0.6 ? C.leaf : r >= 0.3 ? C.mangoDeep : C.red;
};

export function CoverageLine({ known, total }) {
  if (!total) return null;
  const text = known === 0 ? "It recognised none of your words. It answered anyway." : `Recognised ${known} of ${total} words in your question.`;
  return <div style={{ ...S.coverage, color: coverageColor(known, total) }}>{text}</div>;
}

export function BotChat({ model, botName = "HistoryBot", requireTopic = true, requireVote = true, onAsk, onVote, placeholder = "Ask anything…", maxQ = 120, typingMs = 600, maxAttempts = 2 }) {
  const [topic, setTopic] = useState(null);
  const [q, setQ] = useState("");
  const [entries, setEntries] = useState([]);
  const [hint, setHint] = useState("");
  const [typingId, setTypingId] = useState(null);   // id of the entry whose answer is still "being typed"
  const idRef = useRef(0);
  const timerRef = useRef(null);
  const last = entries[entries.length - 1];
  const needVote = requireVote && last && !last.verdict;

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const reveal = (id) => {
    if (typingMs > 0) {
      setTypingId(id);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setTypingId(null), typingMs);
    }
  };

  const ask = (e) => {
    e?.preventDefault();
    const text = q.trim();
    if (!text) { setHint("Type a question first."); return; }
    if (needVote) { setHint("Vote on the last answer first."); return; }   // a forgotten vote surfaces before a missing topic
    if (requireTopic && !topic) { setHint("Pick a topic for your question first."); return; }
    const cov = coverage(model, text);
    const { text: a, seededFrom } = generate(model, text, { seed: 0 });
    const entry = { id: ++idRef.current, q: text, a, topic, ...cov, seededFrom, attempt: 0, verdict: null };
    setEntries((es) => [...es, entry]); setQ(""); setHint(""); setTopic(null);
    reveal(entry.id);
    onAsk?.(entry);
  };
  const askAgain = () => {
    if (!last || last.attempt >= maxAttempts) return;
    const attempt = last.attempt + 1;
    const { text: a, seededFrom } = generate(model, last.q, { seed: attempt });
    const entry = { ...last, id: ++idRef.current, a, seededFrom, attempt, verdict: null };
    setEntries((es) => [...es, entry]); setHint("");
    reveal(entry.id);
    onAsk?.(entry);
  };
  const vote = (v) => {
    if (!last || last.verdict) return;
    const upd = { ...last, verdict: v };
    setEntries((es) => [...es.slice(0, -1), upd]); setHint("");
    onVote?.(upd, v);
  };

  return (
    <div>
      {requireTopic && (
        <div style={S.pickRow} role="group" aria-label="Topic of your question">
          {TOPICS.map((t) => (
            <button key={t.id} type="button" className="nl-btn" style={{ ...S.topicChip, ...(topic === t.id ? S.topicChipOn : null) }} onClick={() => setTopic(t.id)}>
              <span aria-hidden="true">{t.emoji}</span> {t.label}
            </button>
          ))}
        </div>
      )}
      <form onSubmit={ask} style={S.row}>
        <input className="nl-in" style={{ ...S.input, flex: 1, minWidth: 180 }} value={q} maxLength={maxQ} placeholder={placeholder}
          onChange={(e) => setQ(e.target.value)} aria-label="Your question" />
        <button type="submit" className="nl-btn" style={S.primary}>Ask</button>
      </form>
      {hint && <p style={S.hintText}>{hint}</p>}

      <div style={S.chatWrap}>
        {entries.map((en, i) => {
          const isLast = i === entries.length - 1;
          const typing = en.id === typingId;
          return (
            <div key={en.id} style={{ display: "grid", gap: 6 }} className="nl-fade">
              <div style={S.bubbleQ}>{en.q}{en.attempt ? <span style={{ color: C.muted, fontWeight: 700 }}> · try {en.attempt + 1}</span> : null}</div>
              <div style={S.bubbleA}>
                <div style={S.bubbleWho}><span aria-hidden="true">🤖</span> {botName}</div>
                {typing ? <span role="status" style={{ color: C.muted }}>{botName} is typing…</span> : en.a}
                {!typing && <CoverageLine known={en.known} total={en.total} />}
                {isLast && !typing && (
                  <div style={S.voteRow}>
                    {requireVote && VERDICTS.map((v) => (
                      <button key={v.id} type="button" className="nl-btn" disabled={!!en.verdict} style={{ ...S.voteBtn, ...(en.verdict === v.id ? S.voteBtnOn : null) }} onClick={() => vote(v.id)}>
                        <span aria-hidden="true">{v.emoji}</span> {v.label}
                      </button>
                    ))}
                    {en.attempt < maxAttempts && (
                      <button type="button" className="nl-btn" style={{ ...S.tiny, color: C.skyDeep }} onClick={askAgain}>↺ Ask again</button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
