import { useMemo, useState } from "react";
import { S, C } from "../theme.js";
import { useVotes, useBots, useBotVotes } from "../rooms/hooks.js";
import { topicAccuracy, splitHistoryVsRest, recentVotes, botLeaderboard, botTopicTallies, nonsenseOfTheDay, MIN_VOTES_TO_SHOW, TOPICS, VERDICTS } from "../lm/scoring.js";
import { isProjectorSafe } from "../lm/projectorFilter.js";
import { HISTORY_TEXT } from "../lm/texts/index.js";
import { trainModel, coverage } from "../lm/ngram.js";
import { pct } from "../ml/net.js";
import { Corpus } from "../components/Corpus.jsx";

const MIN_TOPIC_VOTES = 3;
const barColor = (p) => (p == null ? C.line : p > 0.6 ? C.leaf : p > 0.3 ? C.mangoDeep : C.red);
const verdictEmoji = (v) => VERDICTS.find((x) => x.id === v)?.emoji || "";
const verdictLabel = (v) => VERDICTS.find((x) => x.id === v)?.label || v;
const topicEmoji = (t) => TOPICS.find((x) => x.id === t)?.emoji || "";

function TopicStrip({ rows, label }) {
  return (
    <span aria-label={label} title={rows.map((r) => `${r.label}: ${r.n ? pct(r.pct) : "—"} (${r.n})`).join(" · ")} style={{ display: "inline-flex", gap: 3, alignItems: "flex-end", height: 22 }}>
      {rows.map((r) => (
        <span key={r.topic} style={{ width: 14, height: r.n ? 4 + Math.round((r.pct || 0) * 18) : 4, borderRadius: 3, background: r.n ? barColor(r.pct) : C.line }} />
      ))}
    </span>
  );
}

export function Scoreboard({ code, teams, meta, isTeacher }) {
  const { value: votes } = useVotes(code, true);
  const examOpen = meta?.phase === "exam";
  const revealed = meta?.phase !== "chat";
  const { value: bots } = useBots(code, examOpen);
  const { value: botVotes } = useBotVotes(code, examOpen);
  const model = useMemo(() => trainModel(HISTORY_TEXT), []);
  const rows = useMemo(() => topicAccuracy(votes), [votes]);
  const split = useMemo(() => splitHistoryVsRest(votes), [votes]);
  // Teacher-hidden vote ids, remembered for this room across tab switches (browser session only; no database write).
  const hiddenKey = `nl.hidden.${code}`;
  const [hidden, setHidden] = useState(() => {
    try { const raw = JSON.parse(sessionStorage.getItem(hiddenKey) || "[]"); return new Set(Array.isArray(raw) ? raw : []); }
    catch { return new Set(); }
  });
  const hide = (id) => {
    const next = new Set([...hidden, id]);
    setHidden(next);
    try { sessionStorage.setItem(hiddenKey, JSON.stringify([...next])); } catch { /* storage unavailable: hidden for this mount only */ }
  };
  // Everything the projector shows is drawn from the "safe" votes: not denylisted, not hidden by the teacher.
  const safeVotes = useMemo(() => Object.fromEntries(Object.entries(votes || {}).filter(([id, r]) => isProjectorSafe(r?.q) && !hidden.has(id))), [votes, hidden]);
  const feed = useMemo(() => recentVotes(safeVotes, 8), [safeVotes]);
  const nonsense = useMemo(() => nonsenseOfTheDay(safeVotes), [safeVotes]);
  const board = useMemo(() => botLeaderboard(botVotes, teams, bots), [botVotes, teams, bots]);
  const [showCorpus, setShowCorpus] = useState(false);
  const [focusId, setFocusId] = useState(null);
  const focus = feed.find((f) => f.id === focusId) || feed[0] || null;
  const highlight = useMemo(() => (focus ? coverage(model, focus.q).knownWords : []), [model, focus]);
  const enough = split.total >= MIN_VOTES_TO_SHOW;

  return (
    <main style={S.wide} className="nl-fade">
      <h1 style={S.h1}>📊 Scoreboard</h1>

      {!revealed ? (
        <p style={S.lede}>Keep asking. <b>{split.total} answers judged so far.</b> The scoreboard opens when the teacher reveals it.</p>
      ) : !enough ? (
        <p style={S.empty}>Waiting for questions. {split.total} of {MIN_VOTES_TO_SHOW} answers voted on so far.</p>
      ) : (
        <>
          <p style={S.lede}>
            {split.total} answers were judged. It was right about <b>{pct(split.history.pct)} of history</b> and <b>{pct(split.rest.pct)} of everything else</b>.
          </p>
          <div style={S.table} role="table" aria-label="Accuracy by topic">
            {rows.map((r) => {
              const shown = r.n >= MIN_TOPIC_VOTES;
              return (
                <div key={r.topic} role="row" aria-label={r.label} style={{ ...S.tr, gridTemplateColumns: "1.2fr .5fr .6fr 2fr", opacity: shown ? 1 : 0.6 }}>
                  <span style={{ fontWeight: 800 }}><span aria-hidden="true">{r.emoji}</span> {r.label}</span>
                  <span style={{ color: C.muted, fontWeight: 700 }}>{r.n} asked</span>
                  <span style={{ color: shown ? barColor(r.pct) : C.muted, fontWeight: 800 }}>{shown ? pct(r.pct) : "—"}</span>
                  <span style={S.barCell}><span style={{ ...S.bar, width: `${shown ? (r.pct || 0) * 100 : 0}%`, background: barColor(shown ? r.pct : null) }} /></span>
                </div>
              );
            })}
          </div>
          <div style={S.qBox}>
            <div style={S.qKick}>Work this out before anyone tells you</div>
            <p style={S.q}>It answered every single question, in full sentences, without hesitating. Look at the bars.</p>
            <p style={S.qBig}>It never once said 'I don't know'. Why not?</p>
          </div>
          {nonsense && (
            <div style={{ ...S.qBox, borderColor: C.berry }}>
              <div style={{ ...S.qKick, color: C.berry }}>Nonsense of the day</div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                <p style={{ ...S.q, margin: 0 }}><span aria-hidden="true">{topicEmoji(nonsense.topic)}</span> {nonsense.q}</p>
                {isTeacher && (
                  <button type="button" className="nl-btn" aria-label={`Hide ${nonsense.q}`} style={{ ...S.tiny, color: C.muted }} onClick={() => hide(nonsense.id)}>✕</button>
                )}
              </div>
              <p style={{ ...S.qBig, fontSize: 22 }}>{nonsense.a}</p>
              <p style={S.coverage}>It recognised {nonsense.known} of {nonsense.total} words. It answered anyway.</p>
            </div>
          )}
        </>
      )}

      <div style={{ ...S.card, marginTop: 20 }}>
        <h2 style={S.h2}>Latest questions</h2>
        {isTeacher && <p style={S.hint}>Tap a question to highlight its words in the text below. Press ✕ to hide one from the projector.</p>}
        <div style={{ display: "grid", gap: 8 }}>
          {feed.map((f) => (
            <div key={f.id} style={{ ...S.feedItem, outline: f.id === focus?.id ? `3px solid ${C.sun}` : "none", cursor: "pointer" }} onClick={() => setFocusId(f.id)}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontWeight: 800 }}><span aria-hidden="true">{topicEmoji(f.topic)}</span> {f.q}</div>
                {isTeacher && (
                  <button type="button" className="nl-btn" aria-label={`Hide ${f.q}`} style={{ ...S.tiny, color: C.muted }} onClick={(e) => { e.stopPropagation(); hide(f.id); }}>✕</button>
                )}
              </div>
              <div style={{ color: C.muted }}>{f.a}</div>
              <div style={S.coverage}>
                {verdictEmoji(f.verdict)} {verdictLabel(f.verdict)}
                {f.total === 0 ? null : f.known === 0 ? " · recognised none of the words" : ` · recognised ${f.known} of ${f.total} words`}
              </div>
            </div>
          ))}
          {feed.length === 0 && <p style={S.empty}>No questions yet.</p>}
        </div>
      </div>

      {revealed && (
        <div style={{ ...S.card, marginTop: 20 }}>
          <button className="nl-btn" style={S.accent} onClick={() => setShowCorpus((v) => !v)}>
            {showCorpus ? "Hide what it has read" : "Show me everything it has ever read"}
          </button>
          {showCorpus && (
            <div style={{ marginTop: 14 }}>
              <p style={{ ...S.hint, margin: "0 0 8px" }}>
                This is its whole mind. {focus ? (highlight.length === 0 ? <>It recognised none of the words from “{focus.q}”.</> : <>Highlighted: the words from “{focus.q}” it recognised.</>) : null}
              </p>
              {isTeacher ? (
                // Projector: break out of the 960 px page column so the five-column corpus fits on one screen.
                <div style={{ marginLeft: "calc(50% - 50vw)", width: "100vw", padding: "0 24px", boxSizing: "border-box" }}>
                  <Corpus text={HISTORY_TEXT} highlight={highlight} compact />
                </div>
              ) : (
                <Corpus text={HISTORY_TEXT} highlight={highlight} />
              )}
            </div>
          )}
        </div>
      )}

      {examOpen && (
        <div style={{ marginTop: 28 }}>
          <h2 style={S.h2}>🎤 Cross-examination</h2>
          <p style={S.lede}>Every bot is now questioned by strangers. Which one survived?</p>
          <p style={S.hint}>Each strip shows how often it was right, topic by topic, in this order: History · Science · Sport · Maths · Everyday · Other. Every bot has one bump. Where is it?</p>
          {board.length === 0 ? <p style={S.empty}>No bots sent yet.</p> : (
            <div style={S.table} role="table" aria-label="Bot leaderboard">
              <div style={{ ...S.tr, ...S.thead, gridTemplateColumns: "1.4fr .6fr .6fr 1fr 2fr" }} role="row"><span>Bot</span><span>Own team</span><span>Strangers</span><span>By topic</span><span /></div>
              {board.map((b, i) => (
                <div key={b.teamId} role="row" style={{ ...S.tr, gridTemplateColumns: "1.4fr .6fr .6fr 1fr 2fr" }}>
                  <span style={{ fontWeight: 800, color: i === 0 && b.foreign.pct != null ? C.mangoDeep : C.ink }}>{i === 0 && b.foreign.pct != null ? "⭐ " : ""}{b.name}</span>
                  <span style={{ color: C.muted, fontWeight: 700 }}>{pct(b.own.pct)}</span>
                  <span style={{ color: barColor(b.foreign.pct), fontWeight: 800 }}>{b.foreign.pct == null ? `${b.foreign.n} asked` : pct(b.foreign.pct)}</span>
                  <TopicStrip rows={botTopicTallies(botVotes, b.teamId)} label={`Accuracy by topic for ${b.name}`} />
                  <span style={S.barCell}><span style={{ ...S.bar, width: `${(b.foreign.pct || 0) * 100}%`, background: i === 0 ? C.sun : C.sky }} /></span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
