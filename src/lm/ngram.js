// A word-level trigram language model with backoff. This is honestly what runs in the app:
// the bot predicts the next word from counts of what it has read. Nothing else.
import { mulberry32 } from "../ml/net.js";
import { tokenize, contentWords, detokenize, hashString, isWord, isEnd } from "./tokenize.js";

const bump = (obj, k) => { obj[k] = (obj[k] || 0) + 1; };

export function trainModel(text) {
  const tokens = tokenize(text);
  const uni = {}, bi = {}, tri = {}, starts = {};
  let p1 = null, p2 = null, atStart = true;
  for (const t of tokens) {
    bump(uni, t);
    if (atStart && isWord(t)) bump(starts, t);
    if (p1) bump((bi[p1] ||= {}), t);
    if (p1 && p2) bump((tri[`${p2} ${p1}`] ||= {}), t);
    atStart = isEnd(t);
    p2 = p1; p1 = t;
  }
  const wordCount = tokens.filter(isWord).length;
  const vocab = Object.keys(uni).filter(isWord).length;
  return { order: 3, tokenCount: tokens.length, wordCount, vocab, uni, bi, tri, starts };
}

export const modelStats = (m) => ({ words: m.wordCount, vocab: m.vocab });

export function coverage(model, question) {
  const words = contentWords(question);
  const knownWords = words.filter((w) => model.uni[w]);
  const unknownWords = words.filter((w) => !model.uni[w]);
  return { known: knownWords.length, total: words.length, knownWords, unknownWords };
}

// Weighted pick over a {token: count} object. `filter` optionally restricts candidates.
function pick(dist, rand, filter) {
  if (!dist) return null;
  const keys = Object.keys(dist).filter((k) => !filter || filter(k));
  if (!keys.length) return null;
  let total = 0;
  for (const k of keys) total += dist[k];
  let r = rand() * total;
  for (const k of keys) { r -= dist[k]; if (r <= 0) return k; }
  return keys[keys.length - 1];
}

export function generate(model, question, { seed = 0, maxWords = 40, minWords = 8 } = {}) {
  const rand = mulberry32((hashString(String(question)) + seed) | 0);
  const qTokens = tokenize(question).filter(isWord);
  let w1 = null, w2 = null, seededFrom = "random";

  // 1. An adjacent pair of question words that the model has seen together.
  for (let i = 0; i + 1 < qTokens.length && !w1; i++) {
    const a = qTokens[i], b = qTokens[i + 1];
    if (model.bi[a]?.[b]) { w1 = a; w2 = b; seededFrom = "question"; }
  }
  // 2. The rarest known content word (most informative), then its most likely continuation.
  if (!w1) {
    const cands = contentWords(question).filter((w) => model.uni[w] && model.bi[w]);
    if (cands.length) {
      cands.sort((x, y) => model.uni[x] - model.uni[y]);
      w1 = cands[0]; w2 = pick(model.bi[w1], rand, isWord); seededFrom = "question";
    }
  }
  // 3. A sentence start.
  if (!w1) {
    w1 = pick(model.starts, rand) || pick(model.uni, rand, isWord);
    w2 = model.bi[w1] ? pick(model.bi[w1], rand, isWord) : null;
  }
  if (!w1) return { text: "", seededFrom: "random", words: 0 };

  const out = [w1];
  if (w2) out.push(w2);
  let words = out.filter(isWord).length;
  for (let guard = 0; guard < 400 && words < maxWords; guard++) {
    const key = out.length >= 2 ? `${out[out.length - 2]} ${out[out.length - 1]}` : null;
    const last = out[out.length - 1];
    const dist = (key && model.tri[key]) || model.bi[last] || model.uni;
    const next = pick(dist, rand);
    if (next == null) break;
    if (isEnd(next)) {
      if (words >= minWords) { out.push(next); break; }
      // too short to stop: back off to a fresh sentence start instead of ending
      const restart = pick(model.starts, rand);
      if (restart) { out.push("."); out.push(restart); words++; }
      continue;
    }
    out.push(next); words++;
  }
  let text = detokenize(out);
  if (!/[.!?]$/.test(text)) text += ".";
  return { text, seededFrom, words };
}
