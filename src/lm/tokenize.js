// Word-level tokenizer for the tiny language model. Words and sentence ends are tokens.

export const STOPWORDS = new Set(("a an the and or but if then so of to in on at by for from with about as into like through " +
  "is are was were be been being am do does did doing have has had having will would shall should can could may might must " +
  "i me my we us our you your he him his she her it its they them their this that these those there here who whom whose which what " +
  "when where why how all any both each few more most other some such no nor not only own same than too very just also " +
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

// The irregular verbs a 2,000-word school text actually uses, written as groups rather than a flat
// past -> base map: every member resolves to every other. Looked up in both directions, so a text
// that says "built" also answers to "build", and a text that says "build" answers to "built".
const IRREGULAR_GROUPS = [
  // irregular verbs
  ["build", "built"], ["fight", "fought"], ["win", "won"], ["take", "took"], ["begin", "began"],
  ["make", "made"], ["write", "wrote"], ["come", "came"], ["give", "gave"], ["lead", "led"],
  ["send", "sent"], ["lose", "lost"], ["hold", "held"], ["bring", "brought"], ["buy", "bought"],
  ["teach", "taught"], ["catch", "caught"], ["fall", "fell"], ["grow", "grew"], ["know", "knew"],
  ["run", "ran"], ["say", "said"], ["see", "saw"], ["speak", "spoke"], ["tell", "told"],
  ["think", "thought"],
];

// member -> its whole group, built once at load. The table used to be re-scanned with
// Object.entries on every single lookup, which is O(table) per word; this is a hash hit.
const IRREGULAR = new Map();
for (const group of IRREGULAR_GROUPS) for (const member of group) IRREGULAR.set(member, group);

// Every form of `word` worth looking up, including `word` itself. Deliberately small: plurals,
// possessives, past and present participles, and the irregular groups above.
export function wordForms(word) {
  const out = new Set([word]);
  // Three letters minimum: stripping "-ed" twice over leaves fragments like "us" from "used" or
  // "fl" from "fled", and the stem path has none of the fuzzy guards, so such a key is a free hit
  // on a word nobody typed. The word itself is added above, so a short vocabulary word still
  // indexes itself. No group member is shorter than three letters, so the floor never cuts one.
  const add = (s) => { if (s && s.length >= 3) out.add(s); };
  add(word.replace(/'s$/, ""));
  for (const member of IRREGULAR.get(word) || []) add(member);
  if (/ies$/.test(word) && word.length > 4) add(word.slice(0, -3) + "y");          // cities -> city
  if (/(sses|shes|ches|xes|zes)$/.test(word)) add(word.slice(0, -2));              // wishes -> wish
  if (/s$/.test(word) && !/ss$/.test(word) && word.length > 3) add(word.slice(0, -1));
  if (/es$/.test(word) && word.length > 4) add(word.slice(0, -2));
  if (/ed$/.test(word) && word.length > 3) { add(word.slice(0, -2)); add(word.slice(0, -1)); }  // ruled -> rule, died -> die
  if (/ing$/.test(word) && word.length > 5) { add(word.slice(0, -3)); add(word.slice(0, -3) + "e"); }
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
