# Activity 2 Lesson Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Activity 2 ("Talk to the machine") land its lesson reliably and be more fun, by acting on the 2026-09-17 teacher-designer review: fix the stopword seeding that wrecks a third of answers, make every question consciously topic-tagged, turn the projector Scoreboard into a real reveal with teacher control, and tighten Part 2 (cross-examination) so every bot shows "HistoryBot's shape".

**Architecture:** No data-model or rules change (all new signals derive from the existing `votes`/`botVotes` records, so no rules republish). Model-side: a content-word-preferring seeder in `src/lm/ngram.js` and a few more stopwords; the history text is edited so answers follow the words students type, and a new accuracy test locks the punchline. UI-side: `BotChat` (topic reset, speaking coverage line, appended "Ask again" bubbles, typing pause), `Scoreboard` (phase-gated reveal, projector-sized corpus with highlights, nonsense-of-the-day, teacher tap-to-hide + denylist, per-bot topic strips), `Exam`/`TrainBot`/`Lobby`/`Settings` copy and defaults. Pure helpers go in `src/lm/scoring.js` and a new `src/lm/projectorFilter.js`.

**Tech Stack:** React 19 (plain JS), Vite 8, Vitest 5 (jsdom, `globals: true`, @testing-library/react). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-17-activity-2-talk-to-the-machine-design.md` (binding; Task 4 amends §5, §6, §8 to match this plan). Review that motivates every change: the 2026-09-17 fable lesson-quality review (summarised in the task rationales below).

## Global Constraints

- Plain JavaScript, React function components; no new dependencies; reuse `S`/`C` from `src/theme.js` (inline overrides allowed; no new `S` keys required).
- Activity 1 behaviour, tabs, copy and tests unchanged. `BotChat` is shared by Chat, TrainBot (try-it) and Exam — every change must work with `requireTopic={false}` / `requireVote={false}`.
- Data model and `database.rules.json` unchanged. No Firebase write gains a field.
- Verbatim copy that must remain exactly: "HistoryBot has read one thing in its life: 2,000 words about South Asian history. Ask it anything." · "Recognised {known} of {total} words in your question." (when `known > 0`) · "It never once said 'I don't know'. Why not?" · "Show me everything it has ever read" · "Every bot is now questioned by strangers. Which one survived?".
- New verbatim copy (this plan): coverage when `known === 0 && total > 0`: "It recognised none of your words. It answered anyway." · headline: "{N} answers were judged. It was right about {X} of history and {Y} of everything else." · mission card: "Your mission: find one answer it gets right, one it gets wrong, and one that is pure nonsense. Then try to trick it." · nonsense panel kicker: "Nonsense of the day".
- History text: 1,800–2,300 words (tokenizer count), none of `cell cells made dna carry information blood body heart` as whole words, simple English, ≤ 20 words per sentence, every sentence ends `.`/`?`/`!`, textbook-accurate.
- Tests: `npx vitest run` must stay pristine (no act() warnings, no key warnings). `npm run test:rules` is unaffected (no rules change) but must still pass at the end. Commit per task; end commit bodies with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## File map

```
src/lm/tokenize.js            STOPWORDS += many much make made does get
src/lm/ngram.js               generate(): content-word-preferring seeder (step 1 rewritten)
src/lm/ngram.test.js          seeder tests; coverage fixture updated for "made"
src/lm/texts/history.js       subject-first sentences, FAQ sentences, Din-i Ilahi softened
src/lm/texts/texts.test.js    + "HistoryBot accuracy" test (≥ 10 of 20 fixed questions)
src/lm/scoring.js             recentVotes rows carry id; + botTopicTallies, nonsenseOfTheDay
src/lm/scoring.test.js        tests for the above
src/lm/projectorFilter.js     isProjectorSafe(q) denylist (new)
src/lm/projectorFilter.test.js
src/components/BotChat.jsx    topic reset, coverage copy/colour, Ask again appends (max 2), typing pause, avatar
src/components/BotChat.test.jsx
src/components/Corpus.jsx     compact (projector) mode
src/components/Corpus.test.jsx
src/screens/Chat.jsx          mission card
src/screens/Scoreboard.jsx    phase-gated reveal, feed during chat, hide/denylist, nonsense panel, projector corpus + highlights, topic strips
src/screens/Scoreboard.test.jsx
src/screens/Exam.jsx          default = random other team's bot; sources hint copy
src/screens/Exam.test.jsx     (new)
src/screens/TrainBot.jsx      confirm before replacing a sent bot; who sent it; own-text tip
src/screens/TrainBot.test.jsx
src/screens/Lobby.jsx         teacher hint uses phaseAction("lobby", activity)
src/screens/Lobby.test.jsx
src/screens/Settings.jsx      run sheet 0:36 line; activity-2 notes: religion line, projector tab per phase, teacher script
src/screens/Settings.test.jsx
src/screens/Room.jsx          passes `members` to TrainBot (already in props object — verify)
docs/superpowers/specs/...    §5, §6, §8 amended
README.md                     Lesson 2 run: pointer to the teacher script in Settings
```

---

### Task 1: Seeder, stopwords, history text and the accuracy test

**Rationale (review Q1):** the seeder takes the first adjacent bigram the model knows, which for "What is …" / "How many …" is a stopword pair ("what is" → "What is now Pakistan."). Roughly a third of all questions open identically and genuine history questions are destroyed ("What is the Lahore Resolution?" → "What is now Afghanistan. …"). Preferring content-word pairs fixes both; editing the text so trigger words precede the answer ("Pakistan became independent on 14 August 1947.") lets the trigram reach the fact.

**Files:**
- Modify: `src/lm/tokenize.js` (STOPWORDS), `src/lm/ngram.js` (`generate` step 1), `src/lm/ngram.test.js`, `src/lm/texts/history.js`, `src/lm/texts/texts.test.js`

**Interfaces:**
- Produces: unchanged signatures. `generate(model, q, { seed })` still returns `{ text, seededFrom, words }`; `seededFrom === "question"` whenever any known content word or known bigram exists in the question.

- [ ] **Step 1: Extend STOPWORDS**

In `src/lm/tokenize.js`, append to the STOPWORDS string (before `.split(" ")`):
```js
  " many much make made does get got"
```
so the final constant reads `... before after above below off yes please tell explain many much make made does get got").split(" "));`

- [ ] **Step 2: Update the coverage fixture that depended on "made"**

In `src/lm/ngram.test.js`, the test "reports unknown words for off-topic questions" becomes:
```js
  it("reports unknown words for off-topic questions", () => {
    const c = coverage(m, "What is a cell made of?");
    expect(c.total).toBe(1);            // cell ("made" is now a stopword)
    expect(c.known).toBe(0);
    expect(c.unknownWords).toEqual(["cell"]);
  });
```

- [ ] **Step 3: Write the failing seeder tests**

Append to the `describe("generate", …)` block in `src/lm/ngram.test.js`:
```js
  it("prefers a pair with content words over a stopword pair", () => {
    // "the mughal" and "mughal empire" are both known bigrams; "the mughal" is stopword+content, "mughal empire" is content+content.
    const { text } = generate(m, "Tell me about the Mughal empire", { seed: 0 });
    expect(text.toLowerCase().startsWith("mughal empire")).toBe(true);
  });
  it("never seeds from a pair of two stopwords", () => {
    const m2 = trainModel("What is the capital? The capital is Agra. What is the river? The river is the Indus.");
    const { text, seededFrom } = generate(m2, "What is the capital of the empire", { seed: 0 });
    expect(seededFrom).toBe("question");
    expect(text.toLowerCase().startsWith("what is")).toBe(false);
    expect(text.toLowerCase().startsWith("the capital")).toBe(true);   // "the capital" (score 1) beats "what is" (score 0); no content+content pair exists here
  });
  it("falls back to a stopword+content pair before a lone word", () => {
    const { text, seededFrom } = generate(m, "Tell me about the coast", { seed: 0 });
    expect(seededFrom).toBe("question");
    expect(text.toLowerCase().startsWith("the coast")).toBe(true);
  });
```

- [ ] **Step 4: Run to see them fail**

Run: `npx vitest run src/lm/ngram.test.js` — Expected: the three new tests FAIL (current code seeds "the mughal" and "what is").

- [ ] **Step 5: Rewrite seeding step 1 in `generate`**

Replace the block under `// 1. An adjacent pair …` in `src/lm/ngram.js` with:
```js
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
```
and change the import line to `import { tokenize, contentWords, detokenize, hashString, isWord, isEnd, STOPWORDS } from "./tokenize.js";`. Steps 2 and 3 of the seeder stay as they are.

- [ ] **Step 6: Run the model tests**

Run: `npx vitest run src/lm/ngram.test.js` — Expected: all PASS.

- [ ] **Step 7: Write the failing accuracy test**

Append to `src/lm/texts/texts.test.js`:
```js
describe("HistoryBot accuracy (the punchline must survive text edits)", () => {
  const model = trainModel(HISTORY_TEXT);
  const QA = [
    ["Who built the Taj Mahal?", /shah jahan|taj mahal|mumtaz/],
    ["When did Pakistan become independent?", /1947|independent/],
    ["Who founded the Muslim League?", /muslim league|1906|dhaka/],
    ["What happened at the battle of Panipat?", /babur|panipat|lodi|1526/],
    ["Who was Akbar?", /akbar|mughal|fatehpur/],
    ["What was the Lahore Resolution?", /lahore resolution|1940|resolution/],
    ["Who is Muhammad Ali Jinnah?", /jinnah|quaid|muslim league|governor/],
    ["Tell me about the Indus Valley", /indus|mohenjo|harappa|cities|drains/],
    ["Who was Ashoka?", /ashoka|maurya|kalinga|buddhism|pillars|edicts/],
    ["What is Taxila famous for?", /taxila|learning|students|gandhara/],
    ["Who was Muhammad bin Qasim?", /qasim|sindh|dahir|712|arab/],
    ["What did Sir Syed Ahmad Khan do?", /aligarh|syed|college|education|1875/],
    ["What happened in 1857?", /1857|uprising|company|rose up|british/],
    ["Who was Ranjit Singh?", /ranjit|sikh|punjab|lahore|maharaja/],
    ["What was the first capital of Pakistan?", /karachi|capital/],
    ["Who built Fatehpur Sikri?", /akbar|fatehpur|sikri/],
    ["Who was Babur?", /babur|timur|panipat|mughal|central asia/],
    ["When was the battle of Plassey?", /plassey|1757|bengal|company/],
    ["What did Allama Iqbal say in 1930?", /iqbal|1930|allahabad|homeland/],
    ["Who was Aurangzeb?", /aurangzeb|1707|1658|deccan|mughal/],
  ];
  it("answers at least 10 of 20 plain history questions on topic (seed 0)", () => {
    const hits = QA.filter(([q, re]) => re.test(generate(model, q, { seed: 0 }).text.toLowerCase()));
    expect(hits.length, `on-topic: ${hits.map(([q]) => q).join(" | ")}`).toBeGreaterThanOrEqual(10);
  });
  it("never opens two different questions with the same stopword phrase", () => {
    const opens = QA.map(([q]) => generate(model, q, { seed: 0 }).text.toLowerCase().split(" ").slice(0, 2).join(" "));
    expect(opens.filter((o) => o === "what is").length).toBe(0);
  });
});
```

- [ ] **Step 8: Run it; note the count**

Run: `npx vitest run src/lm/texts/texts.test.js` — Expected: the accuracy test may already pass at ≥ 10 after Step 5; record the count from the failure/success message. Target after Step 9 is ≥ 12.

- [ ] **Step 9: Edit the history text so answers follow the trigger words**

Rules for every edit in `src/lm/texts/history.js` (the trigram generates FORWARD from the question's words, so the fact must come AFTER them in the sentence):
- Proper noun first, then the fact: "Shah Jahan built the Taj Mahal in Agra for his wife Mumtaz Mahal." not "He is best remembered for the Taj Mahal".
- Make these specific rewrites/additions (keep every other sentence as is unless it violates the rules):
  - Replace "On 14 August 1947 Pakistan became an independent country at last." with "Pakistan became an independent country on 14 August 1947."
  - Add after it: "Pakistan celebrates its independence day every year on 14 August."
  - Replace "He is best remembered for the Taj Mahal, built in Agra." with "Shah Jahan is best remembered for the Taj Mahal in Agra."
  - Add to the Akbar paragraph: "Akbar built Fatehpur Sikri near Agra as his new capital."
  - Replace "Din-i Ilahi tried to blend the best parts of many faiths together." with "Din-i Ilahi mixed ideas from several faiths."
  - Add to the Karachi paragraph: "The capital of Pakistan today is Islamabad."
  - Add to the Muslim League paragraph: "The Muslim League was founded in Dhaka in 1906 to speak for Muslims."
  - Add to the Lahore Resolution paragraph: "The Lahore Resolution was passed on 23 March 1940 in Lahore."
  - Add to the Jinnah paragraph: "Jinnah is called the Quaid-e-Azam, the great leader of Pakistan."
  - Add to the Indus paragraph: "The Indus Valley civilisation is the oldest known civilisation of South Asia."
  - Add to the 1857 paragraph: "The uprising of 1857 is also called the first war of independence."
- Do NOT add cricket or any non-history fact (Sport must stay at 0%). Keep 1,800–2,300 words; grep for the forbidden words (`grep -n -i -w -E "cell|cells|made|dna|carry|information|blood|body|heart" src/lm/texts/history.js` must return nothing); every sentence ≤ 20 words.

- [ ] **Step 10: Run the texts tests and the whole lm folder**

Run: `npx vitest run src/lm` — Expected: all PASS, accuracy ≥ 10 (aim ≥ 12; iterate on Step 9 wording if below 10 — report the final count).

- [ ] **Step 11: Eyeball 12 answers and paste them in the report**

Run from the repo root:
```bash
node -e "import('./src/lm/ngram.js').then(async m=>{const t=await import('./src/lm/texts/index.js');const model=m.trainModel(t.HISTORY_TEXT);for(const q of ['Who built the Taj Mahal?','When did Pakistan become independent?','What is the Lahore Resolution?','Tell me about the Indus Valley','What is a cell?','How do I make biryani?','What is 7 times 8?','Why is the sky blue?','who is imran khan','do you love me','how do i pass my exam','what is your name']){const r=m.generate(model,q,{seed:0});const c=m.coverage(model,q);console.log(q,'->',r.text,'|',c.known+'/'+c.total);}})"
```
Paste the output in the report. Off-topic answers must be varied (no repeated opener) and history answers mostly on topic.

- [ ] **Step 12: Full suite, commit**

Run: `npx vitest run` — Expected: all PASS (153 + 5 new = 158).
```bash
git add src/lm/tokenize.js src/lm/ngram.js src/lm/ngram.test.js src/lm/texts/history.js src/lm/texts/texts.test.js
git commit -m "Seed answers from content words and edit the history text so facts follow the question words"
```

---

### Task 2: BotChat and Chat — conscious tagging, a coverage line that speaks, screenshots that survive

**Rationale (review Q1, Q5, must-fix 1):** the topic chip persists between questions, so a student who tags History once then asks "what is pizza" pollutes the History bar — the number the whole reveal rests on. The coverage line is the "why" tell but "Recognised 0 of 0 words" is a bug and "0 of 3" is flat. "Ask again" deletes the funny answer students wanted to screenshot and lets one question farm votes. A short typing pause makes the confident nonsense land harder.

**Files:**
- Modify: `src/components/BotChat.jsx`, `src/components/BotChat.test.jsx`, `src/screens/Chat.jsx`

**Interfaces:**
- Produces: `BotChat` gains props `typingMs = 600` (0 disables the pause), `maxAttempts = 2` (extra "Ask again" tries per question). Entries are append-only; an "Ask again" creates a NEW entry `{ …, q: same, attempt: n }` with a new id. `onAsk(entry)` and `onVote(entry, verdict)` unchanged in shape. Coverage line rules: `total === 0` → no line; `known === 0` → "It recognised none of your words. It answered anyway."; else "Recognised {known} of {total} words in your question." Colour: ratio ≥ 0.6 `C.leaf`, ≥ 0.3 `C.mangoDeep`, else `C.red`.

- [ ] **Step 1: Update and extend the BotChat tests**

Replace `src/components/BotChat.test.jsx` with:
```jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { BotChat } from "./BotChat.jsx";
import { trainModel } from "../lm/ngram.js";

const model = trainModel("Akbar ruled the Mughal empire from Agra. Akbar built a new city. The Mughal empire grew under Akbar. Babur founded the Mughal empire. Shah Jahan built the Taj Mahal at Agra.");
const ask = (text) => {
  fireEvent.change(screen.getByLabelText("Your question"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));
};

describe("BotChat", () => {
  it("requires a topic, then answers with a coverage line", () => {
    const onAsk = vi.fn();
    render(<BotChat model={model} onAsk={onAsk} typingMs={0} />);
    ask("Who built the Taj Mahal?");
    expect(screen.getByText(/Pick a topic/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /History/ }));
    ask("Who built the Taj Mahal?");
    expect(onAsk).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Recognised 3 of 3 words in your question.")).toBeTruthy();
    expect(screen.getByText("Who built the Taj Mahal?")).toBeTruthy();
  });
  it("forgets the topic after every question so each one is tagged on purpose", () => {
    render(<BotChat model={model} requireVote={false} typingMs={0} />);
    fireEvent.click(screen.getByRole("button", { name: /History/ }));
    ask("Who was Akbar?");
    ask("What is pizza?");
    expect(screen.getByText(/Pick a topic/)).toBeTruthy();
    expect(screen.queryByText("What is pizza?")).toBeNull();
  });
  it("says so when it recognised none of the words, and hides the line when there are no content words", () => {
    render(<BotChat model={model} requireVote={false} requireTopic={false} typingMs={0} />);
    ask("What is a cell?");
    expect(screen.getByText("It recognised none of your words. It answered anyway.")).toBeTruthy();
    ask("what is 2+2");
    expect(screen.queryByText(/of 0 words/)).toBeNull();
  });
  it("blocks the next question until the last answer is voted on, then records the vote", () => {
    const onVote = vi.fn();
    render(<BotChat model={model} onVote={onVote} typingMs={0} />);
    fireEvent.click(screen.getByRole("button", { name: /Science/ }));
    ask("What is a cell?");
    fireEvent.click(screen.getByRole("button", { name: /Science/ }));
    ask("Another?");
    expect(screen.getByText(/Vote on the last answer first/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Nonsense/ }));
    expect(onVote).toHaveBeenCalledWith(expect.objectContaining({ q: "What is a cell?", topic: "science", verdict: "nonsense" }), "nonsense");
  });
  it("only counts the first vote on an answer; the verdict row is then decided", () => {
    const onVote = vi.fn();
    render(<BotChat model={model} onVote={onVote} typingMs={0} />);
    fireEvent.click(screen.getByRole("button", { name: /Science/ }));
    ask("What is a cell?");
    fireEvent.click(screen.getByRole("button", { name: /Right/ }));
    fireEvent.click(screen.getByRole("button", { name: /Wrong/ }));
    expect(onVote).toHaveBeenCalledTimes(1);
    expect(onVote).toHaveBeenCalledWith(expect.objectContaining({ verdict: "right" }), "right");
    expect(screen.getByRole("button", { name: /Right/ }).disabled).toBe(true);
  });
  it("Ask again adds a new answer bubble, keeps the old one, and stops after two extra tries", () => {
    const onAsk = vi.fn();
    render(<BotChat model={model} requireVote={false} requireTopic={false} onAsk={onAsk} typingMs={0} />);
    ask("Akbar");
    fireEvent.click(screen.getByRole("button", { name: /Ask again/ }));
    expect(onAsk).toHaveBeenCalledTimes(2);
    expect(onAsk.mock.calls[1][0].attempt).toBe(1);
    expect(screen.getAllByText("Akbar").length).toBe(2);           // both question bubbles remain
    fireEvent.click(screen.getByRole("button", { name: /Ask again/ }));
    expect(onAsk.mock.calls[2][0].attempt).toBe(2);
    expect(screen.queryByRole("button", { name: /Ask again/ })).toBeNull();
  });
  it("shows a typing pause before the answer when typingMs > 0", async () => {
    vi.useFakeTimers();
    try {
      render(<BotChat model={model} requireVote={false} requireTopic={false} typingMs={500} />);
      ask("Akbar");
      expect(screen.getByText(/is typing/)).toBeTruthy();
      await act(async () => { await vi.advanceTimersByTimeAsync(600); });
      expect(screen.queryByText(/is typing/)).toBeNull();
    } finally { vi.useRealTimers(); }
  });
});
```
Note: the second test's `ask("What is pizza?")` is rejected (no topic), so its bubble never renders — that is what the `queryByText(...).toBeNull()` asserts.

- [ ] **Step 2: Run to see failures**

Run: `npx vitest run src/components/BotChat.test.jsx` — Expected: "forgets the topic", "says so when it recognised none", "Ask again adds a new answer bubble", "typing pause" FAIL.

- [ ] **Step 3: Rewrite BotChat**

Replace `src/components/BotChat.jsx` with:
```jsx
import { useEffect, useRef, useState } from "react";
import { S, C } from "../theme.js";
import { TOPICS, VERDICTS } from "../lm/scoring.js";
import { generate, coverage } from "../lm/ngram.js";

const coverageColor = (known, total) => {
  const r = total ? known / total : 0;
  return r >= 0.6 ? C.leaf : r >= 0.3 ? C.mangoDeep : C.red;
};

export function CoverageLine({ known, total }) {
  if (!total) return null;
  const text = known === 0 ? "It recognised none of your words. It answered anyway." : `Recognised ${known} of ${total} words in your question.`;
  return <div style={{ ...S.coverage, color: coverageColor(known, total) }}>{text}</div>;
}

export function BotChat({ model, botName = "HistoryBot", requireTopic = true, requireVote = true, onAsk, onVote, placeholder = "Ask anything…", maxQ = 120, typingMs = 600, maxAttempts = 2 }) {
  const [topic, setTopic] = useState(null);
  const [q, setQ] = useState("");
  const [entries, setEntries] = useState([]);
  const [hint, setHint] = useState("");
  const [typingId, setTypingId] = useState(null);   // id of the entry whose answer is still "being typed"
  const idRef = useRef(0);
  const timerRef = useRef(null);
  const last = entries[entries.length - 1];
  const needVote = requireVote && last && !last.verdict;

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const reveal = (id) => {
    if (typingMs > 0) {
      setTypingId(id);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setTypingId(null), typingMs);
    }
  };

  const ask = (e) => {
    e?.preventDefault();
    const text = q.trim();
    if (!text) { setHint("Type a question first."); return; }
    if (requireTopic && !topic) { setHint("Pick a topic for your question first."); return; }
    if (needVote) { setHint("Vote on the last answer first."); return; }
    const cov = coverage(model, text);
    const { text: a, seededFrom } = generate(model, text, { seed: 0 });
    const entry = { id: ++idRef.current, q: text, a, topic, ...cov, seededFrom, attempt: 0, verdict: null };
    setEntries((es) => [...es, entry]); setQ(""); setHint(""); setTopic(null);
    reveal(entry.id);
    onAsk?.(entry);
  };
  const askAgain = () => {
    if (!last || last.attempt >= maxAttempts) return;
    const attempt = last.attempt + 1;
    const { text: a, seededFrom } = generate(model, last.q, { seed: attempt });
    const entry = { ...last, id: ++idRef.current, a, seededFrom, attempt, verdict: null };
    setEntries((es) => [...es, entry]); setHint("");
    reveal(entry.id);
    onAsk?.(entry);
  };
  const vote = (v) => {
    if (!last || last.verdict) return;
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
          const typing = en.id === typingId;
          return (
            <div key={en.id} style={{ display: "grid", gap: 6 }} className="nl-fade">
              <div style={S.bubbleQ}>{en.q}{en.attempt ? <span style={{ color: C.muted, fontWeight: 700 }}> · try {en.attempt + 1}</span> : null}</div>
              <div style={S.bubbleA}>
                <div style={S.bubbleWho}><span aria-hidden="true">🤖</span> {botName}</div>
                {typing ? <span style={{ color: C.muted }}>{botName} is typing…</span> : en.a}
                {!typing && <CoverageLine known={en.known} total={en.total} />}
                {isLast && !typing && (
                  <div style={S.voteRow}>
                    {requireVote && VERDICTS.map((v) => (
                      <button key={v.id} type="button" className="nl-btn" disabled={!!en.verdict} style={{ ...S.voteBtn, ...(en.verdict === v.id ? S.voteBtnOn : null) }} onClick={() => vote(v.id)}>
                        <span aria-hidden="true">{v.emoji}</span> {v.label}
                      </button>
                    ))}
                    {en.attempt < maxAttempts && (
                      <button type="button" className="nl-btn" style={{ ...S.tiny, color: C.skyDeep }} onClick={askAgain}>↺ Ask again</button>
                    )}
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

- [ ] **Step 4: Run the BotChat tests**

Run: `npx vitest run src/components/BotChat.test.jsx` — Expected: all 7 PASS, no act() warnings (the fake-timer test uses `advanceTimersByTimeAsync`, which flushes React updates).

- [ ] **Step 5: Add the mission card to Chat**

In `src/screens/Chat.jsx`, inside the first `<section>` directly after the `<p style={S.hint}>…</p>` line and before `<BotChat …/>`, add:
```jsx
        <div style={{ ...S.qBox, marginBottom: 14 }}>
          <div style={S.qKick}>Your mission</div>
          <p style={{ ...S.q, margin: 0 }}>Your mission: find one answer it gets right, one it gets wrong, and one that is pure nonsense. Then try to trick it.</p>
        </div>
```

- [ ] **Step 6: Full suite, commit**

Run: `npx vitest run` — Expected: all PASS (the Scoreboard/TrainBot tests that render BotChat are unaffected because they never assert on timing; if any test that renders `BotChat` now sees "is typing…" instead of an answer, pass `typingMs={0}` in THAT screen's test via props is not possible — instead assert after `await screen.findByText(...)`; report which test needed it).
```bash
git add src/components/BotChat.jsx src/components/BotChat.test.jsx src/screens/Chat.jsx
git commit -m "Tag every question on purpose, let the coverage line speak, keep Ask-again answers"
```

---

### Task 3: Scoreboard as a real reveal — phase gate, projector corpus, nonsense of the day, teacher control, topic strips

**Rationale (review Q2, Q3, must-fix 2):** bars appear at vote 10 even during chat, spoiling the reveal if the Scoreboard tab is on the projector (natural, students want the feed). The corpus is a 420 px scroll box; "this is its whole mind" needs the text small and finite on one screen, with recognised words highlighted. The feed prints raw student questions with no teacher control ("who is allah" → a Jinnah sentence, in a Pakistani school). The exam leaderboard reads 20% / 0% / 0% / — and teaches nothing; per-bot topic strips show "every bot has one bump, in a different place", which survives adversarial asking.

**Files:**
- Modify: `src/lm/scoring.js`, `src/lm/scoring.test.js`, `src/components/Corpus.jsx`, `src/components/Corpus.test.jsx`, `src/screens/Scoreboard.jsx`, `src/screens/Scoreboard.test.jsx`
- Create: `src/lm/projectorFilter.js`, `src/lm/projectorFilter.test.js`

**Interfaces:**
- Produces in `scoring.js`: `recentVotes(votes, n)` rows now carry `id` (the Firebase key); `botTopicTallies(botVotes, teamId) → rows` one per TOPIC in order `{ topic, label, emoji, n, right, pct | null }` over FOREIGN votes only (`askerTeamId !== teamId`); `nonsenseOfTheDay(votes) → vote | null` = among valid votes with `verdict === "nonsense"` and `total > 0`, the lowest `known/total`, ties → newest `at`.
- Produces in `projectorFilter.js`: `PROJECTOR_DENYLIST: string[]`, `isProjectorSafe(q) → boolean` (false when any denylisted term appears as a whole word, case-insensitive).
- Produces in `Corpus.jsx`: prop `compact = false`; when true the box has no max height, three CSS columns, 12 px text — for the projector.

- [ ] **Step 1: Failing scoring tests**

Append to `src/lm/scoring.test.js`:
```js
import { botTopicTallies, nonsenseOfTheDay } from "./scoring.js";

describe("botTopicTallies", () => {
  const bv = {
    a: { askerTeamId: "tB", botTeamId: "tA", topic: "sport", verdict: "right" },
    b: { askerTeamId: "tB", botTeamId: "tA", topic: "sport", verdict: "wrong" },
    c: { askerTeamId: "tC", botTeamId: "tA", topic: "science", verdict: "nonsense" },
    d: { askerTeamId: "tA", botTeamId: "tA", topic: "sport", verdict: "right" },   // own team: excluded
    e: { askerTeamId: "tB", botTeamId: "tB", topic: "sport", verdict: "right" },   // other bot
  };
  it("tallies foreign votes per topic in fixed order", () => {
    const rows = botTopicTallies(bv, "tA");
    expect(rows.map((r) => r.topic)).toEqual(["history", "science", "sport", "maths", "everyday", "other"]);
    expect(rows.find((r) => r.topic === "sport")).toMatchObject({ n: 2, right: 1, pct: 0.5 });
    expect(rows.find((r) => r.topic === "science")).toMatchObject({ n: 1, right: 0, pct: 0 });
    expect(rows.find((r) => r.topic === "history")).toMatchObject({ n: 0, right: 0, pct: null });
  });
});

describe("nonsenseOfTheDay", () => {
  it("picks the nonsense vote with the lowest coverage, newest on ties, ignoring zero-total", () => {
    const votes = {
      a: { topic: "science", verdict: "nonsense", q: "cells?", known: 1, total: 2, at: 1 },
      b: { topic: "maths", verdict: "nonsense", q: "7x8", known: 0, total: 0, at: 5 },
      c: { topic: "other", verdict: "nonsense", q: "pizza", known: 0, total: 1, at: 3 },
      d: { topic: "other", verdict: "nonsense", q: "sky blue", known: 0, total: 2, at: 4 },
      e: { topic: "history", verdict: "right", q: "akbar", known: 1, total: 1, at: 9 },
    };
    expect(nonsenseOfTheDay(votes).q).toBe("sky blue");
    expect(nonsenseOfTheDay({})).toBeNull();
  });
});

describe("recentVotes ids", () => {
  it("carries the record key as id", () => {
    const rows = recentVotes({ k1: { topic: "history", verdict: "right", at: 1 }, k2: { topic: "other", verdict: "wrong", at: 2 } });
    expect(rows.map((r) => r.id)).toEqual(["k2", "k1"]);
  });
});
```
(Merge the new `import` into the existing import line at the top of the file rather than leaving two import statements.)

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run src/lm/scoring.test.js` — Expected: new tests FAIL (functions undefined / no id).

- [ ] **Step 3: Implement in scoring.js**

Change `list` and add the two functions:
```js
const list = (map) => Object.entries(map || {}).map(([id, r]) => (r && typeof r === "object" ? { id, ...r } : r)).filter(valid);

export function botTopicTallies(botVotes, teamId) {
  const rs = list(botVotes).filter((r) => r.botTeamId === teamId && r.askerTeamId !== teamId);
  return TOPICS.map((t) => ({ topic: t.id, label: t.label, emoji: t.emoji, ...tally(rs.filter((r) => r.topic === t.id)) }));
}

export function nonsenseOfTheDay(votes) {
  const rs = list(votes).filter((r) => r.verdict === "nonsense" && Number(r.total) > 0);
  if (!rs.length) return null;
  const ratio = (r) => Number(r.known || 0) / Number(r.total);
  return rs.sort((a, b) => ratio(a) - ratio(b) || (b.at || 0) - (a.at || 0))[0];
}
```

- [ ] **Step 4: Run scoring tests** — `npx vitest run src/lm/scoring.test.js` — Expected: all PASS (existing tests still pass: `id` is an extra field they ignore).

- [ ] **Step 5: Projector filter (test first)**

`src/lm/projectorFilter.test.js`:
```js
import { describe, it, expect } from "vitest";
import { isProjectorSafe, PROJECTOR_DENYLIST } from "./projectorFilter.js";

describe("isProjectorSafe", () => {
  it("hides questions containing a denylisted whole word, case-insensitively", () => {
    expect(isProjectorSafe("who is Allah")).toBe(false);
    expect(isProjectorSafe("WHAT DOES GOD LOOK LIKE?")).toBe(false);
    expect(isProjectorSafe("is this a good idea")).toBe(true);      // "god" inside "good" is not a word match
    expect(isProjectorSafe("Who founded the Muslim League?")).toBe(true);
    expect(isProjectorSafe("When did Akbar die?")).toBe(true);          // legitimate history must reach the projector
    expect(isProjectorSafe("How did Islam reach Sindh?")).toBe(true);
    expect(isProjectorSafe("")).toBe(true);
  });
  it("exports the list so the teacher notes can describe it", () => {
    expect(PROJECTOR_DENYLIST.length).toBeGreaterThan(10);
  });
});
```
`src/lm/projectorFilter.js`:
```js
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
```
Run: `npx vitest run src/lm/projectorFilter.test.js` — Expected: PASS.

- [ ] **Step 6: Corpus compact mode (test first)**

Append to `src/components/Corpus.test.jsx`:
```jsx
  it("compact mode drops the scroll box and uses columns for the projector", () => {
    const { container } = render(<Corpus text={"One two.\n\nThree four."} compact />);
    const box = container.firstChild;
    expect(box.style.maxHeight).toBe("none");
    expect(box.style.columnCount).toBe("3");
  });
```
In `src/components/Corpus.jsx` change the signature to `export function Corpus({ text, highlight = [], compact = false })` and the wrapper to:
```jsx
    <div style={{ ...S.corpus, ...(compact ? { maxHeight: "none", overflowY: "visible", columnCount: 3, columnGap: 24, fontSize: 12, lineHeight: 1.55 } : null) }}>
```
Run: `npx vitest run src/components/Corpus.test.jsx` — Expected: PASS.

- [ ] **Step 7: Rewrite the Scoreboard tests**

Replace `src/screens/Scoreboard.test.jsx` with:
```jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

let votesValue = null, botsValue = null, botVotesValue = null;
vi.mock("../rooms/hooks.js", () => ({
  useVotes: () => ({ value: votesValue, loading: false }),
  useBots: () => ({ value: botsValue, loading: false }),
  useBotVotes: () => ({ value: botVotesValue, loading: false }),
}));

import { Scoreboard } from "./Scoreboard.jsx";

const v = (topic, verdict, i, extra = {}) => ({ uid: "u", topic, verdict, q: `q${i}`, a: `a${i}`, known: 1, total: 2, at: i, ...extra });
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
  it("keeps the bars and headline hidden during the chat phase even with many votes, but shows the feed", () => {
    votesValue = many();
    render(<Scoreboard {...base} meta={{ phase: "chat", activity: 2 }} />);
    expect(screen.queryByText(/answers were judged/)).toBeNull();
    expect(screen.queryByText("It never once said 'I don't know'. Why not?")).toBeNull();
    expect(screen.getByText(/14 answers judged so far/)).toBeTruthy();
    expect(screen.getByText("q15")).toBeTruthy();                       // newest feed item (at = 15)
  });
  it("shows per-topic bars, the headline split, the question and the nonsense of the day once revealed", () => {
    votesValue = many();
    render(<Scoreboard {...base} />);
    expect(screen.getByText(/14 answers were judged/)).toBeTruthy();
    expect(screen.getByText(/75% of history/)).toBeTruthy();
    expect(screen.getByText(/17% of everything else/)).toBeTruthy();
    expect(screen.getByText("It never once said 'I don't know'. Why not?")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Show me everything it has ever read" })).toBeTruthy();
    expect(screen.getByText("Nonsense of the day")).toBeTruthy();
  });
  it("greys out a topic with fewer than three votes", () => {
    votesValue = { ...many(), m1: v("maths", "right", 30) };
    render(<Scoreboard {...base} />);
    const row = screen.getByRole("row", { name: /Maths/ });
    expect(row.textContent).toMatch(/1 asked/);
    expect(row.textContent).toMatch(/—/);
  });
  it("keeps denylisted questions off the projector and lets the teacher hide any feed item", () => {
    votesValue = { ...many(), z: v("other", "nonsense", 40, { q: "who is allah" }) };
    render(<Scoreboard {...base} />);
    expect(screen.queryByText("who is allah")).toBeNull();
    expect(screen.getByText("Nonsense of the day")).toBeTruthy();     // falls back to a safe nonsense vote
    fireEvent.click(screen.getByRole("button", { name: /hide q15/i }));
    expect(screen.queryByText("q15")).toBeNull();
  });
  it("shows the cross-examination leaderboard with a topic strip per bot, even while waiting on votes", () => {
    votesValue = { a: v("history", "right", 1) };
    botsValue = { tA: { text: "x" }, tB: { text: "y" } };
    botVotesValue = {
      1: { uid: "u", askerTeamId: "tB", botTeamId: "tA", topic: "history", verdict: "right", q: "q", at: 1 },
      2: { uid: "u", askerTeamId: "tB", botTeamId: "tA", topic: "history", verdict: "right", q: "q", at: 2 },
      3: { uid: "u", askerTeamId: "tB", botTeamId: "tA", topic: "sport", verdict: "wrong", q: "q", at: 3 },
    };
    render(<Scoreboard {...base} meta={{ phase: "exam", activity: 2 }} />);
    expect(screen.getByText("Every bot is now questioned by strangers. Which one survived?")).toBeTruthy();
    expect(screen.getByText(/waiting for questions/i)).toBeTruthy();
    expect(screen.getByText("67%")).toBeTruthy();
    expect(screen.getByLabelText("Accuracy by topic for Aloo")).toBeTruthy();
  });
});
```

- [ ] **Step 8: Run to see failures** — `npx vitest run src/screens/Scoreboard.test.jsx` — Expected: most FAIL.

- [ ] **Step 9: Rewrite Scoreboard**

Replace `src/screens/Scoreboard.jsx` with:
```jsx
import { useMemo, useState } from "react";
import { S, C } from "../theme.js";
import { useVotes, useBots, useBotVotes } from "../rooms/hooks.js";
import { topicAccuracy, splitHistoryVsRest, recentVotes, botLeaderboard, botTopicTallies, nonsenseOfTheDay, MIN_VOTES_TO_SHOW, TOPICS, VERDICTS } from "../lm/scoring.js";
import { isProjectorSafe } from "../lm/projectorFilter.js";
import { HISTORY_TEXT } from "../lm/texts/index.js";
import { trainModel, coverage } from "../lm/ngram.js";
import { pct } from "../ml/net.js";
import { Corpus } from "../components/Corpus.jsx";

const MIN_TOPIC_VOTES = 3;
const barColor = (p) => (p == null ? C.line : p > 0.6 ? C.leaf : p > 0.3 ? C.mangoDeep : C.red);
const verdictEmoji = (v) => VERDICTS.find((x) => x.id === v)?.emoji || "";
const topicEmoji = (t) => TOPICS.find((x) => x.id === t)?.emoji || "";

function TopicStrip({ rows, label }) {
  return (
    <span aria-label={label} title={rows.map((r) => `${r.label}: ${r.n ? pct(r.pct) : "—"} (${r.n})`).join(" · ")} style={{ display: "inline-flex", gap: 3, alignItems: "flex-end", height: 22 }}>
      {rows.map((r) => (
        <span key={r.topic} style={{ width: 14, height: r.n ? 4 + Math.round((r.pct || 0) * 18) : 4, borderRadius: 3, background: r.n ? barColor(r.pct) : C.line }} />
      ))}
    </span>
  );
}

export function Scoreboard({ code, teams, meta, isTeacher }) {
  const { value: votes } = useVotes(code, true);
  const examOpen = meta?.phase === "exam";
  const revealed = meta?.phase !== "chat";
  const { value: bots } = useBots(code, examOpen);
  const { value: botVotes } = useBotVotes(code, examOpen);
  const model = useMemo(() => trainModel(HISTORY_TEXT), []);
  const rows = useMemo(() => topicAccuracy(votes), [votes]);
  const split = useMemo(() => splitHistoryVsRest(votes), [votes]);
  const [hidden, setHidden] = useState(() => new Set());
  // Everything the projector shows is drawn from the "safe" votes: not denylisted, not hidden by the teacher.
  const safeVotes = useMemo(() => Object.fromEntries(Object.entries(votes || {}).filter(([id, r]) => isProjectorSafe(r?.q) && !hidden.has(id))), [votes, hidden]);
  const feed = useMemo(() => recentVotes(safeVotes, 8), [safeVotes]);
  const nonsense = useMemo(() => nonsenseOfTheDay(safeVotes), [safeVotes]);
  const board = useMemo(() => botLeaderboard(botVotes, teams, bots), [botVotes, teams, bots]);
  const [showCorpus, setShowCorpus] = useState(false);
  const [focusId, setFocusId] = useState(null);
  const focus = feed.find((f) => f.id === focusId) || feed[0] || null;
  const highlight = useMemo(() => (focus ? coverage(model, focus.q).knownWords : []), [model, focus]);
  const enough = split.total >= MIN_VOTES_TO_SHOW;

  return (
    <main style={S.wide} className="nl-fade">
      <h1 style={S.h1}>📊 Scoreboard</h1>

      {!revealed ? (
        <p style={S.lede}>Keep asking. <b>{split.total} answers judged so far.</b> The scoreboard opens when the teacher reveals it.</p>
      ) : !enough ? (
        <p style={S.empty}>Waiting for questions. {split.total} of {MIN_VOTES_TO_SHOW} answers voted on so far.</p>
      ) : (
        <>
          <p style={S.lede}>
            {split.total} answers were judged. It was right about <b>{pct(split.history.pct)} of history</b> and <b>{pct(split.rest.pct)} of everything else</b>.
          </p>
          <div style={S.table} role="table" aria-label="Accuracy by topic">
            {rows.map((r) => {
              const shown = r.n >= MIN_TOPIC_VOTES;
              return (
                <div key={r.topic} role="row" aria-label={r.label} style={{ ...S.tr, gridTemplateColumns: "1.2fr .5fr .6fr 2fr", opacity: shown ? 1 : 0.6 }}>
                  <span style={{ fontWeight: 800 }}><span aria-hidden="true">{r.emoji}</span> {r.label}</span>
                  <span style={{ color: C.muted, fontWeight: 700 }}>{r.n} asked</span>
                  <span style={{ color: shown ? barColor(r.pct) : C.muted, fontWeight: 800 }}>{shown ? pct(r.pct) : "—"}</span>
                  <span style={S.barCell}><span style={{ ...S.bar, width: `${shown ? (r.pct || 0) * 100 : 0}%`, background: barColor(shown ? r.pct : null) }} /></span>
                </div>
              );
            })}
          </div>
          <div style={S.qBox}>
            <div style={S.qKick}>Work this out before anyone tells you</div>
            <p style={S.q}>It answered every single question, in full sentences, without hesitating. Look at the bars.</p>
            <p style={S.qBig}>It never once said 'I don't know'. Why not?</p>
          </div>
          {nonsense && (
            <div style={{ ...S.qBox, borderColor: C.berry }}>
              <div style={{ ...S.qKick, color: C.berry }}>Nonsense of the day</div>
              <p style={{ ...S.q, margin: 0 }}><span aria-hidden="true">{topicEmoji(nonsense.topic)}</span> {nonsense.q}</p>
              <p style={{ ...S.qBig, fontSize: 22 }}>{nonsense.a}</p>
              <p style={S.coverage}>It recognised {nonsense.known} of {nonsense.total} words. It answered anyway.</p>
            </div>
          )}
        </>
      )}

      <div style={{ ...S.card, marginTop: 20 }}>
        <h2 style={S.h2}>Latest questions</h2>
        {isTeacher && <p style={S.hint}>Tap a question to highlight its words in the text below. Press ✕ to hide one from the projector.</p>}
        <div style={{ display: "grid", gap: 8 }}>
          {feed.map((f) => (
            <div key={f.id} style={{ ...S.feedItem, outline: f.id === focus?.id ? `3px solid ${C.sun}` : "none", cursor: "pointer" }} onClick={() => setFocusId(f.id)}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontWeight: 800 }}><span aria-hidden="true">{topicEmoji(f.topic)}</span> {f.q}</div>
                {isTeacher && (
                  <button type="button" className="nl-btn" aria-label={`Hide ${f.q}`} style={{ ...S.tiny, color: C.muted }} onClick={(e) => { e.stopPropagation(); setHidden((h) => new Set([...h, f.id])); }}>✕</button>
                )}
              </div>
              <div style={{ color: C.muted }}>{f.a}</div>
              <div style={S.coverage}>{verdictEmoji(f.verdict)} {f.verdict} · recognised {f.known} of {f.total} words</div>
            </div>
          ))}
          {feed.length === 0 && <p style={S.empty}>No questions yet.</p>}
        </div>
      </div>

      <div style={{ ...S.card, marginTop: 20 }}>
        <button className="nl-btn" style={S.accent} onClick={() => setShowCorpus((v) => !v)}>
          {showCorpus ? "Hide what it has read" : "Show me everything it has ever read"}
        </button>
        {showCorpus && (
          <div style={{ marginTop: 14 }}>
            <p style={{ ...S.hint, margin: "0 0 8px" }}>
              This is its whole mind. {focus ? <>Highlighted: the words from “{focus.q}” it recognised.</> : null}
            </p>
            <Corpus text={HISTORY_TEXT} highlight={highlight} compact />
          </div>
        )}
      </div>

      {examOpen && (
        <div style={{ marginTop: 28 }}>
          <h2 style={S.h2}>🎤 Cross-examination</h2>
          <p style={S.lede}>Every bot is now questioned by strangers. Which one survived?</p>
          <p style={S.hint}>Each strip shows the bot's accuracy per topic, in the same order as above: History · Science · Sport · Maths · Everyday · Other. Every bot has one bump. Where is it?</p>
          {board.length === 0 ? <p style={S.empty}>No bots sent yet.</p> : (
            <div style={S.table} role="table" aria-label="Bot leaderboard">
              <div style={{ ...S.tr, ...S.thead, gridTemplateColumns: "1.4fr .6fr .6fr 1fr 2fr" }} role="row"><span>Bot</span><span>Own team</span><span>Strangers</span><span>By topic</span><span /></div>
              {board.map((b, i) => (
                <div key={b.teamId} role="row" style={{ ...S.tr, gridTemplateColumns: "1.4fr .6fr .6fr 1fr 2fr" }}>
                  <span style={{ fontWeight: 800, color: i === 0 && b.foreign.pct != null ? C.mangoDeep : C.ink }}>{i === 0 && b.foreign.pct != null ? "⭐ " : ""}{b.name}</span>
                  <span style={{ color: C.muted, fontWeight: 700 }}>{pct(b.own.pct)}</span>
                  <span style={{ color: barColor(b.foreign.pct), fontWeight: 800 }}>{b.foreign.pct == null ? `${b.foreign.n} asked` : pct(b.foreign.pct)}</span>
                  <TopicStrip rows={botTopicTallies(botVotes, b.teamId)} label={`Accuracy by topic for ${b.name}`} />
                  <span style={S.barCell}><span style={{ ...S.bar, width: `${(b.foreign.pct || 0) * 100}%`, background: i === 0 ? C.sun : C.sky }} /></span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
```
Notes: `C.berry` exists in the palette. `Room.jsx` already passes `isTeacher` in the shared props object (verify with `grep -n "isTeacher" src/screens/Room.jsx`).

- [ ] **Step 10: Run the Scoreboard tests** — `npx vitest run src/screens/Scoreboard.test.jsx` — Expected: all 6 PASS. If "67%" appears twice (leaderboard cell + strip title), the strip uses `title`, not text, so `getByText` stays unique.

- [ ] **Step 11: Full suite, commit**

Run: `npx vitest run` — Expected: all PASS.
```bash
git add src/lm/scoring.js src/lm/scoring.test.js src/lm/projectorFilter.js src/lm/projectorFilter.test.js src/components/Corpus.jsx src/components/Corpus.test.jsx src/screens/Scoreboard.jsx src/screens/Scoreboard.test.jsx
git commit -m "Make the scoreboard a real reveal: phase gate, projector corpus, nonsense of the day, teacher control, topic strips"
```

---

### Task 4: Exam, TrainBot, Lobby, Settings, docs

**Rationale (review Q3, Q4, Q6):** every examiner lands on the same first bot and the leaderboard sits at "—" for minutes; a team's second send silently overwrites the first; typing 150 words on a phone in 8 minutes will not happen; the Lobby tells the activity-2 teacher to press "Start teaching" (button says "Start chatting"); the run sheet asks "whose text was it?" while Exam already prints the sources; the notes never warn that students will ask about religion.

**Files:**
- Modify: `src/screens/Exam.jsx`, `src/screens/TrainBot.jsx`, `src/screens/TrainBot.test.jsx`, `src/screens/Lobby.jsx`, `src/screens/Lobby.test.jsx`, `src/screens/Settings.jsx`, `src/screens/Settings.test.jsx`, `docs/superpowers/specs/2026-09-17-activity-2-talk-to-the-machine-design.md`, `README.md`
- Create: `src/screens/Exam.test.jsx`

**Interfaces:**
- Consumes: `hashString` (`src/lm/tokenize.js`), `phaseAction(phase, activity)` (`src/rooms/phases.js`), RoomProps `members` (`{ [uid]: { name, teamId } }`), `isProjectorSafe` not needed here.

- [ ] **Step 1: Exam test (new, failing)**

`src/screens/Exam.test.jsx`:
```jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const TEXT = "Cricket is a bat and ball game. The bowler bowls the ball. The batter hits the ball. A match has two innings.";
vi.mock("../rooms/hooks.js", () => ({
  useBots: () => ({ value: { tA: { text: TEXT, sources: ["cricket"] }, tB: { text: TEXT, sources: ["cooking"] }, tC: { text: TEXT, sources: ["space"] } }, loading: false }),
  useBotVotes: () => ({ value: null, loading: false }),
}));
vi.mock("../rooms/api.js", () => ({ castBotVote: vi.fn() }));

import { Exam } from "./Exam.jsx";

const base = { code: "ABCDE", uid: "student-1", teams: { tA: { name: "Aloo" }, tB: { name: "Bhindi" }, tC: { name: "Chai" } }, isTeacher: false, flash: () => {} };

describe("Exam", () => {
  it("starts on another team's bot, never your own", () => {
    render(<Exam {...base} team={{ id: "tA", name: "Aloo" }} />);
    expect(screen.getByText(/Asking/).textContent).not.toMatch(/Aloo's bot/);
    expect(screen.getByText(/Asking/).textContent).toMatch(/fed on: (cooking|space)/);   // sources sit in a nested <b>, so match on the paragraph's textContent
  });
  it("spreads examiners across bots by uid", () => {
    const picks = new Set();
    for (const uid of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      const { unmount } = render(<Exam {...base} uid={uid} team={{ id: "tA", name: "Aloo" }} />);
      picks.add(screen.getByText(/Asking/).textContent.match(/Asking (.*?)'s bot/)[1]);
      unmount();
    }
    expect(picks.size).toBe(2);   // Bhindi and Chai both get examiners
  });
});
```

- [ ] **Step 2: Run to see it fail** — `npx vitest run src/screens/Exam.test.jsx` — Expected: FAIL (default is `ids[0]` = tA).

- [ ] **Step 3: Default to a random other team's bot**

In `src/screens/Exam.jsx`: add `import { hashString } from "../lm/tokenize.js";` and replace the `botId` line with:
```jsx
  const others = ids.filter((id) => id !== team?.id);
  const pool = others.length ? others : ids;
  const defaultId = pool.length ? pool[hashString(String(uid || "")) % pool.length] : null;
  const botId = pickedId && bots?.[pickedId] ? pickedId : defaultId;
```
Change the hint line to:
```jsx
                <p style={S.hint}>Asking <b>{name(botId)}'s bot</b>{(bots[botId].sources || []).length ? <> · fed on: <b>{bots[botId].sources.join(", ")}</b>. Ask it about those, then about something else.</> : "."} Pick the topic, ask, vote. {team?.id === botId ? "Votes on your own bot don't count for strangers." : ""}</p>
```
Run: `npx vitest run src/screens/Exam.test.jsx` — Expected: PASS. (If the second test finds only one bot for those 8 uids, change the uid list until both appear and note it; `hashString` is FNV-1a, so 8 distinct short strings hit both residues in practice.)

- [ ] **Step 4: TrainBot — confirm before replacing, show who sent, own-text tip (test first)**

Append to `src/screens/TrainBot.test.jsx` (the existing file mocks `useTeamBot`; make its return configurable with a `let sentValue = null` the mock reads, then):
```jsx
  it("asks before replacing a bot the team already sent, and says who sent it", () => {
    sentValue = { text: "x", sources: ["biology"], sentBy: "u9" };
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<TrainBot {...props} members={{ u9: { name: "Sana", teamId: "tA" } }} />);
    expect(screen.getByText(/sent by Sana/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Cricket/ }));
    fireEvent.click(screen.getByRole("button", { name: /Train my bot/ }));
    fireEvent.click(screen.getByRole("button", { name: /Send my bot/ }));
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringMatching(/already sent .*biology.*Replace it\?/));
    expect(api.sendBot).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
    sentValue = null;
  });
```
(`props` = the existing base props object in that test file with a team `tA` named as the file already does; `api` = the existing mocked api reference. Read the file first and adapt names; keep the existing tests passing.)

In `src/screens/TrainBot.jsx`: signature `TrainBot({ code, uid, team, members, isTeacher, flash })`; in `send()` after the `!team` guard add:
```jsx
    if (sent.value && !window.confirm(`${team.name} already sent a bot (${(sent.value.sources || []).join(", ") || "own text"}). Replace it?`)) return;
```
Change the sent line to:
```jsx
          <p style={{ ...S.hint, color: C.leaf, fontWeight: 800 }}>✓ {team.name}'s bot is in ({(sent.value.sources || []).join(", ") || "own text"}), sent by {members?.[sent.value.sentBy]?.name || "a teammate"}. Sending again replaces it.</p>
```
Under the own-text counter add: `<p style={S.hint}>Tip: copy a paragraph from your notes or any website. Typing 150 words on a phone takes too long.</p>`.
Run: `npx vitest run src/screens/TrainBot.test.jsx` — Expected: PASS. Confirm `Room.jsx` passes `members` in the shared props object (it does for Lobby; verify with `grep -n "members" src/screens/Room.jsx`).

- [ ] **Step 5: Lobby hint uses the real button label (test first)**

Append to `src/screens/Lobby.test.jsx` (the file already renders a teacher Lobby; follow its props):
```jsx
  it("tells the activity-2 teacher to press Start chatting", () => {
    render(<Lobby {...teacherProps} activity={2} />);
    expect(screen.getByText(/Press/).textContent).toMatch(/Start chatting/);
  });
```
In `src/screens/Lobby.jsx`: `import { phaseAction } from "../rooms/phases.js";` and change the hint to `Press <b>{phaseAction("lobby", activity)}</b> above when teams are ready.`
Run: `npx vitest run src/screens/Lobby.test.jsx` — Expected: PASS (activity-1 text unchanged: `phaseAction("lobby", 1)` is "Start teaching").

- [ ] **Step 6: Settings — run sheet line, notes, teacher script (test first)**

Append to `src/screens/Settings.test.jsx` (follow the file's existing activity-2 render):
```jsx
  it("activity-2 notes carry the religion warning and the teacher script", () => {
    render(<Settings {...base} activity={2} />);
    expect(screen.getByText(/Students will ask it about religion/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Say this" })).toBeTruthy();
    expect(screen.getByText(/Where is the bump/)).toBeTruthy();   // unique to the script ("one bump" also appears in the run sheet)
  });
```
In `src/screens/Settings.jsx`:
- `RUN_SHEET_2` becomes:
```js
const RUN_SHEET_2 = [
  ["0:00", "Teams of four. Room code in. Projector: Lobby."],
  ["0:03", "Start chatting. Projector: Scoreboard (only the feed shows). Say nothing about how it works."],
  ["0:11", "Reveal scoreboard. Let them read the bars. Ask the question on screen."],
  ["0:14", "Show me everything it has ever read. Tap a question to highlight its words."],
  ["0:18", "Start training. One phone per team sends. Agree first."],
  ["0:26", "Open cross-examination. Ask strangers' bots. Be a fair examiner."],
  ["0:34", "Leaderboard. Look at the strips: every bot has one bump. Where is it?"],
  ["0:40", "Out."],
];
```
- In the activity-2 branch of the notes card, after the existing "The reveal" section, add:
```jsx
              <h2 style={{ ...S.h2, marginTop: 18 }}>Before you start</h2>
              <p style={S.p}>Students will ask it about religion. It will answer with random history sentences. Say once, before you start: it does not understand a word you type — that is the point. Questions with a few sensitive words stay off the projector automatically; tap ✕ on any feed item to hide it.</p>
              <h2 style={{ ...S.h2, marginTop: 18 }}>Say this</h2>
              <p style={S.p}><b>Chat:</b> "There is a bot on your phone. It has read exactly one thing in its life. Ask it anything. Tag the topic, read the answer, then tell me: right, wrong, or nonsense. Be honest — this is a report on it, not a vote for it."</p>
              <p style={S.p}><b>Reveal:</b> "Read the headline to me. It answered every single question in full sentences and never once said 'I don't know'. Why not?" Take three answers, agree with none. Then press Show me everything it has ever read: "This is its whole mind. Find the sentence yours came from."</p>
              <p style={S.p}><b>Train:</b> "Now build your own. Tick what it reads — that is everything it will ever know. Train it, ask it about its topic, then about something else. Watch the coverage line."</p>
              <p style={S.p}><b>Exam:</b> "Every bot is now questioned by strangers. Ask other teams' bots. Be a fair examiner." Then: "Look at the strips. Every bot has one bump. Where is the bump? That is what it read."</p>
              <p style={S.p}><b>Wrap:</b> "Last lesson: a machine only knows what it was shown. This lesson: a language model only says what it has read, one word at a time, confidently, about anything. The big ones have read millions of times more, so the mistakes are rarer and harder to spot. What did it read, and who chose that?"</p>
```
(`S.p` — check the file for the paragraph style it already uses in the notes card and use that key instead if `S.p` does not exist.)
Run: `npx vitest run src/screens/Settings.test.jsx` — Expected: PASS.

- [ ] **Step 7: Spec and README**

Spec `docs/superpowers/specs/2026-09-17-activity-2-talk-to-the-machine-design.md`:
- §5: after the coverage-line sentence add: "When it recognised no words the line reads 'It recognised none of your words. It answered anyway.'; when the question has no content words the line is hidden. The topic chip resets after every question. 'Ask again' appends a new answer (max two extra tries per question), each with its own vote. A short typing pause precedes every answer."
- §6: replace the first bullet block with: "During phase `chat` the Scoreboard shows only the live feed and a running count ('{N} answers judged so far'); headline, bars, the reveal question and 'Nonsense of the day' appear from phase `reveal` once ≥ 10 votes exist. Topics with < 3 votes show '—'. Questions containing denylisted words (`src/lm/projectorFilter.js`) stay off the projector; the teacher can hide any feed item. The corpus renders projector-sized (three columns, no scroll) with the focused question's recognised words highlighted (tap a feed item to focus it). In phase `exam` each leaderboard row carries a per-topic strip over strangers' votes."
- §8: add "The default bot is a random other team's bot (stable per student). Sources are shown ('fed on: …')."
README "Lesson 2 run": add one line: "The Settings tab carries a run sheet and a read-aloud teacher script for every phase."

- [ ] **Step 8: Full suite, build, commit**

Run: `npx vitest run` and `npm run build` — Expected: all PASS, build OK.
```bash
git add src/screens/Exam.jsx src/screens/Exam.test.jsx src/screens/TrainBot.jsx src/screens/TrainBot.test.jsx src/screens/Lobby.jsx src/screens/Lobby.test.jsx src/screens/Settings.jsx src/screens/Settings.test.jsx docs/superpowers/specs/2026-09-17-activity-2-talk-to-the-machine-design.md README.md
git commit -m "Spread examiners across bots, confirm bot replacement, fix lobby hint, add the teacher script"
```

---

### Task 5: Verify and ship (controller)

- [ ] `npx vitest run` (expect ≈ 153 + ~20), `npm run test:rules` (41, unchanged rules), `npm run build`.
- [ ] `npm run simulate -- --activity 2 --students 8 --max-teams 3` live (simulator unaffected by UI changes; confirms the model changes still produce a history-high / rest-low scoreboard).
- [ ] Merge to `main`, push (deploys), confirm the live bundle contains "Nonsense of the day".
