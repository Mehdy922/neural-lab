# Neural Lab

Two 40-minute lessons on what a machine really learns. Lesson 1 · Teach the machine: teams draw two things, train a tiny neural network, and watch their ~100% collapse on other teams' drawings. Lesson 2 · Talk to the machine: everyone questions HistoryBot, a bot that has read one 2,000-word text, votes on its answers, then trains and cross-examines bots of their own. Both run in the browser on phones; the teacher projects one tab.

A lesson is a slide deck plus an activity in the app. The decks are in `slides/` (see **The lesson slides**
below); the activities are in the app, one room per class, and run as described under **Running Lesson 1**
and **Running Lesson 2**.

Live: https://mehdy922.github.io/neural-lab/

## One-time setup (teacher, ~5 minutes)

1. Go to https://console.firebase.google.com → **Add project** → any name → turn Google Analytics **off** → Create.
2. Left menu **Build → Authentication → Get started → Sign-in method → Anonymous → Enable → Save**.
3. **Build → Realtime Database → Create database** → pick a location → **Start in locked mode** → Enable.
   Then open the **Data** tab and copy the database URL shown at the top (it looks like
   https://…-default-rtdb.firebaseio.com or https://…-default-rtdb.<region>.firebasedatabase.app).
   You'll need it in step 6.
4. **Rules** tab → replace everything with the contents of `database.rules.json` → **Publish**.
5. Project settings (gear icon) → **General → Your apps → Web (</>)** → nickname anything → Register → copy the `firebaseConfig` values.
6. Use the URL copied in step 3 for `databaseURL`; the other four values (`apiKey`, `authDomain`,
   `projectId`, `appId`) come from the web-app config in step 5.
   Easiest: on GitHub open `src/firebaseConfig.js` → pencil icon (Edit) → replace the `PASTE_…`
   values → Commit changes directly to `main` (or clone the repo, edit locally, commit and push).
   GitHub Actions rebuilds and deploys automatically (Actions tab shows progress).
7. Firebase console → Authentication → Settings → Authorized domains → Add domain →
   `mehdy922.github.io`.
8. GitHub → repo Settings → Pages → Source: GitHub Actions. (Already done for this repo;
   needed for forks or re-dos.)

Everything runs on Firebase's free Spark plan. No card needed. Limits: 100 simultaneous
connections, 1 GB stored, 10 GB/month download — plenty for a class.

Troubleshooting:
- Page says "Could not sign in" with `auth/admin-restricted-operation` or `auth/operation-not-allowed` → step 2 (Anonymous) is not enabled.
- `auth/unauthorized-domain` → see step 7 (Authorized domains).
- Students see "permission denied" toasts → step 4 (rules) not published, or published to a different database.

## Running Lesson 1 · Teach the machine

1. Open the live URL → choose **1 · Teach the machine** → **Teacher** → set the pair (default Mango vs Cricket ball; try Sun vs Flower), max students per team, and optionally a max number of teams (2–20; blank = no limit) → **Create room**. Teams don't need to be full: a team of 2 and a team of 4 both count. All of these can be changed later in **Settings**.
2. Put the Lobby on the projector: room code + QR.
3. Students: scan the QR (it skips straight to the join form) or open the URL → any activity card → **Student** → code + name. The room decides the activity, not the student's pick. Then they make a team or tap one to join it. If someone is stuck in a team: Lobby → move a student between teams.
4. Press **Start teaching**. Students draw 5 of each (4 at least), **Train**, test with **What is it?**, then **Send my machine to the class**.
5. Press **Reveal tournament**. Open the Tournament tab on the projector. Wait for the noise. If the class is hooked, **Next round**: teams add drawings, retrain and send again, and the next reveal shows each team's change.
6. Second period: **Open bendy fence**.

Teacher tips, run sheet, the read-aloud script and the one rule are in the **Settings** tab inside the room.

## Running Lesson 2 · Talk to the machine

1. On the first screen, choose **2 · Talk to the machine** → **Teacher** → **Create room** (no drawing pair this time; team size and max teams as in Lesson 1).
2. Students join and form teams exactly as in Lesson 1 — any activity card leads to the same join form; the room decides.
3. Press **Start chatting**. Students ask HistoryBot anything and vote Right / Wrong / Nonsense on its answer.
   They'll see: *"HistoryBot has read one thing in its life: 2,000 words about South Asian history. Ask it anything."*
   Put the Scoreboard tab on the projector now — until you reveal, it shows only the feed of latest questions and
   a running count.
4. Press **Reveal scoreboard**. The projector now shows the headline (right on history vs. everything else), the
   bars per topic, the reveal question (*"It never once said 'I don't know'. Why not?"*), **Nonsense of the day**,
   and then the **Show me everything it has ever read** button — the bot's whole training text on one screen, with
   the words it recognised from the highlighted question marked. Tap a feed item to change which question is
   highlighted; tap ✕ to hide one.
5. Press **Start training**. Each team picks a starter text (The living body, Cricket, In the kitchen, Space,
   Folk tales, South Asian history) and/or pastes its own for its bot, trains it, tries it, and sends it.
6. Press **Open cross-examination**. Every team now questions strangers' bots and votes on the answers.
   They'll see: *"Every bot is now questioned by strangers. Which one survived?"* The leaderboard ranks bots
   by how well they do on questions from OUTSIDE their own team; the Scoreboard on the projector adds a
   topic strip per bot — every bot has one bump, where its text was.

The Settings tab carries a run sheet and a read-aloud teacher script for every phase.

`npm run simulate -- --activity 2` runs this whole flow against bots for a dry run — see **Bot simulator** below.

Because this activity adds `votes`, `bots` and `botVotes` to `database.rules.json`, any already-deployed
project's live rules must be republished (setup step 4) before running Lesson 2 for real.

### Room controls (both lessons)

- One phone sends per team — the machine in Lesson 1, the bot in Lesson 2. Sending again replaces what the
  team sent; the Teach it / Train your bot tab says who sent the current one.
- Hiding a feed item (✕) and highlighting a question act on the device that is showing the projector, not
  on students' phones.
- **Settings → Reset board** is per activity and keeps the teams. Lesson 1: wipes the sent machines,
  challenges and round scores and goes back to round 1 of Teach it. Lesson 2: wipes the questions, votes and
  bots and goes back to chatting.
- **Settings → Close room** at the end, so nobody rejoins it next lesson.

## Bot simulator

`scripts/simulate.mjs` plays a full lesson against bots (one anonymous Firebase user per student, exactly
like a phone in class) so you can rehearse before class or sanity-check a change to the rules.

```bash
npm run simulate                                          # Activity 1, 9 students, 3 max teams
npm run simulate -- --students 12 --max-teams 4 --rounds 2 --keep
npm run simulate -- --activity 2 --students 10 --max-teams 4 --hold 300
```

- `--activity 2` runs "Talk to the machine" instead of the default "Teach the machine": create the room →
  students join and form teams → `chat` (every student asks HistoryBot 3 questions and votes, then the topic
  table prints) → `reveal` → `train` (each team trains a bot from a starter text and sends it) → `exam`
  (every student cross-examines two other teams' bots, then the leaderboard prints) → the three activity-2
  rule checks (phase write, another team's bot, editing a vote) → cleanup.
- `--students N` / `--max-teams M` control the class size and number of teams the same way for both activities.
- `--hold S` keeps the finished room open for S seconds (e.g. to look at it on a phone) before cleaning up;
  `--keep` leaves the room in the database instead of cleaning up at all.
- Rule checks expect writes to be DENIED and are skipped automatically when run against the local emulator
  (`FIREBASE_DATABASE_EMULATOR_HOST` set, or `--emulator`) — production sign-in tokens are admin there, so
  `npm run test:rules` is what actually exercises the rules.

## The lesson slides

Two decks, one per lesson, both generated from the app's palette and the screenshots in `slides/img/`, with
speaker notes and timings on every slide. They use fonts that ship with Windows and Office, so they open the
same on the school PC.

- `slides/Neural-Lab-Lesson.pptx` — Lesson 1, "How does a machine learn?", a 30–40 minute lesson for grades
  9–12 that runs *before* the activity. Slides 1–16 are the lesson and end by launching the activity; slides
  17–21 are the debrief, opening with a hold divider ("Appendix · use after the tournament — The debrief.") and
  shown only after the tournament reveal. Built with `npm run slides` from `slides/build.mjs`.
- `slides/Neural-Lab-Lesson-2.pptx` — Lesson 2, "Talk to the machine", 40 minutes. Slides 1–4 are the
  briefing (recap, the chat script, join); slide 5 is the STOP divider that holds while HistoryBot is being
  questioned; slides 6–9 are shown after the scoreboard is revealed (what happened, its whole 2,000-word mind
  on one screen, how it works, nonsense of the day); slide 10 briefs Part 2; slides 11–12 are the
  cross-examination debrief and the wrap with the exit ticket. Built with `npm run slides:2` from
  `slides/build-lesson2.mjs`.

Both build scripts share `slides/lib.mjs` (theme, slide master, drawing helpers). To refresh the screenshots,
run a simulated room, note the room code it prints, then capture while the room is still open:

```bash
npm run simulate -- --rounds 2 --hold 600                                 # an Activity 1 room
npm run screenshots -- --room CODE
npm run simulate -- --activity 2 --students 12 --max-teams 4 --hold 600   # an Activity 2 room
npm run screenshots -- --activity 2 --room CODE
```

## Development

```bash
npm install
npm run dev          # http://localhost:5173/neural-lab/
npm test             # unit tests (Vitest, jsdom)
npm run test:rules   # security rules against the Firebase emulator (needs Java)
npm run build
```

## After the first deploy

- Bookmark the room URL you create — the teacher role is tied to this browser (anonymous sign-in). Clearing site data or switching browsers means creating a new room.
- To re-use the app next term: open the live URL → choose the activity → **Teacher** → Create room. Old rooms stay in the database until you delete them in the Firebase console (Realtime Database → `rooms`).

## Layout

- `src/ml/` — the network, drawing capture (auto-crop + centre), cross-scoring
- `src/lm/` — tokenizer, trigram model, texts, projector filter
- `src/rooms/` — room codes, phases, RTDB API, live-state hooks
- `src/screens/` — ActivityPick, Landing, TeacherCreate, StudentJoin, Room, Lobby, Teach, Tournament, Fence, Chat, Scoreboard, TrainBot, Exam, Settings
- `database.rules.json` — who may write what
- `docs/superpowers/specs/` — design specs (one per lesson); `docs/prototype/` — original single-file prototype
