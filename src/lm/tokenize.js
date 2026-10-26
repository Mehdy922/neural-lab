// Word-level tokenizer for the tiny language model. Words and sentence ends are tokens.

// Words that carry no topic signal, so the matcher is allowed to read them by exact spelling and
// nothing else. The evaluative comparatives are in here deliberately: "which is better" is the
// shape of a question about any subject at all, so good/better/best, bad/worse/worst and
// little/less/least belong beside the many/much/more/most that were always here, not in the
// irregular table. A stopword never reaches the typo stage, which is a stronger fix for
// "better" landing on "batter" than intercepting it one step earlier ever was.
export const STOPWORDS = new Set(("a an the and or but if then so of to in on at by for from with about as into like through " +
  "is are was were be been being am do does did doing have has had having will would shall should can could may might must " +
  "i me my we us our you your he him his she her it its they them their this that these those there here who whom whose which what " +
  "when where why how all any both each few more most other some such no nor not only own same than too very just also " +
  "good better best bad worse worst little less least " +
  "up down out over under again further once because while until during before after above below off yes please tell explain many much make made does get got").split(" "));

const END = new Set([".", "?", "!"]);
export const isWord = (t) => typeof t === "string" && !END.has(t) && t.length > 0;
export const isEnd = (t) => END.has(t);

export function tokenize(text) {
  const norm = String(text || "").toLowerCase().replace(/[’‘`]/g, "'").replace(/[“”]/g, '"');
  const raw = norm.match(/[a-z0-9]+(?:'[a-z]+)?|[.!?]/g) || [];
  const out = [];
  for (const t of raw) {
    if (isEnd(t) && (out.length === 0 || isEnd(out[out.length - 1]))) continue; // collapse "?!" and leading ends
    out.push(t);
  }
  return out;
}

export function contentWords(text) {
  const seen = new Set();
  const out = [];
  for (const t of tokenize(text)) {
    if (!isWord(t) || t.length < 2 || STOPWORDS.has(t) || seen.has(t)) continue;
    seen.add(t); out.push(t);
  }
  return out;
}

// ── forgiving matching: word shapes ──────────────────────────────────────────
// Students type English on phones. These two helpers let the model look past an ending or a slip
// of the thumb. They know nothing about any model; ngram.js decides what to do with them.

// Forms no spelling rule can reach, written as groups rather than a flat past -> base map: every
// member resolves to every other. Looked up in both directions, so a text that says "built" also
// answers to "build", a text that says "children" answers to "child", and good / better / best all
// reach one another, which a past -> base map could not say at all.
//
// Every member is an index key, and a key is a free hit for anyone who types it exactly, so this
// table is closed and hand-written rather than ruled. The -ves and -oes plurals are enumerated for
// that reason: a general -ves rule manufactures keys out of ordinary verbs, and some of that junk
// is a real word — "serves" would key "serf", so a student typing "serf" would resolve against a
// text that merely says "serves". The English -f noun class is small and closed, so it is listed.
//
// Accepted collisions: `left` is also a direction, `mean` is also unkind, `felt` is also a fabric,
// `saw` is also a tool, `rose` is also a flower. Resolution can only ever land on a word the text
// really contains, so the cost is the bot seeding from a neighbouring sense, never an invented
// word, and disambiguating a 2,000-word text would cost more than the sense it would save.
export const IRREGULAR_GROUPS = [
  // Irregular verbs, each group carrying its whole paradigm: base, -s, -ing, past, and the past
  // participle wherever one is in everyday use. The regular forms are written out rather than
  // left to the suffix rules, because a suffix-derived form may no longer reach a group key (see
  // resolveWord in ngram.js) — so on a text that only ever says "fought", a student typing
  // "fighting" would otherwise get nothing at all.
  ["build", "builds", "building", "built"],
  ["fight", "fights", "fighting", "fought"],
  ["win", "wins", "winning", "won"],
  ["make", "makes", "making", "made"],
  ["come", "comes", "coming", "came"],
  ["lead", "leads", "leading", "led"],
  ["send", "sends", "sending", "sent"],
  ["lose", "loses", "losing", "lost"],
  ["hold", "holds", "holding", "held"],
  ["bring", "brings", "bringing", "brought"],
  ["buy", "buys", "buying", "bought"],
  ["teach", "teaches", "teaching", "taught"],
  ["catch", "catches", "catching", "caught"],
  ["run", "runs", "running", "ran"],
  ["say", "says", "saying", "said"],
  ["tell", "tells", "telling", "told"],
  ["think", "thinks", "thinking", "thought"],
  ["sit", "sits", "sitting", "sat"],
  ["stand", "stands", "standing", "stood"],
  ["keep", "keeps", "keeping", "kept"],
  // "leaves" is missing from this one on purpose: it is already a leaf, below. Writing it here
  // too would put one word in two groups, and would hand back the exact chain this table was
  // restructured to break — "leaves" reaching "left" and answering foliage with a direction.
  ["leave", "leaving", "left"],
  ["pay", "pays", "paying", "paid"],
  ["hear", "hears", "hearing", "heard"],
  ["understand", "understands", "understanding", "understood"],
  ["feel", "feels", "feeling", "felt"],
  ["mean", "means", "meaning", "meant"],
  ["spend", "spends", "spending", "spent"],
  ["meet", "meets", "meeting", "met"],
  ["find", "finds", "finding", "found"],
  ["write", "writes", "writing", "wrote", "written"],
  ["take", "takes", "taking", "took", "taken"],
  ["give", "gives", "giving", "gave", "given"],
  ["know", "knows", "knowing", "knew", "known"],
  ["grow", "grows", "growing", "grew", "grown"],
  ["see", "sees", "seeing", "saw", "seen"],
  ["fall", "falls", "falling", "fell", "fallen"],
  ["speak", "speaks", "speaking", "spoke", "spoken"],
  ["begin", "begins", "beginning", "began", "begun"],
  ["eat", "eats", "eating", "ate", "eaten"],
  ["fly", "flies", "flying", "flew", "flown"],
  ["throw", "throws", "throwing", "threw", "thrown"],
  ["swim", "swims", "swimming", "swam", "swum"],
  ["drink", "drinks", "drinking", "drank", "drunk"],
  ["sing", "sings", "singing", "sang", "sung"],
  ["ring", "rings", "ringing", "rang", "rung"],
  ["draw", "draws", "drawing", "drew", "drawn"],
  ["rise", "rises", "rising", "rose", "risen"],
  ["choose", "chooses", "choosing", "chose", "chosen"],
  // irregular noun plurals: the topic-bearing win, and what the biology, cooking and folktales
  // bots were missing entirely
  ["child", "children"], ["person", "people"], ["man", "men"], ["woman", "women"],
  ["foot", "feet"], ["tooth", "teeth"], ["mouse", "mice"], ["goose", "geese"],
  // -f and -fe nouns that pluralise in -ves: a small closed class, enumerated, never ruled
  ["leaf", "leaves"], ["knife", "knives"], ["life", "lives"], ["wife", "wives"],
  ["wolf", "wolves"], ["thief", "thieves"], ["shelf", "shelves"], ["half", "halves"],
  ["loaf", "loaves"], ["calf", "calves"],
  // -o nouns that pluralise in -oes, enumerated for the same reason
  ["potato", "potatoes"], ["tomato", "tomatoes"], ["mango", "mangoes"], ["hero", "heroes"],
  // No comparatives. good/better/best and its kind are evaluative, not topical, so they are
  // stopwords instead — see STOPWORDS at the top of this file.
];

// member -> its whole group, built once at load. The table used to be re-scanned with
// Object.entries on every single lookup, which is O(table) per word; this is a hash hit.
const IRREGULAR = new Map();
for (const group of IRREGULAR_GROUPS) for (const member of group) IRREGULAR.set(member, group);

// The two kinds of form are built separately and must stay that way. One hop of either kind is a
// safe guess; one of each, chained, is not. "leaves" strips to "leave", and the leave/left group
// would carry it on to "left" — a question about foliage answered with a direction. Keeping the
// halves apart here lets ngram.js index them apart, which is where the chain is actually broken.

// A possessive is punctuation, not morphology. It is normalised away before anything is derived,
// rather than being one derivation among the others: "child's" is simply the word "child", and
// reaches "children" by a single group hop with nothing chained. Stripping it first also stops
// the plural rule firing on the apostrophe and indexing "akbar'".
const bare = (word) => word.replace(/'s$/, "");

// What a spelling rule derives: the normalised word and its plural and tense endings. Nothing
// from the irregular table.
export function shapeForms(word) {
  const out = new Set([word]);
  // Three letters minimum: stripping "-ed" twice over leaves fragments like "us" from "used" or
  // "fl" from "fled", and the stem path has none of the fuzzy guards, so such a key is a free hit
  // on a word nobody typed. The word itself is added above, so a short vocabulary word still
  // indexes itself.
  const add = (s) => { if (s && s.length >= 3) out.add(s); };
  const w = bare(word);
  add(w);
  if (/ies$/.test(w) && w.length > 4) add(w.slice(0, -3) + "y");                   // cities -> city
  if (/(sses|shes|ches|xes|zes)$/.test(w)) add(w.slice(0, -2));                    // wishes -> wish
  if (/s$/.test(w) && !/ss$/.test(w) && w.length > 3) add(w.slice(0, -1));
  if (/es$/.test(w) && w.length > 4) add(w.slice(0, -2));
  if (/ed$/.test(w) && w.length > 3) { add(w.slice(0, -2)); add(w.slice(0, -1)); }  // ruled -> rule, died -> die
  if (/ing$/.test(w) && w.length > 5) { add(w.slice(0, -3)); add(w.slice(0, -3) + "e"); }
  return out;
}

// What the irregular table says: the group the normalised `word` belongs to, itself included,
// and nothing else. Never the group of a form a suffix rule derived. The same three-letter floor
// applies, though no group member is shorter than three letters, so it never cuts one.
export function groupForms(word) {
  const out = new Set();
  for (const member of IRREGULAR.get(bare(word)) || []) if (member.length >= 3) out.add(member);
  return out;
}

// Every form of `word` worth looking up, the two halves together. ngram.js uses the halves,
// because it has to keep them apart; this is for callers that simply want the whole set.
export function wordForms(word) {
  const out = new Set([word]);
  for (const member of groupForms(word)) out.add(member);
  for (const form of shapeForms(word)) out.add(form);
  return out;
}

// Damerau-Levenshtein distance, capped. A transposition counts as one edit, which is what makes
// "dehli" and "biult" work — by far the most common typo class. Returns cap + 1 once it is clear
// the words are further apart than `cap`, so the walk can stop early.
export function editDistance(a, b, cap) {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const d = [];
  for (let i = 0; i <= a.length; i++) d[i] = [i];
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      if (d[i][j] < rowMin) rowMin = d[i][j];
    }
    if (rowMin > cap) return cap + 1;
  }
  return d[a.length][b.length];
}

export function detokenize(tokens) {
  let s = "";
  let capNext = true;
  for (const t of tokens) {
    if (isEnd(t)) { s += t; capNext = true; continue; }
    const w = capNext ? t.charAt(0).toUpperCase() + t.slice(1) : t;
    s += (s ? " " : "") + w;
    capNext = false;
  }
  return s;
}

// FNV-1a, 32-bit, non-negative.
export function hashString(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
