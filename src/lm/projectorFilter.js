// Questions containing these words are still answered on the phone, but are kept off the projector feed.
// Teachers can also hide any feed item by tapping it. Keep this list short; it is a courtesy, not a filter.
// Deity/scripture names (the juxtaposition risk the review named) plus profanity and a few violence terms.
// Deliberately NOT here: religion, islam, hindu, die, dead, kill — those are legitimate history questions ("When did Akbar die?").
export const PROJECTOR_DENYLIST = [
  "allah", "god", "gods", "prophet", "quran", "koran", "bible", "jesus",
  "sex", "sexy", "porn", "nude", "naked", "fuck", "fucking", "shit", "bitch", "bastard", "dick", "penis", "vagina", "boobs",
  "suicide", "rape", "terrorist", "bomb", "gay", "lesbian",
];
const RE = new RegExp(`\\b(${PROJECTOR_DENYLIST.join("|")})\\b`, "i");
export const isProjectorSafe = (q) => !RE.test(String(q || ""));
