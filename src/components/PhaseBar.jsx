import { S } from "../theme.js";
import { PHASE_NAMES_BY_ACTIVITY, ROUND_ACTION, nextPhase, phaseAction, supportsRounds } from "../rooms/phases.js";

export function PhaseBar({ phase, round = 1, activity = 1, onAdvance, onNextRound, busy = false }) {
  const next = nextPhase(phase, activity);
  const names = PHASE_NAMES_BY_ACTIVITY[activity] || PHASE_NAMES_BY_ACTIVITY[1];
  const rounds = supportsRounds(activity);
  return (
    <div style={S.phaseBar}>
      <span style={S.phaseNow}>{rounds ? `Round ${round} · ` : ""}{names[phase] || phase}</span>
      {rounds && phase === "reveal" && (
        <button className="nl-btn" style={{ ...S.phaseBtn, background: S.accent.background, boxShadow: S.accent.boxShadow }}
          disabled={busy} onClick={() => onNextRound?.()}>
          ↺ {ROUND_ACTION}
        </button>
      )}
      {next && (
        <button className="nl-btn" style={S.phaseBtn} disabled={busy} onClick={() => onAdvance(next)}>
          {phaseAction(phase, activity)} →
        </button>
      )}
    </div>
  );
}
