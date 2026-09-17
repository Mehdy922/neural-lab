# Activity 2 — Talk to the Machine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second activity to Neural Lab: students interrogate a history-only next-word model (HistoryBot), vote on its answers by topic, see the scoreboard collapse outside history, then train their own bots from starter/own texts and cross-examine each other's, one round.

**Architecture:** A word-level trigram language model (`src/lm/`) trained in the browser from bundled or pasted text; only text travels through Firebase, every client rebuilds the model. Rooms, teams, teacher identity, phases and rules are reused; `meta.activity` selects a second tab set and phase list. Votes are append-only records scored client-side (`src/lm/scoring.js`). New screens plug into the existing `Room` shell.

**Tech Stack:** React 19, Vite 8, Vitest 5 (jsdom, globals), Firebase RTDB + Anonymous Auth, existing theme and components. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-17-activity-2-talk-to-the-machine-design.md`

## Global Constraints

- Plain JavaScript, React function components; no new dependencies.
- Activity 2 phases in order: `lobby → chat → reveal → train → exam`. Activity 1 phases, tabs and behaviour unchanged. `meta.activity` absent means 1.
- Topics: `history, science, sport, maths, everyday, other`. Verdicts: `right, wrong, nonsense`. Nonsense counts as wrong in every score.
- Limits: question ≤ 120 chars, stored answer ≤ 240 chars, bot text 1–6,000 chars, combined training text ≥ 150 words to train. Scoreboard shows bars at ≥ 10 votes; a bot's foreign % shows at ≥ 3 foreign votes.
- Model: trigram with backoff to bigram/unigram; seeded RNG `mulberry32` from `src/ml/net.js`; `seed = hashString(question) + attempt`; answers 8–40 words, always end with a full stop, use only vocabulary words.
- Verbatim copy: "HistoryBot has read one thing in its life: 2,000 words about South Asian history. Ask it anything." · "Recognised {known} of {total} words in your question." · "It never once said 'I don't know'. Why not?" · "Show me everything it has ever read" · "Every bot is now questioned by strangers. Which one survived?"
- Starter texts are original prose written for this project (no quotations), simple English, complete sentences ending in `.`/`?`/`!`; history ≥ 1,800 words, others ≥ 600 words.
- Theme: reuse `S`/`C` from `src/theme.js`; new keys added there (Task 9) and listed in `theme.test.js`.
- Commit per task; `Co-Authored-By` may name the implementing model. Tests: `npm test` (unit), `npm run test:rules` (emulator; kill a stale `java` emulator on port 9000 first if it refuses to start).

## File map

```
src/lm/tokenize.js            STOPWORDS, tokenize, contentWords, detokenize, hashString, isWord, isEnd
src/lm/ngram.js               trainModel, coverage, generate, modelStats
src/lm/scoring.js             TOPICS, VERDICTS, MIN_VOTES_TO_SHOW, MIN_FOREIGN_VOTES, topicAccuracy,
                              splitHistoryVsRest, botLeaderboard, recentVotes
src/lm/texts/{history,biology,cricket,cooking,space,folktales}.js   one export each
src/lm/texts/index.js         STARTER_TEXTS, HISTORY_TEXT, getText
src/rooms/phases.js           ACTIVITIES, PHASES_BY_ACTIVITY, TABS_BY_ACTIVITY, PHASE_ACTIONS_BY_ACTIVITY,
                              PHASE_NAMES_BY_ACTIVITY, visibleTabs(role, phase, activity), nextPhase(phase, activity),
                              phaseAction(phase, activity), supportsRounds(activity)
src/rooms/api.js              createRoom({activity}), buildVote, castVote, sendBot, castBotVote, resetBoard({activity})
src/rooms/hooks.js            useVotes, useBots, useBotVotes, useTeamBot
database.rules.json           meta.activity, phase enum, votes, bots, botVotes
src/components/PhaseBar.jsx   activity-aware labels; Next round only for activity 1
src/components/BotChat.jsx    shared chat with topic chips, coverage line, votes, Ask again
src/components/Corpus.jsx     the "everything it has read" panel with highlights
src/screens/ActivityPick.jsx  choose activity (new first screen)
src/screens/Landing.jsx       shows the chosen activity, back link
src/screens/TeacherCreate.jsx activity prop; hides labels for activity 2
src/screens/Chat.jsx          Part 1 HistoryBot
src/screens/Scoreboard.jsx    topic bars, feed, corpus reveal, leaderboard in exam
src/screens/TrainBot.jsx      Part 2 train + test + send
src/screens/Exam.jsx          cross-examination + leaderboard
src/screens/Room.jsx          activity-aware tabs/props
src/screens/Lobby.jsx         lock via bots for activity 2
src/screens/Settings.jsx      hides labels for activity 2; reset variant; notes
src/App.jsx                   activity state → ActivityPick → Landing → …
scripts/simulate.mjs          --activity 2 path
README.md                     Activity 2 section
```

---

### Task 1: Tokenizer — `src/lm/tokenize.js`

**Files:**
- Create: `src/lm/tokenize.js`, `src/lm/tokenize.test.js`

**Interfaces:**
- Produces: `STOPWORDS: Set<string>`, `isWord(tok)`, `isEnd(tok)`, `tokenize(text) → string[]`, `contentWords(text) → string[]` (unique, in order, no stopwords, length ≥ 2), `detokenize(tokens) → string`, `hashString(s) → number` (32-bit, non-negative).

- [ ] **Step 1: Write the failing tests**

`src/lm/tokenize.test.js`:
```js
import { describe, it, expect } from "vitest";
import { tokenize, contentWords, detokenize, hashString, STOPWORDS, isWord, isEnd } from "./tokenize.js";

describe("tokenize", () => {
  it("lowercases, keeps words and sentence ends, drops other punctuation", () => {
    expect(tokenize("Akbar ruled; Delhi grew! Did it? Yes.")).toEqual(["akbar", "ruled", "delhi", "grew", "!", "did", "it", "?", "yes", "."]);
  });
  it("keeps apostrophes and digits, normalises curly quotes", () => {
    expect(tokenize("It’s 1947.")).toEqual(["it's", "1947", "."]);
  });
  it("collapses repeated sentence ends", () => {
    expect(tokenize("Why?! Because...")).toEqual(["why", "?", "because", "."]);
  });
  it("isWord / isEnd", () => {
    expect(isWord("akbar")).toBe(true); expect(isWord(".")).toBe(false);
    expect(isEnd("?")).toBe(true); expect(isEnd("akbar")).toBe(false);
  });
});

describe("contentWords", () => {
  it("drops stopwords and duplicates, keeps order", () => {
    expect(contentWords("What is the capital of the Mughal empire?")).toEqual(["capital", "mughal", "empire"]);
    expect(STOPWORDS.has("what")).toBe(true);
    expect(STOPWORDS.has("mughal")).toBe(false);
  });
  it("drops single letters", () => {
    expect(contentWords("a b cell")).toEqual(["cell"]);
  });
});

describe("detokenize", () => {
  it("capitalises sentence starts and attaches punctuation", () => {
    expect(detokenize(["akbar", "ruled", ".", "delhi", "grew", "?"])).toBe("Akbar ruled. Delhi grew?");
  });
  it("handles empty input", () => {
    expect(detokenize([])).toBe("");
  });
});

describe("hashString", () => {
  it("is deterministic and non-negative", () => {
    expect(hashString("akbar")).toBe(hashString("akbar"));
    expect(hashString("akbar")).not.toBe(hashString("babur"));
    expect(hashString("anything")).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lm/tokenize.test.js` — Expected: FAIL, cannot resolve `./tokenize.js`.

- [ ] **Step 3: Write src/lm/tokenize.js**

```js
// Word-level tokenizer for the tiny language model. Words and sentence ends are tokens.

export const STOPWORDS = new Set(("a an the and or but if then so of to in on at by for from with about as into like through " +
  "is are was were be been being am do does did doing have has had having will would shall should can could may might must " +
  "i me my we our you your he him his she her it its they them their this that these those there here who whom whose which what " +
  "when where why how all any both each few more most other some such no nor not only own same than too very just also " +
  "up down out over under again further once because while until during before after above below off yes please tell explain").split(" "));

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
```

- [ ] **Step 4: Run tests** — `npx vitest run src/lm/tokenize.test.js` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lm/tokenize.js src/lm/tokenize.test.js
git commit -m "Add word tokenizer for the tiny language model"
```

---

### Task 2: Trigram model — `src/lm/ngram.js`

**Files:**
- Create: `src/lm/ngram.js`, `src/lm/ngram.test.js`

**Interfaces:**
- Consumes: Task 1; `mulberry32` from `src/ml/net.js`.
- Produces:
  - `trainModel(text) → { order: 3, tokenCount, wordCount, vocab, uni, bi, tri, starts }` (plain objects keyed by token; `bi[w1][w2]`, `tri["w1 w2"][w3]`, `starts[w]` counts of sentence-initial words).
  - `coverage(model, question) → { known, total, knownWords, unknownWords }`.
  - `generate(model, question, { seed = 0, maxWords = 40, minWords = 8 } = {}) → { text, seededFrom: "question" | "random", words }`.
  - `modelStats(model) → { words, vocab }`.

- [ ] **Step 1: Write the failing tests**

`src/lm/ngram.test.js`:
```js
import { describe, it, expect } from "vitest";
import { trainModel, coverage, generate, modelStats } from "./ngram.js";
import { tokenize, isWord } from "./tokenize.js";

const CORPUS = `Akbar ruled the Mughal empire from Agra. Akbar built a new city at Fatehpur Sikri.
The Mughal empire grew under Akbar. Babur founded the Mughal empire after the battle of Panipat.
Shah Jahan built the Taj Mahal at Agra for his wife. Aurangzeb ruled for almost fifty years.
The empire became weak after Aurangzeb died. Traders came to the coast by sea.`;

describe("trainModel", () => {
  const m = trainModel(CORPUS);
  it("counts unigrams, bigrams, trigrams and sentence starts", () => {
    expect(m.order).toBe(3);
    expect(m.uni.akbar).toBe(3);
    expect(m.bi.mughal.empire).toBe(3);
    expect(m.tri["the mughal"].empire).toBe(3);
    expect(m.starts.akbar).toBe(2);
    expect(m.starts.the).toBe(2);
  });
  it("reports stats", () => {
    const s = modelStats(m);
    expect(s.words).toBe(tokenize(CORPUS).filter(isWord).length);
    expect(s.vocab).toBeGreaterThan(30);
  });
});

describe("coverage", () => {
  const m = trainModel(CORPUS);
  it("counts known content words of the question", () => {
    const c = coverage(m, "Who built the Taj Mahal at Agra?");
    expect(c.total).toBe(4);            // built, taj, mahal, agra
    expect(c.known).toBe(4);
  });
  it("reports unknown words for off-topic questions", () => {
    const c = coverage(m, "What is a cell made of?");
    expect(c.total).toBe(2);            // cell, made
    expect(c.known).toBe(0);
    expect(c.unknownWords).toEqual(["cell", "made"]);
  });
});

describe("generate", () => {
  const m = trainModel(CORPUS);
  it("is deterministic for the same question and seed", () => {
    const a = generate(m, "Who was Akbar?", { seed: 0 });
    const b = generate(m, "Who was Akbar?", { seed: 0 });
    expect(a.text).toBe(b.text);
  });
  it("uses only vocabulary words and ends with a full stop", () => {
    for (let seed = 0; seed < 5; seed++) {
      const { text } = generate(m, "What is DNA?", { seed });
      expect(text.length).toBeGreaterThan(0);
      expect(/[.!?]$/.test(text)).toBe(true);
      for (const t of tokenize(text)) if (isWord(t)) expect(m.uni[t], t).toBeDefined();
    }
  });
  it("seeds from the question when it can", () => {
    expect(generate(m, "Tell me about the Mughal empire", { seed: 1 }).seededFrom).toBe("question");
    expect(generate(m, "What is a cell?", { seed: 1 }).seededFrom).toBe("random");
  });
  it("respects the word budget", () => {
    const { words } = generate(m, "Akbar", { seed: 2, maxWords: 12 });
    expect(words).toBeLessThanOrEqual(12);
    expect(words).toBeGreaterThanOrEqual(1);
  });
  it("a different attempt changes the seed input", () => {
    const outs = new Set(Array.from({ length: 6 }, (_, i) => generate(m, "Akbar", { seed: i }).text));
    expect(outs.size).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail** — `npx vitest run src/lm/ngram.test.js` — Expected: FAIL (module missing).

- [ ] **Step 3: Write src/lm/ngram.js**

```js
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
```

- [ ] **Step 4: Run tests** — `npx vitest run src/lm/ngram.test.js` — Expected: PASS. If "respects the word budget" fails because the restart path adds a word past `maxWords`, change the restart branch to `if (restart && words < maxWords)`.

- [ ] **Step 5: Commit**

```bash
git add src/lm/ngram.js src/lm/ngram.test.js
git commit -m "Add trigram language model with coverage and seeded generation"
```

---

### Task 3: Starter texts — `src/lm/texts/`

**Files:**
- Create: `src/lm/texts/history.js`, `biology.js`, `cricket.js`, `cooking.js`, `space.js`, `folktales.js`, `index.js`, `src/lm/texts/texts.test.js`

**Interfaces:**
- Produces: each text module `export default { id, title, emoji, text }`; `index.js` exports `STARTER_TEXTS` (array of the six, with `words` computed), `HISTORY_TEXT` (the history string), `getText(id)`.
- Requirements for the prose (write it; do not copy from anywhere):
  - Simple English a 14-year-old reads easily; short sentences (≤ 20 words); every sentence ends with `.`, `?` or `!`; no bullet points, no headings, no quotation marks, no dialogue.
  - `history` ≥ 1,800 words, ≤ 2,300: Indus Valley cities and drains; Vedic period; Maurya and Ashoka; Gandhara and Taxila; Arab arrival in Sindh (Muhammad bin Qasim); Ghaznavids and Lahore; Delhi Sultanate; Babur and Panipat; Humayun; Akbar (Fatehpur Sikri, Din-i Ilahi, Rajput alliances); Jahangir; Shah Jahan (Taj Mahal, Lahore Fort, Shalimar); Aurangzeb; decline; Sikh rule under Ranjit Singh; East India Company; 1857; Sir Syed and Aligarh; All-India Muslim League 1906; Allama Iqbal 1930; Lahore Resolution 1940; Jinnah; 14 August 1947; Karachi as first capital. Use recurring names so trigrams chain well.
  - `biology` ≥ 600 words: cells, nucleus, DNA, organs, heart and blood, lungs, digestion, bones and muscles, plants and photosynthesis, bacteria.
  - `cricket` ≥ 600: pitch, overs, batting, bowling, wickets, fielding, Test/ODI/T20, umpires, a match unfolding, Pakistan's 1992 and 2009 wins mentioned plainly.
  - `cooking` ≥ 600: biryani, roti, daal, chai, spices, tandoor, kitchen safety, Eid meals.
  - `space` ≥ 600: Sun, planets, Moon phases, stars, gravity, rockets, astronauts, telescopes.
  - `folktales` ≥ 600: three short original tales (a clever crow and a pot, a river that would not wait, a market thief caught by a child) with a one-line moral each.

- [ ] **Step 1: Write the failing tests**

`src/lm/texts/texts.test.js`:
```js
import { describe, it, expect } from "vitest";
import { STARTER_TEXTS, HISTORY_TEXT, getText } from "./index.js";
import { tokenize, isWord } from "../tokenize.js";
import { trainModel, coverage, generate } from "../ngram.js";

const words = (t) => tokenize(t).filter(isWord).length;

describe("starter texts", () => {
  it("has the six texts with ids, titles, emoji and word counts", () => {
    expect(STARTER_TEXTS.map((t) => t.id)).toEqual(["history", "biology", "cricket", "cooking", "space", "folktales"]);
    for (const t of STARTER_TEXTS) {
      expect(t.title.length).toBeGreaterThan(2);
      expect(t.emoji.length).toBeGreaterThan(0);
      expect(t.words).toBe(words(t.text));
    }
  });
  it("meets the length floors", () => {
    expect(words(HISTORY_TEXT)).toBeGreaterThanOrEqual(1800);
    expect(words(HISTORY_TEXT)).toBeLessThanOrEqual(2300);
    for (const t of STARTER_TEXTS.filter((x) => x.id !== "history")) expect(words(t.text), t.id).toBeGreaterThanOrEqual(600);
  });
  it("is plain prose: no quotes, bullets or headings; sentences end with punctuation", () => {
    for (const t of STARTER_TEXTS) {
      expect(t.text, t.id).not.toMatch(/["“”]/);
      expect(t.text, t.id).not.toMatch(/^\s*[-*#]/m);
      expect(t.text.trim(), t.id).toMatch(/[.!?]$/);
    }
  });
  it("getText resolves ids", () => {
    expect(getText("cricket").id).toBe("cricket");
    expect(getText("nope")).toBeUndefined();
  });
});

describe("HistoryBot behaviour", () => {
  const m = trainModel(HISTORY_TEXT);
  it("knows history words and not biology words", () => {
    const hist = coverage(m, "Who built the Taj Mahal and where is Lahore Fort?");
    const bio = coverage(m, "What is a cell made of and how does DNA carry information?");
    expect(hist.known / hist.total).toBeGreaterThanOrEqual(0.6);
    expect(bio.known / bio.total).toBeLessThanOrEqual(0.34);
  });
  it("still answers a biology question, in history words only", () => {
    const { text } = generate(m, "What is a cell made of and how does DNA carry information?", { seed: 0 });
    expect(text.split(" ").length).toBeGreaterThanOrEqual(6);
    for (const t of tokenize(text)) if (isWord(t)) expect(m.uni[t], t).toBeDefined();
  });
  it("seeds from the question for a history question", () => {
    expect(generate(m, "Tell me about Akbar and Fatehpur Sikri", { seed: 0 }).seededFrom).toBe("question");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail** — `npx vitest run src/lm/texts` — Expected: FAIL (module missing).

- [ ] **Step 3: Write the six texts and index.js**

Each text module has this shape (write the prose to the requirements above):
```js
export default {
  id: "history",
  title: "South Asian history",
  emoji: "🏛️",
  text: `The Indus Valley people built cities more than four thousand years ago. ...`,
};
```
Titles/emoji: history "South Asian history" 🏛️ · biology "The living body" 🧬 · cricket "Cricket" 🏏 · cooking "In the kitchen" 🍛 · space "Space" 🚀 · folktales "Folk tales" 🦉.

`src/lm/texts/index.js`:
```js
import history from "./history.js";
import biology from "./biology.js";
import cricket from "./cricket.js";
import cooking from "./cooking.js";
import space from "./space.js";
import folktales from "./folktales.js";
import { tokenize, isWord } from "../tokenize.js";

const withWords = (t) => ({ ...t, words: tokenize(t.text).filter(isWord).length });
export const STARTER_TEXTS = [history, biology, cricket, cooking, space, folktales].map(withWords);
export const HISTORY_TEXT = history.text;
export const getText = (id) => STARTER_TEXTS.find((t) => t.id === id);
```

- [ ] **Step 4: Run tests** — `npx vitest run src/lm/texts` — Expected: PASS. If the coverage thresholds fail, adjust the prose (more repeated proper nouns in history; avoid biology words like "cell", "body", "blood" in history), never the thresholds.

- [ ] **Step 5: Commit**

```bash
git add src/lm/texts
git commit -m "Add starter texts for HistoryBot and team bots"
```

---

### Task 4: Vote scoring — `src/lm/scoring.js`

**Files:**
- Create: `src/lm/scoring.js`, `src/lm/scoring.test.js`

**Interfaces:**
- Produces:
  - `TOPICS = [{ id, label, emoji }]` for history, science, sport, maths, everyday, other; `VERDICTS = [{ id, label, emoji }]` for right, wrong, nonsense; `TOPIC_IDS`, `VERDICT_IDS` (arrays of ids).
  - `MIN_VOTES_TO_SHOW = 10`, `MIN_FOREIGN_VOTES = 3`.
  - `topicAccuracy(votes) → rows` one per TOPIC in order: `{ topic, label, emoji, n, right, pct | null }`.
  - `splitHistoryVsRest(votes) → { history: { n, right, pct }, rest: { n, right, pct }, total }`.
  - `botLeaderboard(botVotes, teams, bots) → rows` one per key in `bots`: `{ teamId, name, foreign: { n, right, pct | null }, own: { n, right, pct | null } }`, sorted by `foreign.pct` desc (nulls last) then `foreign.n` desc. `foreign.pct` is null when `n < MIN_FOREIGN_VOTES`.
  - `recentVotes(votes, n = 8) → array` newest first by `at`.
  - `votes`/`botVotes` are RTDB maps `{ id: record }` or null.

- [ ] **Step 1: Write the failing tests**

`src/lm/scoring.test.js`:
```js
import { describe, it, expect } from "vitest";
import { TOPICS, VERDICTS, TOPIC_IDS, VERDICT_IDS, MIN_VOTES_TO_SHOW, MIN_FOREIGN_VOTES, topicAccuracy, splitHistoryVsRest, botLeaderboard, recentVotes } from "./scoring.js";

const v = (topic, verdict, at = 1) => ({ uid: "u", topic, verdict, q: "q", a: "a", known: 1, total: 2, at });
const votes = {
  a: v("history", "right", 5), b: v("history", "right", 4), c: v("history", "wrong", 3),
  d: v("science", "wrong", 2), e: v("science", "nonsense", 1), f: v("sport", "right", 6),
};

describe("constants", () => {
  it("topics and verdicts", () => {
    expect(TOPIC_IDS).toEqual(["history", "science", "sport", "maths", "everyday", "other"]);
    expect(VERDICT_IDS).toEqual(["right", "wrong", "nonsense"]);
    expect(TOPICS.every((t) => t.label && t.emoji)).toBe(true);
    expect(VERDICTS.every((t) => t.label && t.emoji)).toBe(true);
    expect(MIN_VOTES_TO_SHOW).toBe(10);
    expect(MIN_FOREIGN_VOTES).toBe(3);
  });
});

describe("topicAccuracy", () => {
  it("counts per topic in TOPICS order, nonsense = wrong, pct null when no votes", () => {
    const rows = topicAccuracy(votes);
    expect(rows.map((r) => r.topic)).toEqual(TOPIC_IDS);
    expect(rows[0]).toMatchObject({ topic: "history", n: 3, right: 2 });
    expect(rows[0].pct).toBeCloseTo(2 / 3, 6);
    expect(rows[1]).toMatchObject({ topic: "science", n: 2, right: 0, pct: 0 });
    expect(rows[3]).toMatchObject({ topic: "maths", n: 0, right: 0, pct: null });
  });
  it("ignores malformed records and null input", () => {
    expect(topicAccuracy(null).every((r) => r.n === 0)).toBe(true);
    expect(topicAccuracy({ x: { topic: "bogus", verdict: "right" } }).every((r) => r.n === 0)).toBe(true);
  });
});

describe("splitHistoryVsRest", () => {
  it("splits history from everything else", () => {
    const s = splitHistoryVsRest(votes);
    expect(s.history).toMatchObject({ n: 3, right: 2 });
    expect(s.rest).toMatchObject({ n: 3, right: 1 });
    expect(s.total).toBe(6);
  });
});

describe("botLeaderboard", () => {
  const teams = { tA: { name: "Aloo" }, tB: { name: "Bhindi" }, tC: { name: "Chai" } };
  const bots = { tA: { text: "x" }, tB: { text: "y" }, tC: { text: "z" } };
  const bv = (bot, asker, verdict) => ({ uid: "u", botTeamId: bot, askerTeamId: asker, topic: "history", verdict, q: "q", at: 1 });
  const botVotes = {
    1: bv("tA", "tB", "right"), 2: bv("tA", "tC", "right"), 3: bv("tA", "tB", "wrong"), 4: bv("tA", "tA", "right"),
    5: bv("tB", "tA", "wrong"), 6: bv("tB", "tC", "nonsense"), 7: bv("tB", "tA", "right"), 8: bv("tB", "tC", "right"),
    9: bv("tC", "tA", "right"),
  };
  it("scores foreign votes only, excludes own votes, gates on MIN_FOREIGN_VOTES", () => {
    const rows = botLeaderboard(botVotes, teams, bots);
    const a = rows.find((r) => r.teamId === "tA"), b = rows.find((r) => r.teamId === "tB"), c = rows.find((r) => r.teamId === "tC");
    expect(a.foreign).toMatchObject({ n: 3, right: 2 }); expect(a.foreign.pct).toBeCloseTo(2 / 3, 6);
    expect(a.own).toMatchObject({ n: 1, right: 1, pct: 1 });
    expect(b.foreign).toMatchObject({ n: 4, right: 2, pct: 0.5 });
    expect(c.foreign).toMatchObject({ n: 1, right: 1, pct: null });
  });
  it("sorts by foreign pct desc with nulls last", () => {
    expect(botLeaderboard(botVotes, teams, bots).map((r) => r.teamId)).toEqual(["tA", "tB", "tC"]);
  });
  it("uses a fallback name for deleted teams and handles null input", () => {
    expect(botLeaderboard(null, {}, { tZ: { text: "q" } })[0]).toMatchObject({ teamId: "tZ", name: "Unknown team", foreign: { n: 0, pct: null } });
    expect(botLeaderboard(null, teams, null)).toEqual([]);
  });
});

describe("recentVotes", () => {
  it("returns newest first, limited", () => {
    expect(recentVotes(votes, 2).map((x) => x.at)).toEqual([6, 5]);
    expect(recentVotes(null)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail** — `npx vitest run src/lm/scoring.test.js` — Expected: FAIL.

- [ ] **Step 3: Write src/lm/scoring.js**

```js
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
```

- [ ] **Step 4: Run tests** — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lm/scoring.js src/lm/scoring.test.js
git commit -m "Add topic accuracy and bot leaderboard scoring"
```

---

### Task 5: Phases per activity — `src/rooms/phases.js`, `PhaseBar`

**Files:**
- Modify: `src/rooms/phases.js`, `src/rooms/phases.test.js`, `src/components/PhaseBar.jsx`, `src/components/PhaseBar.test.jsx`

**Interfaces:**
- Produces (in addition to the existing exports, which keep their activity-1 meaning):
  - `ACTIVITIES = { 1: { id: 1, title: "Teach the machine", emoji: "✏️", blurb }, 2: { id: 2, title: "Talk to the machine", emoji: "💬", blurb } }`
  - `PHASES_BY_ACTIVITY = { 1: ["lobby","teach","reveal","fence"], 2: ["lobby","chat","reveal","train","exam"] }`
  - `TABS_BY_ACTIVITY[2] = [lobby, chat "HistoryBot" 💬 minPhase chat, scoreboard "Scoreboard" 📊 minPhase reveal, trainbot "Train your bot" 🧪 minPhase train, exam "Cross-examine" 🎤 minPhase exam]`
  - `PHASE_ACTIONS_BY_ACTIVITY[2] = { lobby: "Start chatting", chat: "Reveal scoreboard", reveal: "Start training", train: "Open cross-examination" }`
  - `PHASE_NAMES_BY_ACTIVITY` for the PhaseBar "Now:" text.
  - `visibleTabs(role, phase, activity = 1)`, `nextPhase(phase, activity = 1)`, `phaseAction(phase, activity = 1)`, `supportsRounds(activity) → activity === 1`.
  - `PhaseBar({ phase, round, activity = 1, onAdvance, onNextRound, busy })` — Next round only when `supportsRounds(activity)` and phase is `reveal`.

- [ ] **Step 1: Add failing tests**

Append to `src/rooms/phases.test.js`:
```js
import { ACTIVITIES, PHASES_BY_ACTIVITY, TABS_BY_ACTIVITY, phaseAction, supportsRounds } from "./phases.js";

describe("activity 2 phases", () => {
  it("defines both activities", () => {
    expect(Object.keys(ACTIVITIES)).toEqual(["1", "2"]);
    expect(ACTIVITIES[2].title).toBe("Talk to the machine");
    expect(PHASES_BY_ACTIVITY[2]).toEqual(["lobby", "chat", "reveal", "train", "exam"]);
    expect(PHASES_BY_ACTIVITY[1]).toEqual(PHASES);
  });
  it("walks activity 2 phases forward", () => {
    expect(nextPhase("lobby", 2)).toBe("chat");
    expect(nextPhase("chat", 2)).toBe("reveal");
    expect(nextPhase("reveal", 2)).toBe("train");
    expect(nextPhase("train", 2)).toBe("exam");
    expect(nextPhase("exam", 2)).toBeNull();
    expect(nextPhase("reveal", 1)).toBe("fence");
  });
  it("labels every non-final activity 2 phase", () => {
    expect(phaseAction("lobby", 2)).toBe("Start chatting");
    expect(phaseAction("chat", 2)).toBe("Reveal scoreboard");
    expect(phaseAction("reveal", 2)).toBe("Start training");
    expect(phaseAction("train", 2)).toBe("Open cross-examination");
    expect(phaseAction("exam", 2)).toBeUndefined();
    expect(phaseAction("reveal", 1)).toBe("Open bendy fence");
  });
  it("gates activity 2 tabs for students", () => {
    expect(keys(visibleTabs("student", "lobby", 2))).toEqual(["lobby"]);
    expect(keys(visibleTabs("student", "chat", 2))).toEqual(["lobby", "chat"]);
    expect(keys(visibleTabs("student", "reveal", 2))).toEqual(["lobby", "chat", "scoreboard"]);
    expect(keys(visibleTabs("student", "train", 2))).toEqual(["lobby", "chat", "scoreboard", "trainbot"]);
    expect(keys(visibleTabs("student", "exam", 2))).toEqual(["lobby", "chat", "scoreboard", "trainbot", "exam"]);
    expect(keys(visibleTabs("teacher", "lobby", 2))).toEqual(["lobby", "chat", "scoreboard", "trainbot", "exam", "settings"]);
    expect(TABS_BY_ACTIVITY[2].every((t) => t.emoji && t.label)).toBe(true);
  });
  it("only activity 1 has rounds", () => {
    expect(supportsRounds(1)).toBe(true);
    expect(supportsRounds(2)).toBe(false);
  });
});
```
Append to `src/components/PhaseBar.test.jsx`:
```jsx
describe("PhaseBar activity 2", () => {
  it("uses activity 2 labels and never offers Next round", () => {
    const onAdvance = vi.fn();
    render(<PhaseBar phase="reveal" round={1} activity={2} onAdvance={onAdvance} onNextRound={() => {}} />);
    expect(screen.queryByRole("button", { name: /Next round/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Start training/ }));
    expect(onAdvance).toHaveBeenCalledWith("train");
    expect(screen.queryByText(/Round/)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail** — `npx vitest run src/rooms/phases.test.js src/components/PhaseBar.test.jsx` — Expected: FAIL.

- [ ] **Step 3: Rewrite src/rooms/phases.js**

```js
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
```

- [ ] **Step 4: Rewrite src/components/PhaseBar.jsx**

```jsx
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
```

- [ ] **Step 5: Run the two test files, then the full suite** — Expected: all PASS (existing activity-1 tests unchanged).

- [ ] **Step 6: Commit**

```bash
git add src/rooms/phases.js src/rooms/phases.test.js src/components/PhaseBar.jsx src/components/PhaseBar.test.jsx
git commit -m "Make phases and PhaseBar activity-aware"
```

---

### Task 6: Security rules for activity 2

**Files:**
- Modify: `database.rules.json`, `tests/rules/rules.test.js`

**Interfaces:**
- Produces: rules for `meta.activity`, extended `meta.phase` enum, `votes/$id`, `bots/$teamId`, `botVotes/$id`. Reset (activity 2) is one multi-path update by the teacher: `{ votes: null, bots: null, botVotes: null, "meta/phase": "chat" }`.

- [ ] **Step 1: Add failing tests**

Append to `tests/rules/rules.test.js` (inside the file, after the existing describes):
```js
describe("activity 2 meta", () => {
  it("activity must be 1 or 2", async () => {
    await assertSucceeds(db(TEACHER).ref(path("meta")).update({ activity: 2 }));
    await assertSucceeds(db(TEACHER).ref(path("meta")).update({ activity: 1 }));
    await assertFails(db(TEACHER).ref(path("meta")).update({ activity: 3 }));
    await assertFails(db(TEACHER).ref(path("meta")).update({ activity: "2" }));
  });
  it("accepts the activity 2 phases", async () => {
    for (const p of ["chat", "reveal", "train", "exam"]) await assertSucceeds(db(TEACHER).ref(path("meta")).update({ phase: p }));
    await assertFails(db(TEACHER).ref(path("meta")).update({ phase: "quiz" }));
  });
});

describe("votes (HistoryBot)", () => {
  const vote = (uid) => ({ uid, topic: "science", verdict: "wrong", q: "What is a cell?", a: "Akbar built a city.", known: 0, total: 2, at: 1 });
  it("a student can create a vote in their own name, once", async () => {
    await assertSucceeds(db("s1").ref(path("votes/v1")).set(vote("s1")));
    await assertFails(db("s1").ref(path("votes/v1")).update({ verdict: "right" }));
    await assertFails(db("s1").ref(path("votes/v1")).remove());
  });
  it("cannot vote as someone else or with bad values", async () => {
    await assertFails(db("s1").ref(path("votes/v2")).set(vote("s2")));
    await assertFails(db("s1").ref(path("votes/v3")).set({ ...vote("s1"), topic: "gossip" }));
    await assertFails(db("s1").ref(path("votes/v4")).set({ ...vote("s1"), verdict: "maybe" }));
    await assertFails(db("s1").ref(path("votes/v5")).set({ ...vote("s1"), q: "x".repeat(121) }));
    await assertFails(db("s1").ref(path("votes/v6")).set({ ...vote("s1"), a: "x".repeat(241) }));
  });
  it("only the teacher can wipe votes", async () => {
    await env.withSecurityRulesDisabled((ctx) => ctx.database().ref(path("votes/v9")).set(vote("s1")));
    await assertFails(db("s1").ref(path("votes")).remove());
    await assertSucceeds(db(TEACHER).ref(path("votes")).remove());
  });
});

describe("bots", () => {
  const bot = { text: "Akbar ruled the Mughal empire from Agra. Babur founded it.", sources: ["history"], sentBy: "s1", at: 1 };
  it("a member writes their own team's bot; not another team's", async () => {
    await assertSucceeds(db("s1").ref(path("bots/tA")).set(bot));
    await assertFails(db("s1").ref(path("bots/tB")).set(bot));
  });
  it("text is bounded 1..6000", async () => {
    await assertFails(db("s1").ref(path("bots/tA")).set({ ...bot, text: "" }));
    await assertFails(db("s1").ref(path("bots/tA")).set({ ...bot, text: "x".repeat(6001) }));
    await assertSucceeds(db("s1").ref(path("bots/tA")).set({ ...bot, text: "x".repeat(6000) }));
  });
  it("teacher can wipe bots", async () => {
    await env.withSecurityRulesDisabled((ctx) => ctx.database().ref(path("bots/tA")).set(bot));
    await assertFails(db("s2").ref(path("bots")).remove());
    await assertSucceeds(db(TEACHER).ref(path("bots")).remove());
  });
});

describe("botVotes (cross-examination)", () => {
  const bv = (uid) => ({ uid, askerTeamId: "tA", botTeamId: "tB", topic: "sport", verdict: "nonsense", q: "Who won in 1992?", at: 1 });
  it("create-only, own uid, valid enums", async () => {
    await assertSucceeds(db("s1").ref(path("botVotes/b1")).set(bv("s1")));
    await assertSucceeds(db("s3").ref(path("botVotes/b2")).set({ uid: "s3", botTeamId: "tA", topic: "other", verdict: "right", q: "q", at: 1 })); // no team
    await assertFails(db("s1").ref(path("botVotes/b1")).update({ verdict: "right" }));
    await assertFails(db("s1").ref(path("botVotes/b3")).set(bv("s2")));
    await assertFails(db("s1").ref(path("botVotes/b4")).set({ ...bv("s1"), topic: "gossip" }));
  });
  it("teacher can reset activity 2 in one update; a student cannot", async () => {
    await env.withSecurityRulesDisabled((ctx) => ctx.database().ref(path("votes/v1")).set({ uid: "s1", topic: "history", verdict: "right", q: "q", at: 1 }));
    const upd = { votes: null, bots: null, botVotes: null, "meta/phase": "chat" };
    await assertFails(db("s1").ref(`rooms/${CODE}`).update(upd));
    await assertSucceeds(db(TEACHER).ref(`rooms/${CODE}`).update(upd));
  });
});
```

- [ ] **Step 2: Run** `npm run test:rules` — Expected: the new tests FAIL (rules missing), old ones pass.

- [ ] **Step 3: Edit database.rules.json**

Inside `"meta"`, add after `"round"`:
```json
          "activity": { ".validate": "newData.isNumber() && (newData.val() === 1 || newData.val() === 2)" },
```
Replace the `"phase"` validate with:
```json
          "phase": { ".validate": "newData.isString() && (newData.val() === 'lobby' || newData.val() === 'teach' || newData.val() === 'reveal' || newData.val() === 'fence' || newData.val() === 'chat' || newData.val() === 'train' || newData.val() === 'exam')" },
```
Add these three nodes as siblings of `"challenges"` (inside `"$code"`, before the final `"$other"`):
```json
        "votes": {
          ".write": "auth != null && root.child('rooms/' + $code + '/meta/teacherUid').val() === auth.uid",
          "$id": {
            ".write": "auth != null && !data.exists() && newData.exists() && newData.child('uid').val() === auth.uid",
            ".validate": "newData.hasChildren(['uid', 'topic', 'verdict', 'q'])",
            "uid": { ".validate": "newData.isString()" },
            "topic": { ".validate": "newData.isString() && (newData.val() === 'history' || newData.val() === 'science' || newData.val() === 'sport' || newData.val() === 'maths' || newData.val() === 'everyday' || newData.val() === 'other')" },
            "verdict": { ".validate": "newData.isString() && (newData.val() === 'right' || newData.val() === 'wrong' || newData.val() === 'nonsense')" },
            "q": { ".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 120" },
            "a": { ".validate": "newData.isString() && newData.val().length <= 240" },
            "known": { ".validate": "newData.isNumber()" },
            "total": { ".validate": "newData.isNumber()" },
            "at": { ".validate": "newData.isNumber()" },
            "$other": { ".validate": false }
          }
        },

        "bots": {
          ".write": "auth != null && root.child('rooms/' + $code + '/meta/teacherUid').val() === auth.uid",
          "$teamId": {
            ".write": "auth != null && root.child('rooms/' + $code + '/members/' + auth.uid + '/teamId').val() === $teamId",
            ".validate": "newData.hasChildren(['text', 'sentBy'])",
            "text": { ".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 6000" },
            "sources": { "$i": { ".validate": "newData.isString() && newData.val().length <= 24" } },
            "sentBy": { ".validate": "newData.isString()" },
            "at": { ".validate": "newData.isNumber()" },
            "$other": { ".validate": false }
          }
        },

        "botVotes": {
          ".write": "auth != null && root.child('rooms/' + $code + '/meta/teacherUid').val() === auth.uid",
          "$id": {
            ".write": "auth != null && !data.exists() && newData.exists() && newData.child('uid').val() === auth.uid",
            ".validate": "newData.hasChildren(['uid', 'botTeamId', 'topic', 'verdict', 'q'])",
            "uid": { ".validate": "newData.isString()" },
            "askerTeamId": { ".validate": "newData.isString()" },
            "botTeamId": { ".validate": "newData.isString()" },
            "topic": { ".validate": "newData.isString() && (newData.val() === 'history' || newData.val() === 'science' || newData.val() === 'sport' || newData.val() === 'maths' || newData.val() === 'everyday' || newData.val() === 'other')" },
            "verdict": { ".validate": "newData.isString() && (newData.val() === 'right' || newData.val() === 'wrong' || newData.val() === 'nonsense')" },
            "q": { ".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 120" },
            "at": { ".validate": "newData.isNumber()" },
            "$other": { ".validate": false }
          }
        },
```

- [ ] **Step 4: Run** `npm run test:rules` — Expected: all PASS (31 + 11 = 42). Also `npm test` unchanged.

- [ ] **Step 5: Commit**

```bash
git add database.rules.json tests/rules/rules.test.js
git commit -m "Add rules for activity, votes, bots and cross-examination votes"
```

---

### Task 7: API and hooks for activity 2

**Files:**
- Modify: `src/rooms/api.js`, `src/rooms/api.test.js`, `src/rooms/hooks.js`, `src/rooms/hooks.test.jsx`

**Interfaces:**
- Consumes: `TOPIC_IDS`, `VERDICT_IDS` (Task 4).
- Produces in `api.js`: `MAX_Q = 120`, `MAX_A = 240`, `MAX_BOT_TEXT = 6000`, `MIN_BOT_WORDS = 150`; `createRoom({ …, activity = 1 })` writes `meta.activity`; pure `buildVote({ uid, topic, verdict, q, a, known, total })` and `buildBotVote({ uid, askerTeamId, botTeamId, topic, verdict, q })` (throw `Error("invalid topic")` / `Error("invalid verdict")`, trim and clamp strings, omit `askerTeamId` when falsy); `castVote({ code, ...vote })`, `castBotVote({ code, ...vote })`, `sendBot({ code, teamId, uid, text, sources })`; `resetBoard({ code, activity = 1 })`.
- Produces in `hooks.js`: `useVotes(code, enabled)`, `useBots(code, enabled)`, `useBotVotes(code, enabled)`, `useTeamBot(code, teamId)` — same shapes as the existing `usePath`-based hooks.

- [ ] **Step 1: Add failing tests**

Append to `src/rooms/api.test.js` (extend the import line to include `buildVote, buildBotVote, MAX_Q, MAX_A, MAX_BOT_TEXT, MIN_BOT_WORDS`):
```js
describe("buildVote / buildBotVote", () => {
  it("trims and clamps, validates enums", () => {
    const v = buildVote({ uid: "u1", topic: "science", verdict: "wrong", q: "  " + "x".repeat(200), a: "y".repeat(300), known: "1", total: 3 });
    expect(v.q).toHaveLength(MAX_Q);
    expect(v.a).toHaveLength(MAX_A);
    expect(v.known).toBe(1);
    expect(v.total).toBe(3);
    expect(v.at).toBeTruthy();
    expect(() => buildVote({ uid: "u1", topic: "gossip", verdict: "wrong", q: "q" })).toThrow(/topic/);
    expect(() => buildVote({ uid: "u1", topic: "science", verdict: "maybe", q: "q" })).toThrow(/verdict/);
  });
  it("bot vote omits askerTeamId when the asker has no team", () => {
    const b = buildBotVote({ uid: "u1", askerTeamId: null, botTeamId: "tB", topic: "sport", verdict: "right", q: "q" });
    expect(b).not.toHaveProperty("askerTeamId");
    expect(b.botTeamId).toBe("tB");
    const c = buildBotVote({ uid: "u1", askerTeamId: "tA", botTeamId: "tB", topic: "sport", verdict: "right", q: "q" });
    expect(c.askerTeamId).toBe("tA");
  });
  it("limits", () => {
    expect(MAX_BOT_TEXT).toBe(6000);
    expect(MIN_BOT_WORDS).toBe(150);
  });
});
```
Append to `src/rooms/hooks.test.jsx` (extend the import to include `useVotes, useBots, useBotVotes, useTeamBot`):
```jsx
describe("activity 2 hooks", () => {
  it("subscribe to the right paths and honour enabled", () => {
    renderHook(() => useVotes("ABCDE", true));
    renderHook(() => useBots("ABCDE", true));
    renderHook(() => useBotVotes("ABCDE", false));
    renderHook(() => useTeamBot("ABCDE", "tA"));
    renderHook(() => useTeamBot("ABCDE", null));
    expect(subs.has("rooms/ABCDE/votes")).toBe(true);
    expect(subs.has("rooms/ABCDE/bots")).toBe(true);
    expect(subs.has("rooms/ABCDE/botVotes")).toBe(false);
    expect(subs.has("rooms/ABCDE/bots/tA")).toBe(true);
  });
});
```

- [ ] **Step 2: Run** the two test files — Expected: FAIL.

- [ ] **Step 3: Edit src/rooms/api.js**

Add imports and constants near the top:
```js
import { TOPIC_IDS, VERDICT_IDS } from "../lm/scoring.js";
export const MAX_Q = 120;
export const MAX_A = 240;
export const MAX_BOT_TEXT = 6000;
export const MIN_BOT_WORDS = 150;
```
Change `createRoom`'s signature and meta:
```js
export async function createRoom({ uid, labels = DEFAULT_LABELS, teamCap = DEFAULT_TEAM_CAP, maxTeams = null, activity = 1 }) {
  …
    await set(roomRef(code, "meta"), {
      labels: [...],
      teamCap: clampCap(teamCap),
      ...(limit ? { maxTeams: limit } : {}),
      activity: Number(activity) === 2 ? 2 : 1,
      round: 1,
      phase: "lobby",
      teacherUid: uid,
      createdAt: serverTimestamp(),
    });
```
Replace `resetBoard`:
```js
export const resetBoard = ({ code, activity = 1 }) =>
  Number(activity) === 2
    ? update(roomRef(code), { votes: null, bots: null, botVotes: null, "meta/phase": "chat" })
    : update(roomRef(code), { models: null, challenges: null, rounds: null, "meta/phase": "teach", "meta/round": 1 });
```
Append a new section:
```js
// ── activity 2: votes and bots ────────────────────────────────────────────
const clampStr = (s, n) => String(s ?? "").trim().slice(0, n);
const checkEnums = (topic, verdict) => {
  if (!TOPIC_IDS.includes(topic)) throw new Error(`invalid topic: ${topic}`);
  if (!VERDICT_IDS.includes(verdict)) throw new Error(`invalid verdict: ${verdict}`);
};

export function buildVote({ uid, topic, verdict, q, a = "", known = 0, total = 0 }) {
  checkEnums(topic, verdict);
  return { uid, topic, verdict, q: clampStr(q, MAX_Q), a: clampStr(a, MAX_A), known: Number(known) || 0, total: Number(total) || 0, at: serverTimestamp() };
}
export const castVote = ({ code, ...vote }) => set(push(roomRef(code, "votes")), buildVote(vote));

export function buildBotVote({ uid, askerTeamId, botTeamId, topic, verdict, q }) {
  checkEnums(topic, verdict);
  return { uid, ...(askerTeamId ? { askerTeamId } : {}), botTeamId, topic, verdict, q: clampStr(q, MAX_Q), at: serverTimestamp() };
}
export const castBotVote = ({ code, ...vote }) => set(push(roomRef(code, "botVotes")), buildBotVote(vote));

export const sendBot = ({ code, teamId, uid, text, sources = [] }) =>
  set(roomRef(code, `bots/${teamId}`), {
    text: clampStr(text, MAX_BOT_TEXT),
    ...(sources.length ? { sources: sources.slice(0, 8).map((s) => clampStr(s, 24)) } : {}),
    sentBy: uid,
    at: serverTimestamp(),
  });
```

- [ ] **Step 4: Edit src/rooms/hooks.js** — append:
```js
export const useVotes = (code, enabled = true) => usePath(code ? `rooms/${code}/votes` : null, enabled);
export const useBots = (code, enabled = true) => usePath(code ? `rooms/${code}/bots` : null, enabled);
export const useBotVotes = (code, enabled = true) => usePath(code ? `rooms/${code}/botVotes` : null, enabled);
export const useTeamBot = (code, teamId) => usePath(code && teamId ? `rooms/${code}/bots/${teamId}` : null, Boolean(teamId));
```

- [ ] **Step 5: Run** the two test files, then `npm test` — Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/rooms/api.js src/rooms/api.test.js src/rooms/hooks.js src/rooms/hooks.test.jsx
git commit -m "Add activity 2 API (votes, bots) and hooks"
```

---

### Task 8: Choose an activity — `ActivityPick`, `App`, `Landing`, `TeacherCreate`

**Files:**
- Create: `src/screens/ActivityPick.jsx`, `src/screens/ActivityPick.test.jsx`
- Modify: `src/App.jsx`, `src/screens/Landing.jsx`, `src/screens/Landing.test.jsx`, `src/screens/TeacherCreate.jsx`

**Interfaces:**
- Consumes: `ACTIVITIES` (Task 5), `createRoom({ activity })` (Task 7).
- Produces:
  - `ActivityPick({ onPick(activityId), rejoinCode, onRejoin })` — first screen; two cards from `ACTIVITIES`; rejoin button when `rejoinCode`.
  - `Landing({ onChoose, activity = 1, onBack })` — shows "Activity N · title" badge and a "← Change activity" button when `onBack` is given. The old `rejoinCode`/`onRejoin` props are removed from Landing (moved to ActivityPick).
  - `TeacherCreate({ uid, activity = 1, onCreated, onBack })` — hides the label pair for activity 2, titles the form with the activity, passes `activity` to `createRoom`.
  - `App`: `activity` state; flow `ActivityPick → Landing → TeacherCreate | StudentJoin → Room`.

- [ ] **Step 1: Write/adjust tests**

`src/screens/ActivityPick.test.jsx`:
```jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ActivityPick } from "./ActivityPick.jsx";

describe("ActivityPick", () => {
  it("offers both activities", () => {
    const onPick = vi.fn();
    render(<ActivityPick onPick={onPick} />);
    fireEvent.click(screen.getByRole("button", { name: /Teach the machine/ }));
    expect(onPick).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByRole("button", { name: /Talk to the machine/ }));
    expect(onPick).toHaveBeenCalledWith(2);
  });
  it("offers to rejoin the last room", () => {
    const onRejoin = vi.fn();
    render(<ActivityPick onPick={vi.fn()} rejoinCode="ABCDE" onRejoin={onRejoin} />);
    fireEvent.click(screen.getByRole("button", { name: /Rejoin room ABCDE/ }));
    expect(onRejoin).toHaveBeenCalledWith("ABCDE");
    expect(screen.queryByRole("button", { name: /Rejoin room/ })).toBeTruthy();
  });
});
```
Replace `src/screens/Landing.test.jsx` with:
```jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Landing } from "./Landing.jsx";

describe("Landing", () => {
  it("asks teacher or student and reports the choice", () => {
    const onChoose = vi.fn();
    render(<Landing onChoose={onChoose} activity={1} />);
    expect(screen.getByText(/Are you a teacher or a student\?/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Teacher/ }));
    expect(onChoose).toHaveBeenCalledWith("teacher");
    fireEvent.click(screen.getByRole("button", { name: /Student/ }));
    expect(onChoose).toHaveBeenCalledWith("student");
  });
  it("shows the chosen activity and lets you change it", () => {
    const onBack = vi.fn();
    render(<Landing onChoose={vi.fn()} activity={2} onBack={onBack} />);
    expect(screen.getByText(/Talk to the machine/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Change activity/ }));
    expect(onBack).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/screens/ActivityPick.test.jsx src/screens/Landing.test.jsx` — Expected: FAIL.

- [ ] **Step 3: Write src/screens/ActivityPick.jsx**

```jsx
import { S, C } from "../theme.js";
import { ACTIVITIES } from "../rooms/phases.js";

export function ActivityPick({ onPick, rejoinCode, onRejoin }) {
  return (
    <div style={S.center}>
      <div className="nl-fade" style={{ ...S.centerCard, maxWidth: 680 }}>
        <div className="nl-bounce" style={{ fontSize: 64, lineHeight: 1 }} aria-hidden="true">🧠</div>
        <h1 style={S.h1}>Neural Lab</h1>
        <p style={{ ...S.lede, margin: "0 auto 18px" }}>Two lessons on what a machine really learns.</p>
        {rejoinCode && (
          <button className="nl-btn" style={{ ...S.accent, width: "100%", marginBottom: 18 }} onClick={() => onRejoin(rejoinCode)}>
            Rejoin room {rejoinCode} →
          </button>
        )}
        <p style={{ ...S.label, fontSize: 16 }}>Choose an activity</p>
        <div style={S.choiceGrid}>
          {Object.values(ACTIVITIES).map((a) => (
            <button key={a.id} className="nl-btn" style={S.choiceCard} onClick={() => onPick(a.id)}>
              <span style={S.badge}>Activity {a.id}</span>
              <div style={{ ...S.choiceEmoji, marginTop: 10 }} aria-hidden="true">{a.emoji}</div>
              <div style={S.choiceTitle}>{a.title}</div>
              <div style={{ ...S.choiceSub, color: C.muted }}>{a.blurb}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Rewrite src/screens/Landing.jsx**

```jsx
import { S } from "../theme.js";
import { ACTIVITIES } from "../rooms/phases.js";

export function Landing({ onChoose, activity = 1, onBack }) {
  const a = ACTIVITIES[activity] || ACTIVITIES[1];
  return (
    <div style={S.center}>
      <div className="nl-fade" style={{ ...S.centerCard, maxWidth: 640 }}>
        <div style={{ fontSize: 56, lineHeight: 1 }} aria-hidden="true">{a.emoji}</div>
        <span style={{ ...S.badge, marginTop: 10 }}>Activity {a.id}</span>
        <h1 style={{ ...S.h1, marginTop: 8 }}>{a.title}</h1>
        <p style={{ ...S.lede, margin: "0 auto 18px" }}>{a.blurb}</p>
        <p style={{ ...S.label, fontSize: 16 }}>Are you a teacher or a student?</p>
        <div style={S.choiceGrid}>
          <button className="nl-btn" style={S.choiceCard} onClick={() => onChoose("teacher")}>
            <div style={S.choiceEmoji} aria-hidden="true">👩‍🏫</div>
            <div style={S.choiceTitle}>Teacher</div>
            <div style={S.choiceSub}>Create a room for your class</div>
          </button>
          <button className="nl-btn" style={S.choiceCard} onClick={() => onChoose("student")}>
            <div style={S.choiceEmoji} aria-hidden="true">🙋</div>
            <div style={S.choiceTitle}>Student</div>
            <div style={S.choiceSub}>Join with a room code</div>
          </button>
        </div>
        {onBack && <button className="nl-btn" style={{ ...S.tiny, marginTop: 18 }} onClick={onBack}>← Change activity</button>}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Edit src/screens/TeacherCreate.jsx**

- Signature: `export function TeacherCreate({ uid, activity = 1, onCreated, onBack })`.
- Import `ACTIVITIES` from `../rooms/phases.js`; `const act = ACTIVITIES[activity] || ACTIVITIES[1]; const isTalk = act.id === 2;`
- `createRoom({ uid, labels: [a, b], teamCap: cap, maxTeams, activity: act.id })`.
- Heading: `<h1 style={S.h1}>Create a room</h1>` followed by `<span style={S.badge}>Activity {act.id} · {act.title}</span>`.
- Wrap the hint paragraph and the two label fields in `{!isTalk && ( … )}`. For activity 2 show instead:
  `<p style={{ ...S.hint, margin: "0 auto" }}>Students will question HistoryBot, then train bots of their own. Teams of up to {cap}.</p>`
- Submit `disabled={busy || (!isTalk && (!a.trim() || !b.trim()))}`.

- [ ] **Step 6: Edit src/App.jsx**

- Import `ActivityPick` from `./screens/ActivityPick.jsx`.
- In `Shell`: add `const [activity, setActivity] = useState(null);` and make `exit` also `setActivity(null)`.
- Replace the tail of `Shell`:
```jsx
  if (code) return <Room code={code} uid={uid} onExit={exit} />;
  if (!activity) return <ActivityPick onPick={setActivity} rejoinCode={lastCode()} onRejoin={enter} />;
  if (choice === "teacher") return <TeacherCreate uid={uid} activity={activity} onCreated={enter} onBack={() => setChoice(null)} />;
  if (choice === "student") return <StudentJoin uid={uid} onJoined={enter} onExit={() => setChoice(null)} />;
  return <Landing activity={activity} onChoose={setChoice} onBack={() => setActivity(null)} />;
```

- [ ] **Step 7: Run** `npm test && npm run build` — Expected: PASS, build OK.

- [ ] **Step 8: Commit**

```bash
git add src/App.jsx src/screens/ActivityPick.jsx src/screens/ActivityPick.test.jsx src/screens/Landing.jsx src/screens/Landing.test.jsx src/screens/TeacherCreate.jsx
git commit -m "Add activity chooser; teacher create carries the activity"
```

---

### Task 9: `BotChat` and `Corpus` components, theme keys

**Files:**
- Modify: `src/theme.js`, `src/theme.test.js`
- Create: `src/components/BotChat.jsx`, `src/components/BotChat.test.jsx`, `src/components/Corpus.jsx`, `src/components/Corpus.test.jsx`

**Interfaces:**
- Consumes: `trainModel`, `coverage`, `generate` (Task 2); `TOPICS`, `VERDICTS` (Task 4).
- Produces:
  - New `S` keys: `chatWrap, bubbleQ, bubbleA, bubbleWho, topicChip, topicChipOn, voteRow, voteBtn, voteBtnOn, coverage, hintText, corpus, hl, textCard, textCardOn, counter, feedItem, botCard, botCardOn`.
  - `BotChat({ model, botName = "HistoryBot", requireTopic = true, requireVote = true, onAsk, onVote, placeholder })`. Entries oldest→newest; only the latest entry shows "Ask again" and the vote row. `onAsk(entry)` after every generation (including Ask again); `onVote(entry, verdict)`. Entry: `{ id, q, a, topic, known, total, knownWords, unknownWords, seededFrom, attempt, verdict }`.
  - `Corpus({ text, highlight = [] })` renders paragraphs; highlighted words wrapped in `<mark>`.

- [ ] **Step 1: Add theme keys and extend the theme test list**

Append inside `S` in `src/theme.js` (before the closing `};`):
```js
  chatWrap: { display: "grid", gap: 10, marginTop: 14 },
  bubbleQ: { justifySelf: "end", maxWidth: "85%", background: C.sky, color: C.paper, borderRadius: "18px 18px 4px 18px", padding: "10px 14px", fontSize: 15, fontWeight: 600 },
  bubbleA: { justifySelf: "start", maxWidth: "92%", background: C.soft, color: C.ink, borderRadius: "18px 18px 18px 4px", padding: "10px 14px", fontSize: 15, lineHeight: 1.5 },
  bubbleWho: { fontSize: 11, fontWeight: 800, color: C.mangoDeep, marginBottom: 4, textTransform: "uppercase", letterSpacing: ".04em" },
  topicChip: { ...pill, padding: "6px 12px", fontSize: 12.5, background: C.paper, color: C.ink, border: `2px solid ${C.line}` },
  topicChipOn: { background: C.ink, color: C.paper, borderColor: C.ink },
  voteRow: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 },
  voteBtn: { ...pill, padding: "8px 14px", fontSize: 13, background: C.paper, color: C.ink, border: `2px solid ${C.line}` },
  voteBtnOn: { background: C.sun, borderColor: C.sun },
  coverage: { fontSize: 12, color: C.muted, fontWeight: 700, marginTop: 6 },
  hintText: { fontSize: 13, color: C.mangoDeep, fontWeight: 800, marginTop: 8 },
  corpus: { background: C.paper, borderRadius: 16, padding: 16, fontSize: 14, lineHeight: 1.7, color: C.ink, maxHeight: 420, overflowY: "auto", border: `3px solid ${C.line}` },
  hl: { background: C.sun, borderRadius: 4, padding: "0 3px" },
  textCard: { ...card, padding: 14, cursor: "pointer", border: "3px solid transparent", textAlign: "left" },
  textCardOn: { border: `3px solid ${C.leaf}` },
  counter: { fontSize: 12, color: C.muted, fontWeight: 700, textAlign: "right" },
  feedItem: { background: C.paper, borderRadius: 14, padding: "10px 14px", fontSize: 14, lineHeight: 1.5 },
  botCard: { ...card, padding: 14, cursor: "pointer", border: "3px solid transparent", textAlign: "left" },
  botCardOn: { border: `3px solid ${C.sky}` },
```
In `src/theme.test.js`, add these key names to the `needed` array.

- [ ] **Step 2: Write the failing component tests**

`src/components/BotChat.test.jsx`:
```jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BotChat } from "./BotChat.jsx";
import { trainModel } from "../lm/ngram.js";

const model = trainModel("Akbar ruled the Mughal empire from Agra. Akbar built a new city. The Mughal empire grew under Akbar. Babur founded the Mughal empire. Shah Jahan built the Taj Mahal at Agra.");

describe("BotChat", () => {
  it("requires a topic, then answers with a coverage line", () => {
    const onAsk = vi.fn();
    render(<BotChat model={model} onAsk={onAsk} />);
    fireEvent.change(screen.getByLabelText("Your question"), { target: { value: "Who built the Taj Mahal?" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(screen.getByText(/Pick a topic/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /History/ }));
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(onAsk).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Recognised 3 of 3 words in your question.")).toBeTruthy();
    expect(screen.getByText("Who built the Taj Mahal?")).toBeTruthy();
  });
  it("blocks the next question until the last answer is voted on, then records the vote", () => {
    const onVote = vi.fn();
    render(<BotChat model={model} onVote={onVote} />);
    fireEvent.click(screen.getByRole("button", { name: /Science/ }));
    fireEvent.change(screen.getByLabelText("Your question"), { target: { value: "What is a cell?" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(screen.getByText("Recognised 0 of 1 words in your question.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Your question"), { target: { value: "Another?" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(screen.getByText(/Vote on the last answer first/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Nonsense/ }));
    expect(onVote).toHaveBeenCalledWith(expect.objectContaining({ q: "What is a cell?", topic: "science", verdict: "nonsense" }), "nonsense");
  });
  it("Ask again regenerates and clears the vote; requireVote=false hides votes", () => {
    const onAsk = vi.fn();
    render(<BotChat model={model} requireVote={false} requireTopic={false} onAsk={onAsk} />);
    fireEvent.change(screen.getByLabelText("Your question"), { target: { value: "Akbar" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(screen.queryByRole("button", { name: /Right/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Ask again/ }));
    expect(onAsk).toHaveBeenCalledTimes(2);
    expect(onAsk.mock.calls[1][0].attempt).toBe(1);
  });
});
```
`src/components/Corpus.test.jsx`:
```jsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Corpus } from "./Corpus.jsx";

describe("Corpus", () => {
  it("renders the text and highlights the given words case-insensitively", () => {
    render(<Corpus text={"Akbar ruled from Agra.\n\nBabur founded the empire."} highlight={["agra", "babur"]} />);
    const marks = screen.getAllByText((_, el) => el.tagName === "MARK");
    expect(marks.map((m) => m.textContent)).toEqual(["Agra", "Babur"]);
    expect(screen.getByText(/ruled from/)).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run** `npx vitest run src/components/BotChat.test.jsx src/components/Corpus.test.jsx src/theme.test.js` — Expected: component tests FAIL (missing modules), theme test PASS after Step 1.

- [ ] **Step 4: Write src/components/BotChat.jsx**

```jsx
import { useRef, useState } from "react";
import { S, C } from "../theme.js";
import { TOPICS, VERDICTS } from "../lm/scoring.js";
import { generate, coverage } from "../lm/ngram.js";

export function BotChat({ model, botName = "HistoryBot", requireTopic = true, requireVote = true, onAsk, onVote, placeholder = "Ask anything…", maxQ = 120 }) {
  const [topic, setTopic] = useState(null);
  const [q, setQ] = useState("");
  const [entries, setEntries] = useState([]);
  const [hint, setHint] = useState("");
  const idRef = useRef(0);
  const last = entries[entries.length - 1];
  const needVote = requireVote && last && !last.verdict;

  const ask = (e) => {
    e?.preventDefault();
    const text = q.trim();
    if (!text) { setHint("Type a question first."); return; }
    if (requireTopic && !topic) { setHint("Pick a topic for your question first."); return; }
    if (needVote) { setHint("Vote on the last answer first."); return; }
    const cov = coverage(model, text);
    const { text: a, seededFrom } = generate(model, text, { seed: 0 });
    const entry = { id: ++idRef.current, q: text, a, topic, ...cov, seededFrom, attempt: 0, verdict: null };
    setEntries((es) => [...es, entry]); setQ(""); setHint("");
    onAsk?.(entry);
  };
  const askAgain = () => {
    if (!last) return;
    const attempt = last.attempt + 1;
    const { text: a, seededFrom } = generate(model, last.q, { seed: attempt });
    const upd = { ...last, a, seededFrom, attempt, verdict: null };
    setEntries((es) => [...es.slice(0, -1), upd]); setHint("");
    onAsk?.(upd);
  };
  const vote = (v) => {
    if (!last) return;
    const upd = { ...last, verdict: v };
    setEntries((es) => [...es.slice(0, -1), upd]); setHint("");
    onVote?.(upd, v);
  };

  return (
    <div>
      {requireTopic && (
        <div style={S.pickRow} role="group" aria-label="Topic of your question">
          {TOPICS.map((t) => (
            <button key={t.id} type="button" className="nl-btn" style={{ ...S.topicChip, ...(topic === t.id ? S.topicChipOn : null) }} onClick={() => setTopic(t.id)}>
              <span aria-hidden="true">{t.emoji}</span> {t.label}
            </button>
          ))}
        </div>
      )}
      <form onSubmit={ask} style={S.row}>
        <input className="nl-in" style={{ ...S.input, flex: 1, minWidth: 180 }} value={q} maxLength={maxQ} placeholder={placeholder}
          onChange={(e) => setQ(e.target.value)} aria-label="Your question" />
        <button type="submit" className="nl-btn" style={S.primary}>Ask</button>
      </form>
      {hint && <p style={S.hintText}>{hint}</p>}

      <div style={S.chatWrap}>
        {entries.map((en, i) => {
          const isLast = i === entries.length - 1;
          return (
            <div key={en.id} style={{ display: "grid", gap: 6 }} className="nl-fade">
              <div style={S.bubbleQ}>{en.q}</div>
              <div style={S.bubbleA}>
                <div style={S.bubbleWho}>{botName}</div>
                {en.a}
                <div style={S.coverage}>Recognised {en.known} of {en.total} words in your question.</div>
                {isLast && (
                  <div style={S.voteRow}>
                    {requireVote && VERDICTS.map((v) => (
                      <button key={v.id} type="button" className="nl-btn" style={{ ...S.voteBtn, ...(en.verdict === v.id ? S.voteBtnOn : null) }} onClick={() => vote(v.id)}>
                        <span aria-hidden="true">{v.emoji}</span> {v.label}
                      </button>
                    ))}
                    <button type="button" className="nl-btn" style={{ ...S.tiny, color: C.skyDeep }} onClick={askAgain}>↺ Ask again</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Write src/components/Corpus.jsx**

```jsx
import { S } from "../theme.js";

export function Corpus({ text, highlight = [] }) {
  const hl = new Set(highlight.map((w) => String(w).toLowerCase()));
  const paras = String(text || "").split(/\n\s*\n/).filter((p) => p.trim());
  return (
    <div style={S.corpus}>
      {paras.map((p, i) => (
        <p key={i} style={{ margin: i ? "10px 0 0" : 0 }}>
          {p.split(/(\s+)/).map((piece, k) => {
            const core = piece.toLowerCase().replace(/[^a-z0-9']/g, "");
            return core && hl.has(core) ? <mark key={k} style={S.hl}>{piece}</mark> : piece;
          })}
        </p>
      ))}
    </div>
  );
}
```
Note for the Corpus test: `mark` wraps the whole piece including trailing punctuation ("Agra." → the test expects `"Agra"`). Make the highlight wrap only the word: split each piece into `[lead, word, trail]` with `/^([^a-z0-9']*)([a-z0-9']+)(.*)$/i` and wrap only the word in `<mark>`; return `<span key>{lead}<mark>{word}</mark>{trail}</span>`.

- [ ] **Step 6: Run** the three test files, then `npm test` — Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/theme.js src/theme.test.js src/components/BotChat.jsx src/components/BotChat.test.jsx src/components/Corpus.jsx src/components/Corpus.test.jsx
git commit -m "Add BotChat and Corpus components with theme keys"
```

---

### Task 10: `Chat` and `Scoreboard` screens

**Files:**
- Create: `src/screens/Chat.jsx`, `src/screens/Scoreboard.jsx`, `src/screens/Scoreboard.test.jsx`

**Interfaces:**
- Consumes: RoomProps `{ code, uid, meta, members, teams, labels, team, isTeacher, flash, round, activity }` (Task 12 adds `activity`); `HISTORY_TEXT` (Task 3); `trainModel`, `modelStats` (Task 2); `BotChat`, `Corpus` (Task 9); `castVote` (Task 7); `useVotes`, `useBots`, `useBotVotes` (Task 7); scoring (Task 4); `pct` from `src/ml/net.js`.
- Produces: `Chat(RoomProps)`, `Scoreboard(RoomProps)`.

- [ ] **Step 1: Write the failing Scoreboard test**

`src/screens/Scoreboard.test.jsx`:
```jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

let votesValue = null, botsValue = null, botVotesValue = null;
vi.mock("../rooms/hooks.js", () => ({
  useVotes: () => ({ value: votesValue, loading: false }),
  useBots: () => ({ value: botsValue, loading: false }),
  useBotVotes: () => ({ value: botVotesValue, loading: false }),
}));

import { Scoreboard } from "./Scoreboard.jsx";

const v = (topic, verdict, i) => ({ uid: "u", topic, verdict, q: `q${i}`, a: `a${i}`, known: 1, total: 2, at: i });
const many = () => {
  const out = {};
  for (let i = 0; i < 8; i++) out[`h${i}`] = v("history", i < 6 ? "right" : "wrong", i);
  for (let i = 0; i < 6; i++) out[`s${i}`] = v("science", i === 0 ? "right" : "nonsense", 10 + i);
  return out;
};
const base = { code: "ABCDE", teams: { tA: { name: "Aloo" }, tB: { name: "Bhindi" } }, isTeacher: true, meta: { phase: "reveal", activity: 2 } };

describe("Scoreboard", () => {
  it("waits below ten votes", () => {
    votesValue = { a: v("history", "right", 1) };
    render(<Scoreboard {...base} />);
    expect(screen.getByText(/waiting for questions/i)).toBeTruthy();
  });
  it("shows per-topic bars, the headline split and the question", () => {
    votesValue = many();
    render(<Scoreboard {...base} />);
    expect(screen.getByText(/It answered 14 questions/)).toBeTruthy();
    expect(screen.getByText(/75% of history/)).toBeTruthy();
    expect(screen.getByText(/17% of everything else/)).toBeTruthy();
    expect(screen.getByText("It never once said 'I don't know'. Why not?")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Show me everything it has ever read" })).toBeTruthy();
  });
  it("shows the cross-examination leaderboard once the exam is open", () => {
    votesValue = many();
    botsValue = { tA: { text: "x" }, tB: { text: "y" } };
    botVotesValue = {
      1: { uid: "u", askerTeamId: "tB", botTeamId: "tA", topic: "history", verdict: "right", q: "q", at: 1 },
      2: { uid: "u", askerTeamId: "tB", botTeamId: "tA", topic: "history", verdict: "right", q: "q", at: 2 },
      3: { uid: "u", askerTeamId: "tB", botTeamId: "tA", topic: "history", verdict: "wrong", q: "q", at: 3 },
    };
    render(<Scoreboard {...base} meta={{ phase: "exam", activity: 2 }} />);
    expect(screen.getByText("Every bot is now questioned by strangers. Which one survived?")).toBeTruthy();
    expect(screen.getByText(/Aloo/)).toBeTruthy();
    expect(screen.getByText("67%")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/screens/Scoreboard.test.jsx` — Expected: FAIL (module missing).

- [ ] **Step 3: Write src/screens/Chat.jsx**

```jsx
import { useMemo, useState } from "react";
import { S, C } from "../theme.js";
import { HISTORY_TEXT } from "../lm/texts/index.js";
import { trainModel, modelStats } from "../lm/ngram.js";
import { castVote } from "../rooms/api.js";
import { BotChat } from "../components/BotChat.jsx";
import { Corpus } from "../components/Corpus.jsx";

export function Chat({ code, uid, isTeacher, flash }) {
  const model = useMemo(() => trainModel(HISTORY_TEXT), []);
  const stats = modelStats(model);
  const [showCorpus, setShowCorpus] = useState(false);
  const [lastKnown, setLastKnown] = useState([]);

  const onVote = async (entry, verdict) => {
    if (isTeacher) return; // teachers can try the bot; only students' votes count
    try { await castVote({ code, uid, topic: entry.topic, verdict, q: entry.q, a: entry.a, known: entry.known, total: entry.total }); }
    catch { flash("Could not reach the class board."); }
  };

  return (
    <main style={S.main}>
      <section style={{ ...S.card, gridColumn: "1 / -1" }} className="nl-fade">
        <h2 style={S.h2}>💬 HistoryBot</h2>
        <p style={S.lede}>HistoryBot has read one thing in its life: 2,000 words about South Asian history. Ask it anything.</p>
        <p style={S.hint}>Pick the topic of your question, ask, then tell the class whether the answer was right. {isTeacher ? "(Teacher votes are not counted.)" : ""}</p>
        <BotChat model={model} botName="HistoryBot" onAsk={(en) => setLastKnown(en.knownWords)} onVote={onVote} />
      </section>

      <section style={{ ...S.card, gridColumn: "1 / -1" }}>
        <div style={S.row}>
          <button className="nl-btn" style={S.accent} onClick={() => setShowCorpus((v) => !v)}>
            {showCorpus ? "Hide what it has read" : "Show me everything it has ever read"}
          </button>
          <span style={S.hint}>{stats.words.toLocaleString()} words · {stats.vocab.toLocaleString()} different words. That is its whole mind.</span>
        </div>
        {showCorpus && (
          <div style={{ marginTop: 14 }}>
            {lastKnown.length > 0 && <p style={{ ...S.hint, margin: "0 0 8px" }}>Highlighted: the words from your last question it recognised.</p>}
            <Corpus text={HISTORY_TEXT} highlight={lastKnown} />
          </div>
        )}
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Write src/screens/Scoreboard.jsx**

```jsx
import { useMemo, useState } from "react";
import { S, C } from "../theme.js";
import { useVotes, useBots, useBotVotes } from "../rooms/hooks.js";
import { topicAccuracy, splitHistoryVsRest, recentVotes, botLeaderboard, MIN_VOTES_TO_SHOW, TOPICS, VERDICTS } from "../lm/scoring.js";
import { HISTORY_TEXT } from "../lm/texts/index.js";
import { pct } from "../ml/net.js";
import { Corpus } from "../components/Corpus.jsx";

const barColor = (p) => (p == null ? C.line : p > 0.6 ? C.leaf : p > 0.3 ? C.mangoDeep : C.red);
const verdictEmoji = (v) => VERDICTS.find((x) => x.id === v)?.emoji || "";
const topicEmoji = (t) => TOPICS.find((x) => x.id === t)?.emoji || "";

export function Scoreboard({ code, teams, meta }) {
  const { value: votes } = useVotes(code, true);
  const examOpen = meta?.phase === "exam";
  const { value: bots } = useBots(code, examOpen);
  const { value: botVotes } = useBotVotes(code, examOpen);
  const rows = useMemo(() => topicAccuracy(votes), [votes]);
  const split = useMemo(() => splitHistoryVsRest(votes), [votes]);
  const feed = useMemo(() => recentVotes(votes, 8), [votes]);
  const board = useMemo(() => botLeaderboard(botVotes, teams, bots), [botVotes, teams, bots]);
  const [showCorpus, setShowCorpus] = useState(false);

  return (
    <main style={S.wide} className="nl-fade">
      <h1 style={S.h1}>📊 Scoreboard</h1>
      {split.total < MIN_VOTES_TO_SHOW ? (
        <p style={S.empty}>Waiting for questions. {split.total} of {MIN_VOTES_TO_SHOW} answers voted on so far.</p>
      ) : (
        <>
          <p style={S.lede}>
            It answered {split.total} questions. It was right about <b>{pct(split.history.pct)} of history</b> and <b>{pct(split.rest.pct)} of everything else</b>.
          </p>
          <div style={S.table} role="table" aria-label="Accuracy by topic">
            {rows.map((r) => (
              <div key={r.topic} role="row" style={{ ...S.tr, gridTemplateColumns: "1.2fr .5fr .6fr 2fr" }}>
                <span style={{ fontWeight: 800 }}><span aria-hidden="true">{r.emoji}</span> {r.label}</span>
                <span style={{ color: C.muted, fontWeight: 700 }}>{r.n} asked</span>
                <span style={{ color: barColor(r.pct), fontWeight: 800 }}>{pct(r.pct)}</span>
                <span style={S.barCell}><span style={{ ...S.bar, width: `${(r.pct || 0) * 100}%`, background: barColor(r.pct) }} /></span>
              </div>
            ))}
          </div>

          <div style={S.qBox}>
            <div style={S.qKick}>Work this out before anyone tells you</div>
            <p style={S.q}>It answered every single question, in full sentences, without hesitating. Look at the bars.</p>
            <p style={S.qBig}>It never once said 'I don't know'. Why not?</p>
          </div>

          <div style={{ ...S.card, marginTop: 20 }}>
            <h2 style={S.h2}>Latest questions</h2>
            <div style={{ display: "grid", gap: 8 }}>
              {feed.map((f, i) => (
                <div key={i} style={S.feedItem}>
                  <div style={{ fontWeight: 800 }}><span aria-hidden="true">{topicEmoji(f.topic)}</span> {f.q}</div>
                  <div style={{ color: C.muted }}>{f.a}</div>
                  <div style={S.coverage}>{verdictEmoji(f.verdict)} {f.verdict} · recognised {f.known} of {f.total} words</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...S.card, marginTop: 20 }}>
            <button className="nl-btn" style={S.accent} onClick={() => setShowCorpus((v) => !v)}>
              {showCorpus ? "Hide what it has read" : "Show me everything it has ever read"}
            </button>
            {showCorpus && <div style={{ marginTop: 14 }}><Corpus text={HISTORY_TEXT} /></div>}
          </div>

          {examOpen && (
            <div style={{ marginTop: 28 }}>
              <h2 style={S.h2}>🎤 Cross-examination</h2>
              <p style={S.lede}>Every bot is now questioned by strangers. Which one survived?</p>
              {board.length === 0 ? <p style={S.empty}>No bots sent yet.</p> : (
                <div style={S.table} role="table" aria-label="Bot leaderboard">
                  <div style={{ ...S.tr, ...S.thead }} role="row"><span>Bot</span><span>Own team</span><span>Strangers</span><span /></div>
                  {board.map((b, i) => (
                    <div key={b.teamId} role="row" style={S.tr}>
                      <span style={{ fontWeight: 800, color: i === 0 && b.foreign.pct != null ? C.mangoDeep : C.ink }}>{i === 0 && b.foreign.pct != null ? "⭐ " : ""}{b.name}</span>
                      <span style={{ color: C.muted, fontWeight: 700 }}>{pct(b.own.pct)}</span>
                      <span style={{ color: barColor(b.foreign.pct), fontWeight: 800 }}>{b.foreign.pct == null ? `${b.foreign.n} asked` : pct(b.foreign.pct)}</span>
                      <span style={S.barCell}><span style={{ ...S.bar, width: `${(b.foreign.pct || 0) * 100}%`, background: i === 0 ? C.sun : C.sky }} /></span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 5: Run** `npx vitest run src/screens/Scoreboard.test.jsx` then `npm run build` — Expected: PASS, build OK (Chat compiles even though not yet wired).

- [ ] **Step 6: Commit**

```bash
git add src/screens/Chat.jsx src/screens/Scoreboard.jsx src/screens/Scoreboard.test.jsx
git commit -m "Add HistoryBot chat and scoreboard screens"
```

---

### Task 11: `TrainBot` and `Exam` screens

**Files:**
- Create: `src/screens/TrainBot.jsx`, `src/screens/Exam.jsx`, `src/screens/TrainBot.test.jsx`

**Interfaces:**
- Consumes: RoomProps; `STARTER_TEXTS`, `getText` (Task 3); `trainModel`, `modelStats` (Task 2); `BotChat` (Task 9); `sendBot`, `castBotVote`, `MAX_BOT_TEXT`, `MIN_BOT_WORDS` (Task 7); `useTeamBot`, `useBots`, `useBotVotes` (Task 7); `botLeaderboard` (Task 4); `tokenize`, `isWord` (Task 1).
- Produces: `TrainBot(RoomProps)`, `Exam(RoomProps)`.

- [ ] **Step 1: Write the failing TrainBot test**

`src/screens/TrainBot.test.jsx`:
```jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("../rooms/hooks.js", () => ({ useTeamBot: () => ({ value: null, loading: false }) }));
const api = { sendBot: vi.fn(() => Promise.resolve()) };
vi.mock("../rooms/api.js", () => ({ sendBot: (...a) => api.sendBot(...a), MAX_BOT_TEXT: 6000, MIN_BOT_WORDS: 150 }));

import { TrainBot } from "./TrainBot.jsx";

const base = { code: "ABCDE", uid: "u1", team: { id: "tA", name: "Aloo" }, isTeacher: false, flash: () => {} };

describe("TrainBot", () => {
  it("needs 150 words before Train enables; a starter text is enough", () => {
    render(<TrainBot {...base} />);
    const train = screen.getByRole("button", { name: /Train my bot/ });
    expect(train.disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Cricket/ }));
    expect(train.disabled).toBe(false);
    fireEvent.click(train);
    expect(screen.getByText(/different words/)).toBeTruthy();
    expect(screen.getByLabelText("Your question")).toBeTruthy();
  });
  it("counts own text and sends the combined text with sources", async () => {
    render(<TrainBot {...base} />);
    fireEvent.change(screen.getByLabelText("Your own text"), { target: { value: "word ".repeat(160) } });
    expect(screen.getByText(/160 words/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Train my bot/ }));
    fireEvent.click(screen.getByRole("button", { name: /Send my bot to the class/ }));
    await Promise.resolve();
    expect(api.sendBot).toHaveBeenCalledWith(expect.objectContaining({ code: "ABCDE", teamId: "tA", uid: "u1", sources: ["own"] }));
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/screens/TrainBot.test.jsx` — Expected: FAIL.

- [ ] **Step 3: Write src/screens/TrainBot.jsx**

```jsx
import { useMemo, useState } from "react";
import { S, C } from "../theme.js";
import { STARTER_TEXTS } from "../lm/texts/index.js";
import { trainModel, modelStats } from "../lm/ngram.js";
import { tokenize, isWord } from "../lm/tokenize.js";
import { sendBot, MAX_BOT_TEXT, MIN_BOT_WORDS } from "../rooms/api.js";
import { useTeamBot } from "../rooms/hooks.js";
import { BotChat } from "../components/BotChat.jsx";

const countWords = (t) => tokenize(t).filter(isWord).length;

export function TrainBot({ code, uid, team, isTeacher, flash }) {
  const [picked, setPicked] = useState([]);       // starter ids
  const [own, setOwn] = useState("");
  const [model, setModel] = useState(null);
  const [sending, setSending] = useState(false);
  const sent = useTeamBot(code, team?.id);

  const combined = useMemo(() => [...picked.map((id) => STARTER_TEXTS.find((t) => t.id === id)?.text || ""), own.trim()].filter(Boolean).join("\n\n"), [picked, own]);
  const words = useMemo(() => countWords(combined), [combined]);
  const ownWords = useMemo(() => countWords(own), [own]);
  const ready = words >= MIN_BOT_WORDS && combined.length <= MAX_BOT_TEXT * 2;

  const toggle = (id) => { setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])); setModel(null); };
  const train = () => setModel(trainModel(combined));
  const send = async () => {
    if (!model) return flash("Train it first.");
    if (!team) return flash(isTeacher ? "Teachers don't enter the cross-examination. Join a team to try it." : "Join a team in the Lobby first.");
    if (combined.length > MAX_BOT_TEXT) return flash(`Too long to send: keep it under ${MAX_BOT_TEXT.toLocaleString()} characters.`);
    setSending(true);
    try {
      await sendBot({ code, teamId: team.id, uid, text: combined, sources: [...picked, ...(own.trim() ? ["own"] : [])] });
      flash("Bot sent to the class! 🤖");
    } catch { flash("Could not reach the class board."); }
    finally { setSending(false); }
  };

  return (
    <main style={S.main}>
      <section style={S.card} className="nl-fade">
        <h2 style={S.h2}>🧪 Feed your bot</h2>
        <p style={S.hint}>Pick what your bot reads. Everything you tick is the whole of what it will ever know.</p>
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {STARTER_TEXTS.map((t) => (
            <button key={t.id} type="button" className="nl-btn" style={{ ...S.textCard, ...(picked.includes(t.id) ? S.textCardOn : null) }} onClick={() => toggle(t.id)}>
              <span style={{ fontSize: 22, marginRight: 8 }} aria-hidden="true">{t.emoji}</span>
              <b>{t.title}</b> <span style={{ color: C.muted, fontWeight: 700 }}>· {t.words} words</span>
            </button>
          ))}
        </div>
        <div style={S.field}>
          <label style={S.label} htmlFor="own-text">Your own text (optional)</label>
          <textarea id="own-text" className="nl-in" style={{ ...S.input, minHeight: 110, resize: "vertical", fontSize: 14 }} value={own}
            maxLength={MAX_BOT_TEXT} placeholder="Paste anything: a page of notes, a story, a match report…" onChange={(e) => { setOwn(e.target.value); setModel(null); }}
            aria-label="Your own text" />
          <div style={S.counter}>{ownWords} words · {own.length.toLocaleString()} / {MAX_BOT_TEXT.toLocaleString()} characters</div>
        </div>
        <button className="nl-btn" style={{ ...S.train, marginTop: 12 }} disabled={!ready} onClick={train}>
          Train my bot ({words.toLocaleString()} words)
        </button>
        {!ready && <p style={S.hint}>At least {MIN_BOT_WORDS} words before it can learn anything.</p>}
      </section>

      <section style={S.card} className="nl-fade">
        <h2 style={S.h2}>Try it</h2>
        {model ? (
          <>
            <p style={S.hint}>{modelStats(model).words.toLocaleString()} words read · {modelStats(model).vocab.toLocaleString()} different words. Ask it about its topic, then about something else.</p>
            <BotChat model={model} botName={team ? `${team.name}'s bot` : "Your bot"} requireTopic={false} requireVote={false} placeholder="Test your bot…" />
            <button className="nl-btn" style={S.send} disabled={sending} onClick={send}>{sending ? "Sending…" : "Send my bot to the class 🤖"}</button>
          </>
        ) : (
          <p style={S.empty}>Train it first. Then ask it a few questions here before you send it.</p>
        )}
        {team && sent.value && (
          <p style={{ ...S.hint, color: C.leaf, fontWeight: 800 }}>✓ {team.name}'s bot is in ({(sent.value.sources || []).join(", ") || "own text"}). Sending again replaces it.</p>
        )}
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Write src/screens/Exam.jsx**

```jsx
import { useMemo, useState } from "react";
import { S, C } from "../theme.js";
import { useBots, useBotVotes } from "../rooms/hooks.js";
import { trainModel } from "../lm/ngram.js";
import { botLeaderboard } from "../lm/scoring.js";
import { castBotVote } from "../rooms/api.js";
import { pct } from "../ml/net.js";
import { BotChat } from "../components/BotChat.jsx";

export function Exam({ code, uid, teams, team, isTeacher, flash }) {
  const { value: bots } = useBots(code, true);
  const { value: botVotes } = useBotVotes(code, true);
  const ids = Object.keys(bots || {});
  const [pickedId, setPickedId] = useState(null);
  const botId = pickedId && bots?.[pickedId] ? pickedId : ids[0] || null;
  const model = useMemo(() => (botId && bots?.[botId]?.text ? trainModel(bots[botId].text) : null), [botId, bots]);
  const board = useMemo(() => botLeaderboard(botVotes, teams, bots), [botVotes, teams, bots]);
  const name = (id) => teams?.[id]?.name || "Unknown team";

  const onVote = async (entry, verdict) => {
    if (isTeacher) return;
    try { await castBotVote({ code, uid, askerTeamId: team?.id || null, botTeamId: botId, topic: entry.topic, verdict, q: entry.q }); }
    catch { flash("Could not reach the class board."); }
  };

  return (
    <main style={S.main}>
      <section style={{ ...S.card, gridColumn: "1 / -1" }} className="nl-fade">
        <h2 style={S.h2}>🎤 Cross-examination</h2>
        <p style={S.lede}>Every bot is now questioned by strangers. Which one survived?</p>
        {ids.length === 0 ? <p style={S.empty}>No bots yet. Teams send theirs from Train your bot.</p> : (
          <>
            <div style={S.pickRow}>
              {ids.map((id) => (
                <button key={id} type="button" className="nl-btn" style={{ ...S.topicChip, ...(id === botId ? S.topicChipOn : null) }} onClick={() => setPickedId(id)}>
                  🤖 {name(id)}{team?.id === id ? " (yours)" : ""}
                </button>
              ))}
            </div>
            {model && (
              <>
                <p style={S.hint}>Asking <b>{name(botId)}'s bot</b>{(bots[botId].sources || []).length ? ` · fed on: ${bots[botId].sources.join(", ")}` : ""}. Pick the topic, ask, vote. {team?.id === botId ? "Votes on your own bot don't count for strangers." : ""}</p>
                <BotChat key={botId} model={model} botName={`${name(botId)}'s bot`} onVote={onVote} />
              </>
            )}
          </>
        )}
      </section>

      <section style={{ ...S.card, gridColumn: "1 / -1" }}>
        <h2 style={S.h2}>Leaderboard</h2>
        {board.length === 0 ? <p style={S.empty}>Nothing to score yet.</p> : (
          <div style={S.table} role="table" aria-label="Bot leaderboard">
            <div style={{ ...S.tr, ...S.thead }} role="row"><span>Bot</span><span>Own team</span><span>Strangers</span><span /></div>
            {board.map((b, i) => (
              <div key={b.teamId} role="row" style={{ ...S.tr, ...(b.teamId === team?.id ? { outline: `3px solid ${C.sky}` } : null) }}>
                <span style={{ fontWeight: 800 }}>{i === 0 && b.foreign.pct != null ? "⭐ " : ""}{b.name}</span>
                <span style={{ color: C.muted, fontWeight: 700 }}>{pct(b.own.pct)}</span>
                <span style={{ fontWeight: 800, color: b.foreign.pct == null ? C.muted : b.foreign.pct > 0.6 ? C.leaf : b.foreign.pct > 0.3 ? C.mangoDeep : C.red }}>
                  {b.foreign.pct == null ? `${b.foreign.n} asked` : pct(b.foreign.pct)}
                </span>
                <span style={S.barCell}><span style={{ ...S.bar, width: `${(b.foreign.pct || 0) * 100}%`, background: i === 0 ? C.sun : C.sky }} /></span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Run** `npx vitest run src/screens/TrainBot.test.jsx` then `npm run build` — Expected: PASS, build OK.

- [ ] **Step 6: Commit**

```bash
git add src/screens/TrainBot.jsx src/screens/Exam.jsx src/screens/TrainBot.test.jsx
git commit -m "Add train-your-bot and cross-examination screens"
```

---

### Task 12: Wire activity 2 into `Room`, `Lobby`, `Settings`

**Files:**
- Modify: `src/screens/Room.jsx`, `src/screens/Lobby.jsx`, `src/screens/Settings.jsx`, `src/screens/Settings.test.jsx`, `src/components/TeamCard.jsx`

**Interfaces:**
- RoomProps gains `activity` (1 | 2). `Room` chooses tabs with `visibleTabs(role, phase, activity)`, renders `Chat`, `Scoreboard`, `TrainBot`, `Exam` for their tab keys, passes `activity` to `PhaseBar` and hides Next round for activity 2, header tag shows the activity title for activity 2.
- `Lobby`: `locked` = own team's model exists (activity 1) or own team's bot exists (activity 2).
- `Settings`: hides the label pair for activity 2; `resetBoard({ code, activity })`; activity-2 run sheet and notes.
- `TeamCard`: locked badge reads "sent ✓".

- [ ] **Step 1: Extend Settings test**

Append to `src/screens/Settings.test.jsx` (extend the mock's `resetBoard` capture: `resetBoard: (...a) => api.resetBoard(...a)` is already there):
```jsx
describe("Settings for activity 2", () => {
  it("hides the drawing pair and resets with the activity", () => {
    render(<Settings {...base} activity={2} meta={{ labels: ["Mango", "Cricket ball"], teamCap: 4, activity: 2 }} />);
    expect(screen.queryByLabelText("First thing")).toBeNull();
    expect(screen.getByLabelText("Team cap")).toBeTruthy();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: /Reset board/ }));
    expect(api.resetBoard).toHaveBeenCalledWith({ code: "ABCDE", activity: 2 });
    window.confirm.mockRestore();
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/screens/Settings.test.jsx` — Expected: FAIL (label pair still rendered; reset called without activity).

- [ ] **Step 3: Edit src/screens/Room.jsx**

- Imports: add `import { Chat } from "./Chat.jsx"; import { Scoreboard } from "./Scoreboard.jsx"; import { TrainBot } from "./TrainBot.jsx"; import { Exam } from "./Exam.jsx";` and `ACTIVITIES` from `../rooms/phases.js`.
- After `const round = meta.round || 1;` add `const activity = meta.activity === 2 ? 2 : 1;`.
- `const tabs = visibleTabs(role, meta.phase, activity);`
- `const props = { code, uid, meta, members, teams, labels, team, isTeacher, flash, round, activity };`
- PhaseBar: `<PhaseBar phase={meta.phase} round={round} activity={activity} onAdvance={advance} onNextRound={startNextRound} busy={busy} />`
- Header tag: `Room <b>{code}</b> · {activity === 2 ? ACTIVITIES[2].title : `${labels[0]} vs ${labels[1]}`}`
- Strip: show `{round > 1 && activity === 1 && <span style={S.badge}>Round {round}</span>}` and add `{activity === 2 && <span style={S.badge}>Activity 2</span>}`.
- Tab rendering: add
```jsx
      {active === "chat" && <Chat {...props} />}
      {active === "scoreboard" && <Scoreboard {...props} />}
      {active === "trainbot" && <TrainBot {...props} />}
      {active === "exam" && <Exam {...props} />}
```

- [ ] **Step 4: Edit src/screens/Lobby.jsx**

- Import `useTeamBot` alongside `useTeamModel`.
- Signature adds `activity = 1`.
- Replace the lock lines with:
```js
  const myModel = useTeamModel(code, activity === 1 ? team?.id : null);
  const myBot = useTeamBot(code, activity === 2 ? team?.id : null);
  const locked = Boolean(myModel.value) || Boolean(myBot.value);
```
- The locked hint text: `"Your team has sent its machine, so you're locked in."` → `` `Your team has sent its ${activity === 2 ? "bot" : "machine"}, so you're locked in.` ``

- [ ] **Step 5: Edit src/components/TeamCard.jsx** — badge text `model sent ✓` → `sent ✓`. Update `TeamCard.test.jsx`'s locked assertion if it matched "model sent" (it matches `/sent/i`; leave).

- [ ] **Step 6: Edit src/screens/Settings.jsx**

- Signature: `export function Settings({ code, meta, flash, activity = 1 })`; `const isTalk = activity === 2;`
- Wrap the "What the class draws" heading, row and paragraph in `{!isTalk && (<> … </>)}` (keep team size and max teams sections for both).
- Reset button: `run(() => resetBoard({ code, activity }), "Class board cleared.")`. Danger-zone copy: for activity 2 say "Reset wipes every vote and every sent bot and puts the room back to chatting. Teams and members stay."
- Run sheet: define `RUN_SHEET_2 = [["0:00","Teams of four. Room code in."],["0:03","Ask HistoryBot anything. Tag the topic, vote."],["0:12","Reveal scoreboard. Let them read the bars."],["0:15","Show me everything it has ever read."],["0:18","Start training. Pick texts, paste your own, train, test, send."],["0:28","Open cross-examination. Ask strangers' bots."],["0:36","Leaderboard. The question: whose text was it?"],["0:40","Out."]]` and render `isTalk ? RUN_SHEET_2 : RUN_SHEET`.
- "The one rule" paragraph for activity 2: "Say nothing about next-word prediction or hallucination until the scoreboard is up. The bars do the teaching." Keep the activity 1 text otherwise.

- [ ] **Step 7: Run** `npm test && npm run build` — Expected: all PASS, build OK. Also start `npm run dev`, open `http://localhost:5173/neural-lab/`, confirm the activity chooser renders, then stop it.

- [ ] **Step 8: Commit**

```bash
git add src/screens/Room.jsx src/screens/Lobby.jsx src/screens/Settings.jsx src/screens/Settings.test.jsx src/components/TeamCard.jsx
git commit -m "Wire activity 2 screens, locks and settings into the room"
```

---

### Task 13: Simulator `--activity 2` and README

**Files:**
- Modify: `scripts/simulate.mjs`, `README.md`

**Interfaces:**
- `npm run simulate -- --activity 2 [--students N] [--max-teams M] [--hold S] [--keep]` runs: create room (activity 2) → students join/teams → `chat`: every student asks 3 questions drawn from a topic-tagged bank, gets a HistoryBot answer via `generate`, and votes with a heuristic (history: right if `known/total ≥ 0.5` else wrong; other topics: 10% right, else 60% wrong / 30% nonsense) → prints the topic table → `reveal` → `train`: each team trains from one starter text (round-robin: biology, cricket, cooking, space, folktales, history) and sends `bots/{teamId}` → `exam`: every student asks 2 questions of other teams' bots from the bank; heuristic vote: right (70%) when the question topic matches the bot's text topic (`history→history`, `science→biology`, `sport→cricket`, `everyday→cooking`, `other→space/folktales`), else wrong/nonsense → prints the leaderboard via `botLeaderboard` → rule checks (student writes `meta/phase`, student writes another team's bot, student edits an existing vote) → cleanup adds `votes`, `bots`, `botVotes`.
- Activity 1 path unchanged (`--activity 1` default).

- [ ] **Step 1: Implement** — add the imports (`trainModel, coverage, generate` from `../src/lm/ngram.js`; `HISTORY_TEXT, STARTER_TEXTS` from `../src/lm/texts/index.js`; `topicAccuracy, splitHistoryVsRest, botLeaderboard, TOPIC_IDS` from `../src/lm/scoring.js`; `buildVote, buildBotVote` from `../src/rooms/api.js`), an `ACTIVITY = Number(arg("activity", 1))` flag, the question bank:
```js
const BANK = {
  history: ["Who was Akbar?", "Why was the Taj Mahal built?", "What happened in 1857?", "Who founded the Mughal empire?", "What was the Lahore Resolution?"],
  science: ["What is a cell made of?", "How does the heart pump blood?", "What is DNA?", "Why do plants need sunlight?"],
  sport: ["How many players are in a cricket team?", "What is an over?", "Who won the 1992 World Cup?"],
  maths: ["What is 12 times 12?", "What is a prime number?", "How do you find the area of a circle?"],
  everyday: ["How do you make chai?", "What time does school start?", "How do I fix a flat tyre?"],
  other: ["What is the biggest planet?", "Tell me a story about a crow.", "Why is the sky blue?"],
};
```
and branch after team formation: `if (ACTIVITY === 2) { …activity 2 flow… } else { …existing flow… }`. Keep the existing activity-1 code intact inside the else branch (or an early `return` structure). Print the same kind of PROJECTOR summary:
```
PROJECTOR: It answered 30 questions. Right about 78% of history and 7% of everything else.
   🏛️ History   10 asked   80%
   🧬 Science    6 asked    0%  …
LEADERBOARD (strangers): ⭐ Bhindi Masala (cricket) 71% · Aloo Gosht (biology) 33% · …
```

- [ ] **Step 2: README** — add an "Activity 2 · Talk to the machine" section under "Running a lesson": choose the activity on the first screen; phases and what each shows; the two verbatim lines students will see; `npm run simulate -- --activity 2` for a dry run; note that the live rules must be republished after this release.

- [ ] **Step 3: Verify** — `node --check scripts/simulate.mjs`; run `npx firebase emulators:exec --only database --project demo-neural-lab "node scripts/simulate.mjs --activity 2 --students 10 --max-teams 4"` (emulator-backed: rule checks are skipped there by design) — Expected: completes, prints topic table with history clearly above the rest, leaderboard, cleanup "gone: yes".

- [ ] **Step 4: Commit**

```bash
git add scripts/simulate.mjs README.md
git commit -m "Simulate activity 2 lessons; document the activity in the README"
```

---

### Task 14: Verification, deploy, live test

- [ ] **Step 1:** `npm test` (expect ≈ 92 + ~45 new), `npm run test:rules` (expect 42), `npm run build`.
- [ ] **Step 2:** Push `main`; watch the Pages deploy to success.
- [ ] **Step 3:** The user republishes `database.rules.json` in the Firebase console (new nodes `votes`, `bots`, `botVotes`, `meta.activity`, new phases are rejected until then).
- [ ] **Step 4:** `node scripts/simulate.mjs --activity 2 --students 10 --max-teams 4` against live: rule checks all blocked, topic table, leaderboard, cleanup complete. Run once more with `--hold 600` and open the room as a student to check Chat, Scoreboard, Train your bot, Cross-examine on a phone-width window.
- [ ] **Step 5:** Manual acceptance (teacher + one phone): choose Activity 2 → create room → student joins → Start chatting → ask a history and a science question, vote → Reveal scoreboard → Show me everything it has ever read → Start training → student picks Cricket + pastes text → Train → test → Send → Open cross-examination → student asks the other bot, votes → leaderboard updates → Settings: Reset board returns to chat with empty votes. Activity 1 regression: create an Activity 1 room and confirm Teach/Tournament/Fence unchanged.
