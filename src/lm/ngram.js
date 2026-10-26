// A word-level trigram language model with backoff. This is honestly what runs in the app:
// the bot predicts the next word from counts of what it has read. Nothing else.
import { mulberry32 } from "../ml/net.js";
import { tokenize, contentWords, detokenize, hashString, isWord, isEnd, STOPWORDS, wordForms, editDistance } from "./tokenize.js";

const bump = (obj, k) => { obj[k] = (obj[k] || 0) + 1; };

// Words the model can be asked about: real words, no sentence ends. Built once, at train time.
const vocabularyOf = (uni) => Object.keys(uni).filter((w) => /^[a-z0-9']+$/.test(w));

// Every form of every vocabulary word, pointing back at the vocabulary word. Ties go to the more
// frequent word, so "build" lands on whichever of build/built the text actually leans on.
function indexForms(uni, vocabWords) {
  const forms = {};
  for (const w of vocabWords) for (const form of wordForms(w)) if (!forms[form] || uni[w] > uni[forms[form]]) forms[form] = w;
  return forms;
}

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
  const vocabWords = vocabularyOf(uni);
  return { order: 3, tokenCount: tokens.length, wordCount, vocab, uni, bi, tri, starts, vocabWords, forms: indexForms(uni, vocabWords) };
}

export const modelStats = (m) => ({ words: m.wordCount, vocab: m.vocab });

// The word of the model's vocabulary a student meant, or null if the model has never read anything
// like it. Exact first, then an ending, then one or two typos. Err toward missing: a word genuinely
// outside the text must stay unrecognised or the whole lesson collapses.
export function resolveWord(model, word) {
  if (model.uni?.[word]) return { word, how: "exact" };
  // Stopwords carry no topic signal; loosening them only invents matches. Exact or nothing.
  if (STOPWORDS.has(word)) return null;
  const forms = model.forms || {};
  for (const form of wordForms(word)) if (forms[form]) return { word: forms[form], how: "stem" };
  if (word.length < 4) return null;                      // too short for one edit to mean anything
  const cap = word.length >= 8 ? 2 : 1;
  let best = null;
  for (const candidate of model.vocabWords || []) {
    if (candidate[0] !== word[0] || Math.abs(candidate.length - word.length) > 1) continue;
    const d = editDistance(word, candidate, cap);
    if (d > cap) continue;
    if (!best || d < best.d || (d === best.d && model.uni[candidate] > model.uni[best.word])) best = { word: candidate, d };
  }
  return best ? { word: best.word, how: "fuzzy" } : null;
}

// How much of the question the bot has actually read. A word it reached only by looking past a
// typo still counts as known — but the correction is reported, so the machine stays honest about
// having done a dumb lookup rather than understood anything.
export function coverage(model, question) {
  const knownWords = [], unknownWords = [], corrections = [];
  const words = contentWords(question);
  for (const typed of words) {
    const read = resolveWord(model, typed);
    if (!read) { unknownWords.push(typed); continue; }
    knownWords.push(read.word);                     // the vocabulary word, so callers can highlight it in the text
    if (read.word !== typed) corrections.push({ typed, read: read.word });
  }
  return { known: knownWords.length, total: words.length, knownWords, unknownWords, corrections };
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

  // 1. The best adjacent pair of question words the model has seen together.
  //    Score = number of content (non-stop) words in the pair; a pair of two stopwords is never used.
  //    Ties break toward the rarer pair (more informative).
  let best = null;
  for (let i = 0; i + 1 < qTokens.length; i++) {
    const a = qTokens[i], b = qTokens[i + 1];
    if (!model.bi[a]?.[b]) continue;
    const score = (STOPWORDS.has(a) ? 0 : 1) + (STOPWORDS.has(b) ? 0 : 1);
    if (score === 0) continue;
    const rarity = model.uni[a] + model.uni[b];
    if (!best || score > best.score || (score === best.score && rarity < best.rarity)) best = { a, b, score, rarity };
  }
  if (best) { w1 = best.a; w2 = best.b; seededFrom = "question"; }
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
