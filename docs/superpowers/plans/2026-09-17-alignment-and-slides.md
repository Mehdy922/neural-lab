# Alignment Fixes and Slide Decks — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every surface a teacher or student meets (app copy, run sheets, README, specs, slides) tell one coherent two-lesson story, then refresh the Lesson 1 deck (with two new slides the teacher asked for) and build the Lesson 2 deck in the same style.

**Architecture:** Task 1 is copy and small hint logic in the app plus README/spec edits; no data-model or rules change. Task 2 extends `scripts/screenshots.mjs` with an `--activity 2` path and re-shoots Activity 1 screenshots against a live bot-run room. Task 3 edits `slides/build.mjs` (Lesson 1 deck). Task 4 adds `slides/build-lesson2.mjs` (Lesson 2 deck) sharing the theme/helpers via a small `slides/lib.mjs` extracted in Task 3. Render checks use PowerPoint COM (`SaveCopyAs` to PNG) as in the first deck.

**Tech Stack:** React 19 plain JS, Vitest 5; pptxgenjs; Playwright (already a dev dependency) for screenshots; the simulator (`npm run simulate`) to produce live rooms. No new dependencies.

**Spec:** the 2026-09-17 fable alignment review (its findings are reproduced below as the requirements); `docs/superpowers/specs/2026-09-17-activity-2-talk-to-the-machine-design.md` and `docs/superpowers/specs/2026-09-11-neural-lab-classroom-design.md` remain binding for behaviour.

## Global Constraints

- Phase button labels stay single-sourced in `src/rooms/phases.js`; every surface that names a phase or button uses those exact words.
- Student-facing vocabulary: "machine" in Activity 1, "bot"/"HistoryBot" in Activity 2; no jargon (overfitting, generalisation, bias, token, trigram, stopword) on phones or the projector.
- Verbatim strings pinned by spec 2 §12 and tests stay exact, including "HistoryBot has read one thing in its life: 2,000 words about South Asian history. Ask it anything."
- Thesis lines, verbatim everywhere they appear: Lesson 1 "A machine only knows what it was shown." · Lesson 2 "A language model only says what it has read, one word at a time, confidently, about anything."
- Deck style: same master, palette, fonts (Segoe UI Black + Calibri), pixel art and card helpers as `slides/build.mjs`; 16:9; speaker notes on every slide; nothing about how Activity 1/2 works appears before the STOP divider.
- Tests: `npx vitest run` pristine; `npm run build` OK. Commit per task; bodies end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

### Task 1: Alignment fixes (app copy, hints, README, specs, simulator)

**Files:**
- Modify: `src/screens/Settings.jsx`, `src/screens/Settings.test.jsx`, `src/screens/Lobby.jsx`, `src/screens/Lobby.test.jsx`, `src/screens/Teach.jsx` (+ its test if one asserts the heading), `src/screens/Chat.jsx`, `src/screens/Scoreboard.jsx`, `src/screens/Exam.jsx`, `src/screens/TrainBot.jsx`, `scripts/simulate.mjs`, `README.md`, `docs/superpowers/specs/2026-09-11-neural-lab-classroom-design.md`, `docs/superpowers/specs/2026-09-17-activity-2-talk-to-the-machine-design.md`

Read each file before editing; grep tests for any string you change (`grep -rn "<old text>" src`).

- [ ] **Step 1 — Settings run sheets and notes** (`Settings.jsx`):
  - `RUN_SHEET_2` "0:34" row → `"Projector: Scoreboard. Look at the strips: every bot has one bump. Where is it?"`; "Say this · Exam" paragraph: `Then, on the Scoreboard: "Look at the strips. Every bot has one bump. Where is the bump? That is what it read."` (keep "Where is the bump" — a test pins it).
  - `RUN_SHEET` (Activity 1): "0:00" row → `"Teams of four. Team name in. Projector: Lobby. No explaining."`; the "Send to the class…" row → `"Send to the class. Press Reveal tournament. Projector: Tournament."`; last row of BOTH sheets → `"Out. Settings → Close room, so nobody rejoins it next lesson."`. Interpolate team size: build both sheets inside the component (or a function `runSheet(activity, teamCap)`) so "Teams of four" reads `Teams of ${teamCap}.` with `teamCap = meta?.teamCap ?? 4` spelled as a numeral.
  - Activity 1 notes: after the "Round 2, if the class is hooked" section add `<h2 …>Wrap</h2><p style={S.notesP}>Say it once, word for word: "A machine only knows what it was shown. Yours was shown ten drawings by four people."</p>`.
  - Activity 1 reset confirm → `"Wipe every sent machine, challenge and round score and go back to round 1 of Teach it? Teams stay."`.
  - Activity 2 notes: merge the duplicated "The reveal" section into "Say this · Reveal" (delete the standalone "The reveal" heading + paragraph; the Settings test asserts the heading "The reveal" — update that assertion to the "Before you start" heading instead).
- [ ] **Step 2 — Lobby phase-aware hints** (`Lobby.jsx`, `Lobby.test.jsx`): when `meta.phase !== "lobby"`: teacher hint drops the "Press … above" sentence; student "Wait for your teacher to start, or switch teams below." → `Your teacher has started — open **{nextTab}** above.` where `nextTab = TABS_BY_ACTIVITY[activity][1].label` ("Teach it" / "HistoryBot"). Locked hint → append ` Ask your teacher if you need to move.`. Lobby receives `meta` already? If not, pass `phase` from Room via the shared props (Room passes `meta`; use `meta?.phase`). Tests: existing "Start chatting" test keeps passing for phase lobby; add one: phase "chat", activity 2, student → text contains "open HistoryBot".
- [ ] **Step 3 — Teach heading and label** (`Teach.jsx`): `Draw 4–6 of each` → `Draw 5 of each (4 at least)`; `Your training set` → `Your examples`. Update any test asserting the old strings.
- [ ] **Step 4 — Activity 2 copy**: `Chat.jsx` stats line → `about 2,000 words · {vocab} different words. That is its whole mind.` (drop the exact word count); `Scoreboard.jsx` feed verdict → the VERDICTS label (`👍 Right`), strip hint → `Each strip shows how often it was right, topic by topic, in this order: …`; `Exam.jsx` own-bot hint → `Votes on your own bot don't count on the leaderboard.`; `TrainBot.jsx` heading → `🧪 Train your bot`. Grep tests for the old strings and update.
- [ ] **Step 5 — Simulator**: `scripts/simulate.mjs` room line prints the activity title for activity 2 (`room CODE · Talk to the machine · …`) instead of the label pair; activity-1 line unchanged.
- [ ] **Step 6 — README**: opening paragraph → "Two 40-minute lessons on what a machine really learns. Lesson 1 · Teach the machine: teams draw two things, train a tiny neural network, and watch their ~100% collapse on other teams' drawings. Lesson 2 · Talk to the machine: everyone questions HistoryBot, a bot that has read one 2,000-word text, votes on its answers, then trains and cross-examines bots of their own. Both run in the browser on phones; the teacher projects one tab." Rename `## Running a lesson` → `## Running Lesson 1 · Teach the machine`; promote the Activity 2 subsection to `## Running Lesson 2 · Talk to the machine`; add the sentence "A lesson is a slide deck plus an activity in the app." Student step → "Students: scan the QR (it skips straight to the join form) or open the URL → any activity card → **Student** → code + name. The room decides the activity, not the student's pick." Teacher first-deploy step → "open the live URL → choose the activity → **Teacher** → Create room". Add under Lesson 1 step 3: "Settings → Move a student if someone is stuck in a team." Add ops lines: hide/highlight act on the projector device; one phone sends per team, re-send replaces; Reset board per activity (Lesson 1: machines, challenges, rounds → round 1; Lesson 2: questions, votes, bots → chat); Close room at the end. Starter texts by title: "The living body, Cricket, In the kitchen, Space, Folk tales, South Asian history". Layout section lists ActivityPick, Chat, Scoreboard, TrainBot, Exam and `src/lm/` (tokenizer, trigram model, texts, projector filter). "Bendy Fence" → "Bendy fence".
- [ ] **Step 7 — Specs**: spec 1: add a dated `## Amendments (2026-09-17)` section listing: first screen is the activity chooser; phase controls live in the PhaseBar; button "Open bendy fence"; Reset also resets `round` to 1 and clears `rounds`; rounds (`meta.round`, `rounds/{n}`, "Next round") and `maxTeams` exist; hooks live in `hooks.js`; status "shipped". Spec 2 §11: `hashString` lives in `tokenize.js`.
- [ ] **Step 8 — Verify and commit**: `npx vitest run` (pristine), `npm run build`. Commit: "Align copy, hints, README and specs across both lessons".

---

### Task 2: Screenshots for both decks

**Files:**
- Modify: `scripts/screenshots.mjs` (add `--activity 2`), `slides/img/*` (re-shoot Activity 1: `teach-drawing.png`, `teach-trained.png`, `tournament-projector.png`, `tournament-projector-r1.png`, `lobby.png`; new Activity 2: `a2-chat-phone.png` (HistoryBot with one voted answer + coverage line), `a2-trainbot-phone.png`, `a2-scoreboard.png` (revealed: headline, bars, Nonsense of the day), `a2-corpus.png` (corpus open with highlights), `a2-exam-strips.png` (Scoreboard exam block with strips), `a2-lobby.png`).

- [ ] **Step 1**: read `scripts/screenshots.mjs` and the Activity 2 screens' accessible names (`aria-label`s, tab labels "HistoryBot", "Scoreboard", "Train your bot", "Cross-examine"). Add an `--activity 2` branch: phone context (390×844, scale 2) joins the room as a student, joins a team with space, opens HistoryBot, picks topic History, asks "Who built the Taj Mahal?", waits for the answer (typing pause ≤ 700 ms), votes Right, screenshots; opens Train your bot, ticks "Cricket", trains, screenshots. Desktop context (1280×800, scale 2) joins as "Projector", opens Scoreboard (room must already be in `exam` phase with ≥ 10 votes so the reveal shows) → screenshot; clicks "Show me everything it has ever read" → screenshot (scroll so the corpus is in frame; the projector breakout applies only to the teacher, so for the student-projector shot the scroll box is fine — note this in the slide caption); scrolls to the Cross-examination block → screenshot; Lobby tab → screenshot.
- [ ] **Step 2**: produce live rooms: `npm run simulate -- --activity 2 --students 12 --max-teams 4 --hold 900` (log to a file; read the room code from it) then `node scripts/screenshots.mjs --activity 2 --room CODE`; and `npm run simulate -- --students 8 --max-teams 2 --rounds 2 --hold 900` for Activity 1 re-shoots with the existing path. Both simulators clean up after the hold. Check every PNG opens (dimensions via a quick node/PowerShell probe) and looks right (Read the images).
- [ ] **Step 3**: commit the script + images: "Screenshot both activities for the lesson decks".

---

### Task 3: Lesson 1 deck refresh (+ two new slides)

**Files:**
- Create: `slides/lib.mjs` (theme, master, helpers extracted verbatim from `build.mjs`: `C`, `DISP`, `SANS`, `W/H/M`, `makePptx()`, `slide`, `title`, `sub`, `card`, `badge`, `body`, `big`, `bullets`, `pixelArt`, `art`, `img`, `arrow`).
- Modify: `slides/build.mjs` (imports from lib; slide edits below), output `slides/Neural-Lab-Lesson.pptx`.

- [ ] **Step 1 — Extract `slides/lib.mjs`**; `build.mjs` output must be identical before any content change (render check after extraction).
- [ ] **Step 2 — New slide 2 "What is this?"** (before "Which one is the mango?"): a large apple drawn with shapes (red ellipse body with a slight dent at the top made of two overlapping ellipses, brown rounded-rect stem, green leaf ellipse rotated ~30°), centred; heading "What is this?"; no other text. Notes: "1 min. Say nothing else. Wait for the shout: apple. Then: how did you know? You have never seen this exact drawing. Hold the answer — the next slide makes it bigger."
- [ ] **Step 3 — New slide before "Inside the machine": "Where the idea came from."** Left card: a biological neuron drawn with shapes — cell body (ellipse), 4–5 dendrites (short lines fanning in), one long axon (line) ending in three small terminal circles; labels "signals in" / "cell body" / "signal out". Right card: the artificial version — three input circles → one circle → one output circle, labels "numbers in" / "add them up, weighted" / "a number out". Sub-line: "Your brain has about 86 billion of these. Each one takes many signals in and sends one out. In 1943 two scientists copied that idea as maths. That copy is what we build today." Notes: "3 min. This is why it is called a neural network: it borrows the shape of a brain cell, not the brain. One neuron does almost nothing. Millions wired together learn. Keep it to the shape; don't do biology."
- [ ] **Step 4 — Slide 1**: badge "LESSON 1 · TEACH THE MACHINE" top-left under the title bar.
- [ ] **Step 5 — Slide "Join now."**: sub-line → "Scan the QR, or open the link → **1 · Teach the machine** → **Student** → code → your name → make or join a team."; notes: "Rejoin room CODE, or choose 1 · Teach the machine → Teacher"; add `lobby.png` on the right (`img`).
- [ ] **Step 6 — Slide 9 caption** "3 · your training set + score" → "3 · your examples + score" (matches the re-shot screenshot).
- [ ] **Step 7 — Appendix A1** (the reveal slide): add badge "A MACHINE ONLY KNOWS WHAT IT WAS SHOWN" (sun) under the title; A4 (exit) keeps its content.
- [ ] **Step 8 — Render check**: `npm run slides`; then PowerShell COM: `$app = New-Object -ComObject PowerPoint.Application; $p = $app.Presentations.Open("<abs path>", $true, $false, $false); $p.SaveCopyAs("<abs dir slides/render>", 18); $p.Close(); $app.Quit()` — Read the PNGs for the changed slides (1, 2, the neuron slide, Join now, A1) and fix any overflow. Commit: "Refresh the Lesson 1 deck: apple hook, neuron origin slide, join flow, thesis badge".

---

### Task 4: Lesson 2 deck

**Files:**
- Create: `slides/build-lesson2.mjs` → `slides/Neural-Lab-Lesson-2.pptx`; `package.json` script `"slides:2": "node slides/build-lesson2.mjs"`; README slides section mentions both decks.

Beats (one slide each unless noted; all notes are speaker notes; screenshots from Task 2):
1. Title — badge "LESSON 2 · TALK TO THE MACHINE"; headline "Last time it saw. This time it talks."; sub "A machine only knows what it was shown." Notes: recap line + energy.
2. Recap — `tournament-projector.png`; "Same machines, different pencils." Notes: ask what they remember; do not explain further.
3. Briefing — Chat script verbatim: "There is a bot on your phone. It has read exactly one thing in its life. Ask it anything. Tag the topic, read the answer, then tell me: right, wrong, or nonsense. Be honest — this is a report on it, not a vote for it." + mission card text "Find one answer it gets right, one it gets wrong, and one that is pure nonsense. Then try to trick it." + three verdict badges 👍 Right · 👎 Wrong · 🤪 Nonsense.
4. Join now — `a2-lobby.png`; "Scan the QR, or open the link → 2 · Talk to the machine → Student → code → your name → team." Notes: "Projector: Lobby now; switch to Scoreboard once you press Start chatting — only the feed shows."
5. STOP divider (dark, like Lesson 1's) — "Do not go past this until the scoreboard is revealed."
6. What just happened — `a2-scoreboard.png`; the headline pattern "{N} answers were judged. It was right about {X} of history and {Y} of everything else."; "It never once said 'I don't know'. Why not?" Notes: take three answers, agree with none.
7. This is its whole mind — `a2-corpus.png`; coverage lines "Recognised 1 of 7 words in your question." and "It recognised none of your words. It answered anyway." Notes: "Find the sentence yours came from."
8. How it works — three cards: READ (count which word follows which) → PICK (the most likely next word) → REPEAT (one word at a time, until a full stop); bottom: "Very sure and still wrong — remember slide 8 last time?" Notes: only now say "next word"; no "token", no "trigram".
9. Nonsense of the day — `a2-scoreboard.png` cropped/zoomed or a card mock with the kicker "Nonsense of the day"; "It answered anyway. That is not lying. It has nothing else to say."
10. Part 2 briefing — `a2-trainbot-phone.png`; "Tick what it reads — that is everything it will ever know."; "One phone per team sends. Agree first."; "Ask it about its topic, then about something else."
11. Cross-examination debrief — `a2-exam-strips.png`; "Every bot has one bump. Where is it? That is what it read." Own team / Strangers echo.
12. The big ones + exit — wrap verbatim: "A language model only says what it has read, one word at a time, confidently, about anything. The big ones have read millions of times more, so the mistakes are rarer and harder to spot. What did it read, and who chose that?" Exit ticket: "Name one thing you asked a chatbot this month. What might it have read to answer? Who chose that?"

- [ ] **Step 1**: write `build-lesson2.mjs` using `slides/lib.mjs`; `npm run slides:2`.
- [ ] **Step 2**: render check via PowerPoint COM into `slides/render-2/`; Read every slide PNG; fix overflow/wrapping; fonts must be Segoe UI Black / Calibri only.
- [ ] **Step 3**: README slides section: both decks, both build commands, screenshot commands for both activities. Commit: "Add the Lesson 2 deck".

---

### Task 5: Verify and ship (controller)

- [ ] `npx vitest run`, `npm run test:rules`, `npm run build`; merge to `main`, push (deploy); confirm live copy ("Draw 5 of each", "Your examples") in the bundle; both `.pptx` files present on `main`.
