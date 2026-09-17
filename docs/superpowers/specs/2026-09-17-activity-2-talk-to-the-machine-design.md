# Activity 2 — "Talk to the machine" — Design Spec

Date: 2026-09-17
Status: approved in chat (engine, two-part flow, one round, starter texts + own text, author-written texts)

## 1. Purpose

Lesson 2 of Neural Lab. Lesson 1 showed that a machine only knows what it was shown
(drawings). Lesson 2 shows the same thing for language: a language model predicts the
next word from the text it has read, and it will answer *any* question in the voice of
that text, confidently, whether or not it knows anything about the topic.

Two parts, mirroring Lesson 1:

- **Part 1 · HistoryBot.** Everyone chats with one bot trained on ~2,000 words of South
  Asian history. Students tag each question's topic and vote whether the answer was
  right. The scoreboard shows history high, everything else near zero. Then the class
  sees the bot's entire training text on one screen: "this is its whole mind".
- **Part 2 · Train your own bot.** Teams pick starter texts and/or paste their own,
  train a bot, send it to the class. Cross-examination: anyone asks any team's bot,
  votes; leaderboard = % right on questions from other teams. One round.

The bot is a real, honest model (a word-level trigram next-word predictor built in the
browser), not a role-playing LLM. Nothing is faked and the training text is inspectable.

## 2. Entry and rooms

- Landing becomes **Choose an activity**: `1 · Teach the machine` (existing) and
  `2 · Talk to the machine`. After choosing, the existing teacher/student choice follows.
  The "Rejoin room" shortcut stays and needs no activity choice (the room knows).
- `meta.activity` ∈ {1, 2}; absent means 1 (existing rooms unchanged). Set at room
  creation by the teacher; not editable afterwards.
- Rooms, members, teams, team cap, max teams, QR/join link, teacher identity, Leave/Rejoin,
  Close room: all reused unchanged.
- Labels (Mango/Cricket ball) are irrelevant in activity 2: the create form and Settings
  hide the label pair for activity 2; `meta.labels` still gets defaults so rules validate.

## 3. Phases (activity 2)

| phase    | students see                                   | teacher action to advance   |
|----------|------------------------------------------------|-----------------------------|
| `lobby`  | Lobby                                          | "Start chatting"            |
| `chat`   | Lobby, HistoryBot                              | "Reveal scoreboard"         |
| `reveal` | Lobby, HistoryBot, Scoreboard                  | "Start training"            |
| `train`  | Lobby, HistoryBot, Scoreboard, Train your bot  | "Open cross-examination"    |
| `exam`   | + Cross-examine                                | —                           |

Teacher always sees all tabs plus Settings. Phases only move forward except via Reset
board (returns to `chat`, clears votes/bots/botVotes). There is no "Next round" in
activity 2. Activity 1 phases/tabs are untouched.

## 4. The language model (`src/lm/`)

- **Tokenizer**: lowercase; words (letters, digits, apostrophes) and sentence-end marks
  (`.`, `?`, `!`) are tokens; other punctuation dropped. `detokenize` capitalises sentence
  starts and joins with correct spacing.
- **Model**: word-level trigram with backoff to bigram and unigram. `trainModel(text)`
  returns `{ order: 3, tokens, vocab, uni, bi, tri, starts }` (plain objects; ~2 ms for
  2,000 words). Sentence starts are tracked separately.
- **Coverage**: `coverage(model, question)` → `{ known, total, knownWords, unknownWords }`
  over the question's content words (stopwords removed). Shown under every answer:
  *"Recognised 1 of 7 words in your question."* This is the "why it's wrong" tell.
- **Generation**: `generate(model, question, { seed, maxWords: 40 })`:
  1. Seed context from the question: prefer a bigram of two adjacent question words
     that exists in the model; else the rarest known question word (most informative);
     else a random sentence start. Record `seededFrom: "question" | "random"`.
  2. Sample next word from `tri[w1 w2]`, else `bi[w2]`, else `uni`, weighted by counts,
     with a seeded RNG (`mulberry32` from `src/ml/net.js`).
  3. Stop at the first sentence end after 8 words, or at `maxWords`; always end with a
     full stop. Produces 1–2 sentences.
  4. Deterministic: `seed = hash(question) + attempt`, so "Ask again" gives a new answer
     and the same question gives the same first answer on every phone.
- **Behavioural guarantee (tested)**: a biology question to the history model returns a
  non-empty answer composed only of history-vocabulary words, with `known/total` low.
- **Starter texts** (`src/lm/texts/`): original prose written for this project, simple
  English, complete sentences, no quotations from other works:
  - `history` (~2,000 words): Indus Valley, Vedic period, Maurya, Gandhara, Arab arrival
    in Sindh, Delhi Sultanate, Mughals (Babur→Aurangzeb), Sikh rule, British East India
    Company, 1857, reform movements, All-India Muslim League, Lahore Resolution, 1947.
  - `biology` (~700): cells, organs, blood, digestion, plants, DNA basics.
  - `cricket` (~700): rules, roles, famous formats, how a match unfolds.
  - `cooking` (~700): biryani, roti, chai, spices, kitchen basics.
  - `space` (~700): planets, the Moon, stars, rockets, astronauts.
  - `folktales` (~700): retold original short tales (a clever crow, a river, a market).
  Each exports `{ id, title, emoji, words, text }`.

## 5. Part 1 · HistoryBot (screen `Chat`)

- Header: "HistoryBot has read one thing in its life: 2,000 words about South Asian
  history. Ask it anything."
- Flow per question: pick a topic chip (History · Science · Sport · Maths · Everyday ·
  Other) → type question (≤ 120 chars) → **Ask** → answer bubble + coverage line →
  vote **Right / Wrong / Nonsense** (required before next ask; one vote per answer —
  "Ask again" produces a new answer with its own vote). Verdict writes `votes/{id}`.
- My history of Q&A on the phone (session only).
- **"Show me everything it has ever read"**: expands the full history text; words from
  the last question that the bot recognised are highlighted.
- Teacher can use the same screen (votes not recorded for teacher).

## 6. Scoreboard (screen `Scoreboard`, projector)

- Per-topic bars: % Right, with counts. Fixed topic order (History first) so bars don't jump on the projector.
- Headline: "It answered N questions. It was right about X% of history and Y% of
  everything else."
- Feed: latest 8 Q&As (question, answer, topic, verdict, coverage) — refreshes live.
- The reveal question: "It never once said 'I don't know'. Why not?"
- In phase `exam` and later, the **Cross-examination leaderboard** appears below (see §8).
- Needs ≥ 10 votes before bars show (else "waiting for questions").

## 7. Part 2 · Train your bot (screen `TrainBot`, teams)

- Team picks any combination of starter texts (checkbox cards with title, emoji, word
  count) and/or pastes own text (textarea, ≤ 6,000 chars, live counter). Combined text
  must be ≥ 150 words to train and ≤ 50,000 chars (all six starters plus own text) to send.
- **Train** builds the model locally (instant) and shows: vocabulary size, word count,
  and a "try it" chat (no voting) so the team can test.
- **Send my bot to the class** writes `bots/{teamId}: { text, sources[], sentBy, at }`.
  Only text is stored; every phone rebuilds the model from it. Re-sending replaces.
- Teacher can train/test but not send (no team), same as Teach.
- Lobby lock (can't switch team) applies once `bots/{teamId}` exists, same as models.

## 8. Cross-examination (screen `Exam`) and leaderboard

- Pick a team's bot (cards; own team's bot marked). Same ask → answer → coverage → vote
  flow; topic chip required. Vote writes `botVotes/{id}: { uid, askerTeamId, botTeamId,
  topic, verdict, q, at }`.
- Leaderboard (`src/lm/scoring.js`): per bot, `% right` over votes where
  `askerTeamId !== botTeamId` (own-team votes excluded, shown separately as "own"),
  `n` foreign votes; sorted by foreign % desc; Nonsense counts as Wrong. Needs ≥ 3
  foreign votes per bot before a % shows.
- Header: "Every bot is now questioned by strangers. Which one survived?"
- One round only.

## 9. Data model additions (RTDB, under `rooms/{CODE}`)

```
meta.activity:   1 | 2 (absent = 1)
meta.phase:      activity 1 set ∪ { chat, reveal, train, exam }   (lobby shared)
votes/{id}:      { uid, topic, verdict, q (≤120), a (≤240), known, total, at }
bots/{teamId}:   { text (≤50000), sources: [ids], sentBy, at }
botVotes/{id}:   { uid, askerTeamId | null, botTeamId, topic, verdict, q (≤120), at }
```
`topic` ∈ {history, science, sport, maths, everyday, other}; `verdict` ∈ {right, wrong,
nonsense}. Subscriptions: `votes` only while Chat/Scoreboard mounted; `bots` and
`botVotes` only while TrainBot/Exam/Scoreboard mounted.

## 10. Security rules additions

- `meta.activity`: number 1 or 2. `meta.phase`: extended enum.
- `votes/$id`, `botVotes/$id`: create-only by any authed user (`!data.exists()`),
  `uid === auth.uid`, string/enum/length validation; delete by teacher only (cascade).
- `bots/$teamId`: write by a member whose `teamId === $teamId` or the teacher; `text`
  string 1–50,000 chars (the stored, combined text — own pasted text is separately capped
  at 6,000 chars client-side); `sources` list of known ids (validated as strings).
- Reset board (activity 2): teacher multi-path update `votes: null, bots: null,
  botVotes: null, meta/phase: "chat"`.
- Emulator tests for each.

## 11. Screens and files

```
src/lm/tokenize.js         tokenize, detokenize, STOPWORDS, contentWords
src/lm/ngram.js            trainModel, coverage, generate, hashString
src/lm/scoring.js          topicAccuracy(votes), botLeaderboard(botVotes, teams, bots)
src/lm/texts/index.js      STARTER_TEXTS (6), HISTORY_TEXT, getText(id)
src/lm/texts/*.js          the six texts
src/rooms/phases.js        PHASES_BY_ACTIVITY, TABS_BY_ACTIVITY, PHASE_ACTIONS_BY_ACTIVITY,
                           visibleTabs(role, phase, activity), nextPhase(phase, activity)
src/rooms/api.js           createRoom({activity}), castVote, sendBot, castBotVote,
                           resetBoard(activity-aware), TOPICS, VERDICTS
src/rooms/hooks.js         useVotes, useBots, useBotVotes, useTeamBot
src/components/BotChat.jsx shared chat: topic chips, input, answer + coverage, vote row
src/components/Corpus.jsx  "everything it has read" panel with highlights
src/screens/ActivityPick.jsx   choose activity
src/screens/Chat.jsx, Scoreboard.jsx, TrainBot.jsx, Exam.jsx
src/screens/Room.jsx       activity-aware tab set; Settings hides labels for activity 2
scripts/simulate.mjs       --activity 2 path: bots ask topic-tagged questions, vote by a
                           heuristic, train team bots from starter texts, cross-examine
```

## 12. Copy that must appear verbatim

- Chat header: "HistoryBot has read one thing in its life: 2,000 words about South Asian
  history. Ask it anything."
- Coverage line: "Recognised {known} of {total} words in your question."
- Scoreboard question: "It never once said 'I don't know'. Why not?"
- Corpus button: "Show me everything it has ever read"
- Exam header: "Every bot is now questioned by strangers. Which one survived?"

## 13. Testing

- Unit: tokenizer round trips; `trainModel` counts on a toy corpus; `coverage` with
  stopwords; `generate` determinism, sentence ending, vocabulary-only output, seeded
  from question when possible; history-model-answers-biology test; `topicAccuracy`
  and `botLeaderboard` math (own votes excluded, nonsense = wrong, min-n gating);
  phases per activity; screens: ActivityPick, BotChat (vote required before next ask),
  Scoreboard gating, Exam leaderboard rendering.
- Rules: emulator tests for votes/bots/botVotes/meta.activity/phase enum/reset.
- Bots: `npm run simulate -- --activity 2` full flow against live, cleanup.
- Manual: teacher + phone through both parts.

## 14. Out of scope

- Lesson 2 slide deck (separate task, same style as Lesson 1).
- Round 2 for activity 2; editing texts after sending; moderation of pasted text (teacher
  supervision); Urdu text.
