import { S, C } from "../theme.js";
import { ACTIVITIES } from "../rooms/phases.js";

export function ActivityPick({ onPick, rejoinCode, onRejoin }) {
  return (
    <div style={S.center}>
      <div className="nl-fade" style={{ ...S.centerCard, maxWidth: 680 }}>
        <div className="nl-bounce" style={{ fontSize: 64, lineHeight: 1 }} aria-hidden="true">🧠</div>
        <h1 style={S.h1}>Neural Lab</h1>
        <p style={{ ...S.lede, margin: "0 auto 18px" }}>Two lessons on what a machine really learns.</p>
        {rejoinCode && (
          <button className="nl-btn" style={{ ...S.accent, width: "100%", marginBottom: 18 }} onClick={() => onRejoin(rejoinCode)}>
            Rejoin room {rejoinCode} →
          </button>
        )}
        <p style={{ ...S.label, fontSize: 16 }}>Choose an activity</p>
        <div style={S.choiceGrid}>
          {Object.values(ACTIVITIES).map((a) => (
            <button key={a.id} className="nl-btn" style={S.choiceCard} onClick={() => onPick(a.id)}>
              <span style={S.badge}>Activity {a.id}</span>
              <div style={{ ...S.choiceEmoji, marginTop: 10 }} aria-hidden="true">{a.emoji}</div>
              <div style={S.choiceTitle}>{a.title}</div>
              <div style={{ ...S.choiceSub, color: C.muted }}>{a.blurb}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
