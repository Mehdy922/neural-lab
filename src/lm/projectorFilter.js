// Questions containing these words are still answered on the phone, but are kept off the projector feed.
// Teachers can also hide any feed item by tapping it. Keep this list short; it is a courtesy, not a filter.
// Deity/scripture names (the juxtaposition risk the review named) plus profanity and a few violence terms.
// Deliberately NOT here: religion, islam, hindu, die, dead, kill — those are legitimate history questions ("When did Akbar die?").
// Bare "muhammad" cannot be blocked either: Muhammad bin Qasim, Muhammad Ali Jinnah and Muhammad Ghori are in the history text
// and are exactly the questions we want on the projector. That residual risk is covered by the teacher's opening line
// ("it does not understand a word you type") and tap-to-hide. "gods" also hides a legitimate Vedic question ("which gods did
// the Vedic people praise?"); accepted for a courtesy filter.
export const PROJECTOR_DENYLIST = [
  "allah", "khuda", "god", "gods", "prophet", "rasool", "rasul", "nabi", "quran", "koran", "bible", "jesus",
  "sex", "sexy", "porn", "nude", "naked", "fuck", "fucking", "shit", "bitch", "bastard", "dick", "penis", "vagina", "boobs",
  "suicide", "rape", "terrorist", "bomb", "gay", "lesbian",
];
const RE = new RegExp(`\\b(${PROJECTOR_DENYLIST.join("|")})\\b`, "i");
export const isProjectorSafe = (q) => !RE.test(String(q || ""));
