export const ACTIVITIES = {
  1: { id: 1, title: "Teach the machine", emoji: "✏️", blurb: "Draw, train a tiny neural network, then find out what it really learned." },
  2: { id: 2, title: "Talk to the machine", emoji: "💬", blurb: "Question a bot that has read one thing in its life. Then train your own." },
};

export const PHASES_BY_ACTIVITY = {
  1: ["lobby", "teach", "reveal", "fence"],
  2: ["lobby", "chat", "reveal", "train", "exam"],
};
export const PHASES = PHASES_BY_ACTIVITY[1];

const LOBBY = { key: "lobby", label: "Lobby", emoji: "🏠", minPhase: "lobby" };
export const TABS_BY_ACTIVITY = {
  1: [
    LOBBY,
    { key: "teach", label: "Teach it", emoji: "✏️", minPhase: "teach" },
    { key: "tournament", label: "Tournament", emoji: "🏆", minPhase: "reveal" },
    { key: "fence", label: "Bendy fence", emoji: "🪢", minPhase: "fence" },
  ],
  2: [
    LOBBY,
    { key: "chat", label: "HistoryBot", emoji: "💬", minPhase: "chat" },
    { key: "scoreboard", label: "Scoreboard", emoji: "📊", minPhase: "reveal" },
    { key: "trainbot", label: "Train your bot", emoji: "🧪", minPhase: "train" },
    { key: "exam", label: "Cross-examine", emoji: "🎤", minPhase: "exam" },
  ],
};
export const TABS = TABS_BY_ACTIVITY[1];
export const SETTINGS_TAB = { key: "settings", label: "Settings", emoji: "⚙️" };

export const PHASE_ACTIONS_BY_ACTIVITY = {
  1: { lobby: "Start teaching", teach: "Reveal tournament", reveal: "Open bendy fence" },
  2: { lobby: "Start chatting", chat: "Reveal scoreboard", reveal: "Start training", train: "Open cross-examination" },
};
export const PHASE_ACTIONS = PHASE_ACTIONS_BY_ACTIVITY[1];

export const PHASE_NAMES_BY_ACTIVITY = {
  1: { lobby: "Lobby — teams forming", teach: "Teaching — teams draw and train", reveal: "Tournament revealed", fence: "Bendy fence open" },
  2: { lobby: "Lobby — teams forming", chat: "Chatting with HistoryBot", reveal: "Scoreboard revealed", train: "Teams train their bots", exam: "Cross-examination open" },
};

// Offered alongside "Open bendy fence" at reveal (activity 1 only).
export const ROUND_ACTION = "Next round";
export const supportsRounds = (activity = 1) => Number(activity) === 1;

const act = (a) => (PHASES_BY_ACTIVITY[a] ? Number(a) : 1);
const idx = (phases, p) => phases.indexOf(p);

export function visibleTabs(role, phase, activity = 1) {
  const a = act(activity);
  const tabs = TABS_BY_ACTIVITY[a], phases = PHASES_BY_ACTIVITY[a];
  if (role === "teacher") return [...tabs, SETTINGS_TAB];
  const cur = Math.max(0, idx(phases, phase));
  return tabs.filter((t) => idx(phases, t.minPhase) <= cur);
}

export function nextPhase(phase, activity = 1) {
  const phases = PHASES_BY_ACTIVITY[act(activity)];
  const i = idx(phases, phase);
  return i >= 0 && i < phases.length - 1 ? phases[i + 1] : null;
}

export const phaseAction = (phase, activity = 1) => PHASE_ACTIONS_BY_ACTIVITY[act(activity)][phase];
