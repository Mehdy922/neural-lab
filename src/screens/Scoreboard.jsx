import { useMemo, useState } from "react";
import { S, C } from "../theme.js";
import { useVotes, useBots, useBotVotes } from "../rooms/hooks.js";
import { topicAccuracy, splitHistoryVsRest, recentVotes, botLeaderboard, MIN_VOTES_TO_SHOW, TOPICS, VERDICTS } from "../lm/scoring.js";
import { HISTORY_TEXT } from "../lm/texts/index.js";
import { pct } from "../ml/net.js";
import { Corpus } from "../components/Corpus.jsx";

const barColor = (p) => (p == null ? C.line : p > 0.6 ? C.leaf : p > 0.3 ? C.mangoDeep : C.red);
const verdictEmoji = (v) => VERDICTS.find((x) => x.id === v)?.emoji || "";
const topicEmoji = (t) => TOPICS.find((x) => x.id === t)?.emoji || "";

export function Scoreboard({ code, teams, meta }) {
  const { value: votes } = useVotes(code, true);
  const examOpen = meta?.phase === "exam";
  const { value: bots } = useBots(code, examOpen);
  const { value: botVotes } = useBotVotes(code, examOpen);
  const rows = useMemo(() => topicAccuracy(votes), [votes]);
  const split = useMemo(() => splitHistoryVsRest(votes), [votes]);
  const feed = useMemo(() => recentVotes(votes, 8), [votes]);
  const board = useMemo(() => botLeaderboard(botVotes, teams, bots), [botVotes, teams, bots]);
  const [showCorpus, setShowCorpus] = useState(false);

  return (
    <main style={S.wide} className="nl-fade">
      <h1 style={S.h1}>📊 Scoreboard</h1>
      {split.total < MIN_VOTES_TO_SHOW ? (
        <p style={S.empty}>Waiting for questions. {split.total} of {MIN_VOTES_TO_SHOW} answers voted on so far.</p>
      ) : (
        <>
          <p style={S.lede}>
            It answered {split.total} questions. It was right about <b>{pct(split.history.pct)} of history</b> and <b>{pct(split.rest.pct)} of everything else</b>.
          </p>
          <div style={S.table} role="table" aria-label="Accuracy by topic">
            {rows.map((r) => (
              <div key={r.topic} role="row" style={{ ...S.tr, gridTemplateColumns: "1.2fr .5fr .6fr 2fr" }}>
                <span style={{ fontWeight: 800 }}><span aria-hidden="true">{r.emoji}</span> {r.label}</span>
                <span style={{ color: C.muted, fontWeight: 700 }}>{r.n} asked</span>
                <span style={{ color: barColor(r.pct), fontWeight: 800 }}>{pct(r.pct)}</span>
                <span style={S.barCell}><span style={{ ...S.bar, width: `${(r.pct || 0) * 100}%`, background: barColor(r.pct) }} /></span>
              </div>
            ))}
          </div>

          <div style={S.qBox}>
            <div style={S.qKick}>Work this out before anyone tells you</div>
            <p style={S.q}>It answered every single question, in full sentences, without hesitating. Look at the bars.</p>
            <p style={S.qBig}>It never once said 'I don't know'. Why not?</p>
          </div>

          <div style={{ ...S.card, marginTop: 20 }}>
            <h2 style={S.h2}>Latest questions</h2>
            <div style={{ display: "grid", gap: 8 }}>
              {feed.map((f, i) => (
                <div key={i} style={S.feedItem}>
                  <div style={{ fontWeight: 800 }}><span aria-hidden="true">{topicEmoji(f.topic)}</span> {f.q}</div>
                  <div style={{ color: C.muted }}>{f.a}</div>
                  <div style={S.coverage}>{verdictEmoji(f.verdict)} {f.verdict} · recognised {f.known} of {f.total} words</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...S.card, marginTop: 20 }}>
            <button className="nl-btn" style={S.accent} onClick={() => setShowCorpus((v) => !v)}>
              {showCorpus ? "Hide what it has read" : "Show me everything it has ever read"}
            </button>
            {showCorpus && <div style={{ marginTop: 14 }}><Corpus text={HISTORY_TEXT} /></div>}
          </div>

          {examOpen && (
            <div style={{ marginTop: 28 }}>
              <h2 style={S.h2}>🎤 Cross-examination</h2>
              <p style={S.lede}>Every bot is now questioned by strangers. Which one survived?</p>
              {board.length === 0 ? <p style={S.empty}>No bots sent yet.</p> : (
                <div style={S.table} role="table" aria-label="Bot leaderboard">
                  <div style={{ ...S.tr, ...S.thead }} role="row"><span>Bot</span><span>Own team</span><span>Strangers</span><span /></div>
                  {board.map((b, i) => (
                    <div key={b.teamId} role="row" style={S.tr}>
                      <span style={{ fontWeight: 800, color: i === 0 && b.foreign.pct != null ? C.mangoDeep : C.ink }}>{i === 0 && b.foreign.pct != null ? "⭐ " : ""}{b.name}</span>
                      <span style={{ color: C.muted, fontWeight: 700 }}>{pct(b.own.pct)}</span>
                      <span style={{ color: barColor(b.foreign.pct), fontWeight: 800 }}>{b.foreign.pct == null ? `${b.foreign.n} asked` : pct(b.foreign.pct)}</span>
                      <span style={S.barCell}><span style={{ ...S.bar, width: `${(b.foreign.pct || 0) * 100}%`, background: i === 0 ? C.sun : C.sky }} /></span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}
