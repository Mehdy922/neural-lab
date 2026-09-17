import { useMemo, useState } from "react";
import { S, C } from "../theme.js";
import { STARTER_TEXTS } from "../lm/texts/index.js";
import { trainModel, modelStats } from "../lm/ngram.js";
import { tokenize, isWord } from "../lm/tokenize.js";
import { sendBot, MAX_BOT_TEXT, MAX_OWN_TEXT, MIN_BOT_WORDS } from "../rooms/api.js";
import { useTeamBot } from "../rooms/hooks.js";
import { BotChat } from "../components/BotChat.jsx";

const countWords = (t) => tokenize(t).filter(isWord).length;

export function TrainBot({ code, uid, team, members, isTeacher, flash }) {
  const [picked, setPicked] = useState([]);       // starter ids
  const [own, setOwn] = useState("");
  const [model, setModel] = useState(null);
  const [sending, setSending] = useState(false);
  const sent = useTeamBot(code, team?.id);

  const combined = useMemo(() => [...picked.map((id) => STARTER_TEXTS.find((t) => t.id === id)?.text || ""), own.trim()].filter(Boolean).join("\n\n"), [picked, own]);
  const words = useMemo(() => countWords(combined), [combined]);
  const ownWords = useMemo(() => countWords(own), [own]);
  const ready = words >= MIN_BOT_WORDS && combined.length <= MAX_BOT_TEXT;

  const toggle = (id) => { setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])); setModel(null); };
  const train = () => setModel(trainModel(combined));
  const send = async () => {
    if (!model) return flash("Train it first.");
    if (!team) return flash(isTeacher ? "Teachers don't enter the cross-examination. Join a team to try it." : "Join a team in the Lobby first.");
    if (sent.value && !window.confirm(`${team.name} already sent a bot (${(sent.value.sources || []).join(", ") || "own text"}). Replace it?`)) return;
    if (combined.length > MAX_BOT_TEXT) return flash(`Too long to send: keep it under ${MAX_BOT_TEXT.toLocaleString()} characters.`);
    setSending(true);
    try {
      await sendBot({ code, teamId: team.id, uid, text: combined, sources: [...picked, ...(own.trim() ? ["own"] : [])] });
      flash("Bot sent to the class! 🤖");
    } catch { flash("Could not reach the class board."); }
    finally { setSending(false); }
  };

  return (
    <main style={S.main}>
      <section style={S.card} className="nl-fade">
        <h2 style={S.h2}>🧪 Feed your bot</h2>
        <p style={S.hint}>Pick what your bot reads. Everything you tick is the whole of what it will ever know.</p>
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {STARTER_TEXTS.map((t) => (
            <button key={t.id} type="button" className="nl-btn" style={{ ...S.textCard, ...(picked.includes(t.id) ? S.textCardOn : null) }} onClick={() => toggle(t.id)}>
              <span style={{ fontSize: 22, marginRight: 8 }} aria-hidden="true">{t.emoji}</span>
              <b>{t.title}</b> <span style={{ color: C.muted, fontWeight: 700 }}>· {t.words} words</span>
            </button>
          ))}
        </div>
        <div style={S.field}>
          <label style={S.label} htmlFor="own-text">Your own text (optional)</label>
          <textarea id="own-text" className="nl-in" style={{ ...S.input, minHeight: 110, resize: "vertical", fontSize: 14 }} value={own}
            maxLength={MAX_OWN_TEXT} placeholder="Paste anything: a page of notes, a story, a match report…" onChange={(e) => { setOwn(e.target.value); setModel(null); }}
            aria-label="Your own text" />
          <div style={S.counter}>{ownWords} words · {own.length.toLocaleString()} / {MAX_OWN_TEXT.toLocaleString()} characters</div>
          <p style={S.hint}>Tip: copy a paragraph from your notes or any website. Typing 150 words on a phone takes too long.</p>
        </div>
        <button className="nl-btn" style={{ ...S.train, marginTop: 12 }} disabled={!ready} onClick={train}>
          Train my bot ({words.toLocaleString()} words)
        </button>
        {!ready && <p style={S.hint}>At least {MIN_BOT_WORDS} words before it can learn anything.</p>}
      </section>

      <section style={S.card} className="nl-fade">
        <h2 style={S.h2}>Try it</h2>
        {model ? (
          <>
            <p style={S.hint}>{modelStats(model).words.toLocaleString()} words read · {modelStats(model).vocab.toLocaleString()} different words. Ask it about its topic, then about something else.</p>
            <BotChat model={model} botName={team ? `${team.name}'s bot` : "Your bot"} requireTopic={false} requireVote={false} placeholder="Test your bot…" />
            <button className="nl-btn" style={S.send} disabled={sending || !team} onClick={send}>{sending ? "Sending…" : "Send my bot to the class 🤖"}</button>
            {!team && <p style={S.hintText}>Only a team can send a bot. You can still train and test one here.</p>}
          </>
        ) : (
          <p style={S.empty}>Train it first. Then ask it a few questions here before you send it.</p>
        )}
        {team && sent.value && (
          <p style={{ ...S.hint, color: C.leaf, fontWeight: 800 }}>✓ {team.name}'s bot is in ({(sent.value.sources || []).join(", ") || "own text"}), sent by {members?.[sent.value.sentBy]?.name || "a teammate"}. Sending again replaces it.</p>
        )}
      </section>
    </main>
  );
}
