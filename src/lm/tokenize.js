// Word-level tokenizer for the tiny language model. Words and sentence ends are tokens.

export const STOPWORDS = new Set(("a an the and or but if then so of to in on at by for from with about as into like through " +
  "is are was were be been being am do does did doing have has had having will would shall should can could may might must " +
  "i me my we our you your he him his she her it its they them their this that these those there here who whom whose which what " +
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
