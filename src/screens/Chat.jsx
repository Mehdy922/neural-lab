import { useMemo, useState } from "react";
import { S } from "../theme.js";
import { HISTORY_TEXT } from "../lm/texts/index.js";
import { trainModel, modelStats } from "../lm/ngram.js";
import { castVote } from "../rooms/api.js";
import { BotChat } from "../components/BotChat.jsx";
import { Corpus } from "../components/Corpus.jsx";

export function Chat({ code, uid, isTeacher, flash }) {
  const model = useMemo(() => trainModel(HISTORY_TEXT), []);
  const stats = modelStats(model);
  const [showCorpus, setShowCorpus] = useState(false);
  const [lastKnown, setLastKnown] = useState([]);

  const onVote = async (entry, verdict) => {
    if (isTeacher) return; // teachers can try the bot; only students' votes count
    try { await castVote({ code, uid, topic: entry.topic, verdict, q: entry.q, a: entry.a, known: entry.known, total: entry.total }); }
    catch { flash("Could not reach the class board."); }
  };

  return (
    <main style={S.main}>
      <section style={{ ...S.card, gridColumn: "1 / -1" }} className="nl-fade">
        <h2 style={S.h2}>💬 HistoryBot</h2>
        <p style={S.lede}>HistoryBot has read one thing in its life: 2,000 words about South Asian history. Ask it anything.</p>
        <p style={S.hint}>Pick the topic of your question, ask, then tell the class whether the answer was right. {isTeacher ? "(Teacher votes are not counted.)" : ""}</p>
        <div style={{ ...S.qBox, marginBottom: 14 }}>
          <div style={S.qKick}>Your mission</div>
          <p style={{ ...S.q, margin: 0 }}>Find one answer it gets right, one it gets wrong, and one that is pure nonsense. Then try to trick it.</p>
        </div>
        <BotChat model={model} botName="HistoryBot" requireVote={!isTeacher} onAsk={(en) => setLastKnown(en.knownWords)} onVote={onVote} />
      </section>

      <section style={{ ...S.card, gridColumn: "1 / -1" }}>
        <div style={S.row}>
          <button className="nl-btn" style={S.accent} onClick={() => setShowCorpus((v) => !v)}>
            {showCorpus ? "Hide what it has read" : "Show me everything it has ever read"}
          </button>
          <span style={S.hint}>{stats.words.toLocaleString()} words · {stats.vocab.toLocaleString()} different words. That is its whole mind.</span>
        </div>
        {showCorpus && (
          <div style={{ marginTop: 14 }}>
            {lastKnown.length > 0 && <p style={{ ...S.hint, margin: "0 0 8px" }}>Highlighted: the words from your last question it recognised.</p>}
            <Corpus text={HISTORY_TEXT} highlight={lastKnown} />
          </div>
        )}
      </section>
    </main>
  );
}
