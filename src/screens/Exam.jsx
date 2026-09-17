import { useMemo, useState } from "react";
import { S, C } from "../theme.js";
import { useBots, useBotVotes } from "../rooms/hooks.js";
import { trainModel } from "../lm/ngram.js";
import { botLeaderboard } from "../lm/scoring.js";
import { castBotVote } from "../rooms/api.js";
import { pct } from "../ml/net.js";
import { hashString } from "../lm/tokenize.js";
import { BotChat } from "../components/BotChat.jsx";

export function Exam({ code, uid, teams, team, isTeacher, flash }) {
  const { value: bots } = useBots(code, true);
  const { value: botVotes } = useBotVotes(code, true);
  const ids = Object.keys(bots || {});
  const [pickedId, setPickedId] = useState(null);
  const others = ids.filter((id) => id !== team?.id);
  const pool = others.length ? others : ids;
  const defaultId = pool.length ? pool[hashString(String(uid || "")) % pool.length] : null;
  const botId = pickedId && bots?.[pickedId] ? pickedId : defaultId;
  const model = useMemo(() => (botId && bots?.[botId]?.text ? trainModel(bots[botId].text) : null), [botId, bots]);
  const board = useMemo(() => botLeaderboard(botVotes, teams, bots), [botVotes, teams, bots]);
  const name = (id) => teams?.[id]?.name || "Unknown team";

  const onVote = async (entry, verdict) => {
    if (isTeacher) return;
    try { await castBotVote({ code, uid, askerTeamId: team?.id || null, botTeamId: botId, topic: entry.topic, verdict, q: entry.q }); }
    catch { flash("Could not reach the class board."); }
  };

  return (
    <main style={S.main}>
      <section style={{ ...S.card, gridColumn: "1 / -1" }} className="nl-fade">
        <h2 style={S.h2}>🎤 Cross-examination</h2>
        <p style={S.lede}>Every bot is now questioned by strangers. Which one survived?</p>
        {ids.length === 0 ? <p style={S.empty}>No bots yet. Teams send theirs from Train your bot.</p> : (
          <>
            <div style={S.pickRow}>
              {ids.map((id) => (
                <button key={id} type="button" className="nl-btn" style={{ ...S.topicChip, ...(id === botId ? S.topicChipOn : null) }} onClick={() => setPickedId(id)}>
                  🤖 {name(id)}{team?.id === id ? " (yours)" : ""}
                </button>
              ))}
            </div>
            {model && (
              <>
                <p style={S.hint}>Asking <b>{name(botId)}'s bot</b>{(bots[botId].sources || []).length ? <> · fed on: <b>{bots[botId].sources.join(", ")}</b>. Ask it about those, then about something else.</> : "."} Pick the topic, ask, vote. {team?.id === botId ? "Votes on your own bot don't count for strangers." : ""}</p>
                <BotChat key={botId} model={model} botName={`${name(botId)}'s bot`} requireVote={!isTeacher} onVote={onVote} />
              </>
            )}
          </>
        )}
      </section>

      <section style={{ ...S.card, gridColumn: "1 / -1" }}>
        <h2 style={S.h2}>Leaderboard</h2>
        {board.length === 0 ? <p style={S.empty}>Nothing to score yet.</p> : (
          <div style={S.table} role="table" aria-label="Bot leaderboard">
            <div style={{ ...S.tr, ...S.thead }} role="row"><span>Bot</span><span>Own team</span><span>Strangers</span><span /></div>
            {board.map((b, i) => (
              <div key={b.teamId} role="row" style={{ ...S.tr, ...(b.teamId === team?.id ? { outline: `3px solid ${C.sky}` } : null) }}>
                <span style={{ fontWeight: 800 }}>{i === 0 && b.foreign.pct != null ? "⭐ " : ""}{b.name}</span>
                <span style={{ color: C.muted, fontWeight: 700 }}>{pct(b.own.pct)}</span>
                <span style={{ fontWeight: 800, color: b.foreign.pct == null ? C.muted : b.foreign.pct > 0.6 ? C.leaf : b.foreign.pct > 0.3 ? C.mangoDeep : C.red }}>
                  {b.foreign.pct == null ? `${b.foreign.n} asked` : pct(b.foreign.pct)}
                </span>
                <span style={S.barCell}><span style={{ ...S.bar, width: `${(b.foreign.pct || 0) * 100}%`, background: i === 0 ? C.sun : C.sky }} /></span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
