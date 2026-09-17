import { S } from "../theme.js";
import { ACTIVITIES } from "../rooms/phases.js";

export function Landing({ onChoose, activity = 1, onBack }) {
  const a = ACTIVITIES[activity] || ACTIVITIES[1];
  return (
    <div style={S.center}>
      <div className="nl-fade" style={{ ...S.centerCard, maxWidth: 640 }}>
        <div style={{ fontSize: 56, lineHeight: 1 }} aria-hidden="true">{a.emoji}</div>
        <span style={{ ...S.badge, marginTop: 10 }}>Activity {a.id}</span>
        <h1 style={{ ...S.h1, marginTop: 8 }}>{a.title}</h1>
        <p style={{ ...S.lede, margin: "0 auto 18px" }}>{a.blurb}</p>
        <p style={{ ...S.label, fontSize: 16 }}>Are you a teacher or a student?</p>
        <div style={S.choiceGrid}>
          <button className="nl-btn" style={S.choiceCard} onClick={() => onChoose("teacher")}>
            <div style={S.choiceEmoji} aria-hidden="true">👩‍🏫</div>
            <div style={S.choiceTitle}>Teacher</div>
            <div style={S.choiceSub}>Create a room for your class</div>
          </button>
          <button className="nl-btn" style={S.choiceCard} onClick={() => onChoose("student")}>
            <div style={S.choiceEmoji} aria-hidden="true">🙋</div>
            <div style={S.choiceTitle}>Student</div>
            <div style={S.choiceSub}>Join with a room code</div>
          </button>
        </div>
        {onBack && <button className="nl-btn" style={{ ...S.tiny, marginTop: 18 }} onClick={onBack}>← Change activity</button>}
      </div>
    </div>
  );
}
