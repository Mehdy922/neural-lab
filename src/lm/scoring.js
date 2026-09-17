export const TOPICS = [
  { id: "history", label: "History", emoji: "🏛️" },
  { id: "science", label: "Science", emoji: "🧬" },
  { id: "sport", label: "Sport", emoji: "🏏" },
  { id: "maths", label: "Maths", emoji: "➗" },
  { id: "everyday", label: "Everyday", emoji: "🏠" },
  { id: "other", label: "Other", emoji: "❓" },
];
export const VERDICTS = [
  { id: "right", label: "Right", emoji: "👍" },
  { id: "wrong", label: "Wrong", emoji: "👎" },
  { id: "nonsense", label: "Nonsense", emoji: "🤪" },
];
export const TOPIC_IDS = TOPICS.map((t) => t.id);
export const VERDICT_IDS = VERDICTS.map((v) => v.id);
export const MIN_VOTES_TO_SHOW = 10;
export const MIN_FOREIGN_VOTES = 3;

const valid = (r) => r && TOPIC_IDS.includes(r.topic) && VERDICT_IDS.includes(r.verdict);
const list = (map) => Object.values(map || {}).filter(valid);
const tally = (rs) => {
  const n = rs.length, right = rs.filter((r) => r.verdict === "right").length;
  return { n, right, pct: n ? right / n : null };
};

export function topicAccuracy(votes) {
  const rs = list(votes);
  return TOPICS.map((t) => ({ topic: t.id, label: t.label, emoji: t.emoji, ...tally(rs.filter((r) => r.topic === t.id)) }));
}

export function splitHistoryVsRest(votes) {
  const rs = list(votes);
  return { history: tally(rs.filter((r) => r.topic === "history")), rest: tally(rs.filter((r) => r.topic !== "history")), total: rs.length };
}

export function botLeaderboard(botVotes, teams, bots) {
  const rs = list(botVotes);
  const rows = Object.keys(bots || {}).map((teamId) => {
    const mine = rs.filter((r) => r.botTeamId === teamId);
    const foreign = tally(mine.filter((r) => r.askerTeamId !== teamId));
    if (foreign.n < MIN_FOREIGN_VOTES) foreign.pct = null;
    return { teamId, name: teams?.[teamId]?.name ?? "Unknown team", foreign, own: tally(mine.filter((r) => r.askerTeamId === teamId)) };
  });
  return rows.sort((a, b) => {
    if (a.foreign.pct == null && b.foreign.pct == null) return b.foreign.n - a.foreign.n;
    if (a.foreign.pct == null) return 1;
    if (b.foreign.pct == null) return -1;
    return b.foreign.pct - a.foreign.pct || b.foreign.n - a.foreign.n;
  });
}

export function recentVotes(votes, n = 8) {
  return list(votes).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, n);
}
