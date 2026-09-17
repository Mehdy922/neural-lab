import { useRef, useState } from "react";
import { S, C } from "../theme.js";
import { TOPICS, VERDICTS } from "../lm/scoring.js";
import { generate, coverage } from "../lm/ngram.js";

export function BotChat({ model, botName = "HistoryBot", requireTopic = true, requireVote = true, onAsk, onVote, placeholder = "Ask anything…", maxQ = 120 }) {
  const [topic, setTopic] = useState(null);
  const [q, setQ] = useState("");
  const [entries, setEntries] = useState([]);
  const [hint, setHint] = useState("");
  const idRef = useRef(0);
  const last = entries[entries.length - 1];
  const needVote = requireVote && last && !last.verdict;

  const ask = (e) => {
    e?.preventDefault();
    const text = q.trim();
    if (!text) { setHint("Type a question first."); return; }
    if (requireTopic && !topic) { setHint("Pick a topic for your question first."); return; }
    if (needVote) { setHint("Vote on the last answer first."); return; }
    const cov = coverage(model, text);
    const { text: a, seededFrom } = generate(model, text, { seed: 0 });
    const entry = { id: ++idRef.current, q: text, a, topic, ...cov, seededFrom, attempt: 0, verdict: null };
    setEntries((es) => [...es, entry]); setQ(""); setHint("");
    onAsk?.(entry);
  };
  const askAgain = () => {
    if (!last) return;
    const attempt = last.attempt + 1;
    const { text: a, seededFrom } = generate(model, last.q, { seed: attempt });
    const upd = { ...last, a, seededFrom, attempt, verdict: null };
    setEntries((es) => [...es.slice(0, -1), upd]); setHint("");
    onAsk?.(upd);
  };
  const vote = (v) => {
    if (!last) return;
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
          return (
            <div key={en.id} style={{ display: "grid", gap: 6 }} className="nl-fade">
              <div style={S.bubbleQ}>{en.q}</div>
              <div style={S.bubbleA}>
                <div style={S.bubbleWho}>{botName}</div>
                {en.a}
                <div style={S.coverage}>Recognised {en.known} of {en.total} words in your question.</div>
                {isLast && (
                  <div style={S.voteRow}>
                    {requireVote && VERDICTS.map((v) => (
                      <button key={v.id} type="button" className="nl-btn" style={{ ...S.voteBtn, ...(en.verdict === v.id ? S.voteBtnOn : null) }} onClick={() => vote(v.id)}>
                        <span aria-hidden="true">{v.emoji}</span> {v.label}
                      </button>
                    ))}
                    <button type="button" className="nl-btn" style={{ ...S.tiny, color: C.skyDeep }} onClick={askAgain}>↺ Ask again</button>
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
