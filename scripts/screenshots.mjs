// Capture app screenshots for the slide decks by driving the LIVE site as a student.
//
//   node scripts/screenshots.mjs --room CODE [--team "Chai Wallahs"] [--out slides/img]
//   node scripts/screenshots.mjs --activity 2 --room CODE [--out slides/img]
//
// Activity 1 needs a room that is already in the "fence" phase with a team that has space
// (e.g. one produced by `npm run simulate -- --students 12 --max-teams 4 --rounds 2 --hold 600`).
// Produces: teach-drawing.png, teach-guess.png, teach-trained.png, lobby.png, tournament-phone.png, tournament-projector.png
//
// Activity 2 needs a room in the "exam" phase with ≥ 10 votes and a team that has space
// (e.g. `npm run simulate -- --activity 2 --students 12 --max-teams 4 --hold 600`).
// Produces: a2-chat-phone.png, a2-trainbot-phone.png, a2-scoreboard.png, a2-corpus.png, a2-exam-strips.png, a2-lobby.png

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { isProjectorSafe } from "../src/lm/projectorFilter.js";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > -1 ? process.argv[i + 1] : d; };
const ACTIVITY = Number(arg("activity", 1)) === 2 ? 2 : 1;
const CODE = arg("room");
const TEAM = arg("team", "Chai Wallahs");
const OUT = arg("out", "slides/img");
const PROJECTOR_FILE = arg("projector-file", "tournament-projector.png");
const PROJECTOR_ONLY = process.argv.includes("--projector-only");
const URL = `https://mehdy922.github.io/neural-lab/?room=${CODE}`;
if (!CODE) { console.error("--room CODE is required"); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const log = (s) => console.log(`▶ ${s}`);
const browser = await chromium.launch();

// Open the room and join as a student; resolves once the Lobby's team list is on screen.
async function joinRoom(pg, name) {
  await pg.goto(URL, { waitUntil: "networkidle" });
  await pg.getByLabel("Your name").fill(name);
  await pg.getByRole("button", { name: /Join/ }).click();
  await pg.getByRole("heading", { name: /Teams/ }).waitFor({ timeout: 20000 });
}
// boundingBox() is null for a detached or invisible element: fail loudly, naming the locator.
async function boxOf(locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`No bounding box for ${locator}`);
  return box;
}
// Full-width capture clipped to the card(s) at `locators` (their union, plus `pad` px above and below),
// so a shot holds exactly one card — or a span of cards — with no sliced neighbours. Cards sit 20 px apart
// with a 6 px hard shadow below, so 12 px keeps the shot card's shadow and stays clear of the one above.
async function shootBlock(pg, locators, path, pad = 12) {
  await pg.evaluate(() => window.scrollTo(0, 0));   // page coordinates == viewport coordinates for the boxes below
  await pg.waitForTimeout(200);
  const boxes = await Promise.all([locators].flat().map(boxOf));
  const y = Math.min(...boxes.map((b) => b.y)), bottom = Math.max(...boxes.map((b) => b.y + b.height));
  await pg.screenshot({ path, fullPage: true, clip: { x: 0, y: Math.max(0, y - pad), width: pg.viewportSize().width, height: bottom - y + 2 * pad } });
}

// ── activity 2: "Talk to the machine" ────────────────────────────────────
async function shootActivity2() {
  const QUESTION = "Who built the Taj Mahal?";
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await phone.newPage();
  log(`open ${URL}`);
  await joinRoom(page, "Aisha");
  log("joined the room");

  // Join the first team with space (a retry within the same --hold may have filled the usual one).
  const joinBtn = page.getByRole("button", { name: /^Join$/, disabled: false }).first();
  await joinBtn.waitFor({ timeout: 15000 });
  await joinBtn.click();
  const teamChip = page.getByText(/^Team .+/);
  await teamChip.waitFor({ timeout: 15000 });
  log(`joined ${await teamChip.textContent()}`);

  // HistoryBot: History topic, ask, wait out the typing pause, keep the answer if it is fit for a slide, vote Right.
  log("HistoryBot (phone)");
  await page.getByRole("tab", { name: /HistoryBot/ }).click();
  const topics = page.getByRole("group", { name: "Topic of your question" });
  await topics.waitFor({ timeout: 15000 });
  await topics.getByRole("button", { name: /History/ }).click();
  await page.getByRole("textbox", { name: "Your question" }).fill(QUESTION);
  const typing = page.getByText(/is typing/);
  const rightBtn = page.getByRole("button", { name: /Right/ });   // only the latest answer carries a vote row
  // The bot bubble is the vote row's parent. Its text reads "🤖 HistoryBot" / the answer / the coverage
  // line / the vote buttons — keep the answer line(s) only, whatever element the answer is wrapped in.
  const STOP = /^(Recognised \d+ of \d+ words|It recognised none of your words|👍|👎|🤪|↺)/;
  const awaitAnswer = async () => {
    await typing.waitFor({ timeout: 5000 });
    await typing.waitFor({ state: "detached", timeout: 5000 });
    await rightBtn.waitFor({ timeout: 5000 });
    const lines = (await rightBtn.locator("xpath=../..").innerText()).split("\n").map((s) => s.trim()).filter((l) => l && !/^🤖\s/.test(l));
    const end = lines.findIndex((l) => STOP.test(l));
    return lines.slice(0, end === -1 ? undefined : end).join(" ");
  };
  await page.getByRole("button", { name: /^Ask$/ }).click();
  let answer = await awaitAnswer();
  for (let tries = 0; tries < 2 && !(answer && isProjectorSafe(answer)); tries++) {
    log(`answer "${answer}" is not fit for a slide — asking again`);
    await page.getByRole("button", { name: /Ask again/ }).click();
    answer = await awaitAnswer();
  }
  if (!answer || !isProjectorSafe(answer)) throw new Error(`HistoryBot answer unusable after retries: ${JSON.stringify(answer)}`);
  log(`HistoryBot said: "${answer}"`);
  await rightBtn.click();
  await page.getByRole("button", { name: /Right/, disabled: true }).waitFor({ timeout: 5000 });
  await page.waitForTimeout(500);
  await page.locator(".nl-pop").waitFor({ state: "detached", timeout: 5000 });   // let the "Joined …!" toast go
  // The whole HistoryBot card: heading, mission, topic chips, question, answer, coverage line, vote.
  await shootBlock(page, page.getByRole("heading", { name: /HistoryBot/ }).locator("xpath=.."), `${OUT}/a2-chat-phone.png`);

  // Train your bot: tick Cricket, train, show the trained state.
  log("Train your bot (phone)");
  await page.getByRole("tab", { name: /Train your bot/ }).click();
  await page.getByRole("heading", { name: /Train your bot/ }).waitFor({ timeout: 15000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole("button", { name: /^Cricket/ }).click();
  await page.getByRole("button", { name: /Train my bot/ }).click();
  await page.getByPlaceholder("Test your bot…").waitFor({ timeout: 15000 });
  await page.waitForTimeout(400);
  // Both cards in one frame: heading and the ticked Cricket starter through the Train button, then the trained "Try it" card.
  await shootBlock(page, [
    page.getByRole("heading", { name: /Train your bot/ }).locator("xpath=.."),
    page.getByRole("heading", { name: "Try it" }).locator("xpath=.."),
  ], `${OUT}/a2-trainbot-phone.png`);
  await phone.close();

  // Projector: a student-role desktop window (the teacher's tabs need the bot-teacher's browser).
  const desk = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  const p2 = await desk.newPage();
  await joinRoom(p2, "Projector");

  log("Scoreboard (projector)");
  await p2.getByRole("tab", { name: /Scoreboard/ }).click();
  await p2.getByRole("table", { name: "Accuracy by topic" }).waitFor({ timeout: 20000 });
  const nonsense = p2.getByText("Nonsense of the day", { exact: true }).locator("xpath=..");   // the kicker's box
  await nonsense.waitFor({ timeout: 10000 });
  await p2.waitForTimeout(800);
  // Headline, bars and "Nonsense of the day" in one frame: clip taller than the viewport if they do not fit.
  const nb = await boxOf(nonsense);
  const bottom = Math.ceil(nb.y + nb.height + 16);
  if (bottom > 800) log(`scoreboard runs to ${bottom} px — clipping past the 800 px viewport`);
  await p2.screenshot({ path: `${OUT}/a2-scoreboard.png`, fullPage: bottom > 800, ...(bottom > 800 ? { clip: { x: 0, y: 0, width: 1280, height: bottom } } : {}) });

  log("corpus (projector)");
  await p2.getByRole("button", { name: "Show me everything it has ever read" }).click();
  const hideBtn = p2.getByRole("button", { name: "Hide what it has read" });
  const marks = p2.locator("mark");
  await marks.first().waitFor({ timeout: 10000 });
  // Scroll the corpus box to a highlight that visibly ties to the question ("Taj"/"Mahal"), not just to "built".
  const tied = marks.filter({ hasText: /taj|mahal/i });
  if ((await tied.count()) === 0) throw new Error(`corpus has ${await marks.count()} highlights but none for Taj/Mahal — is the latest vote still "${QUESTION}"?`);
  log(`${await marks.count()} highlighted words in the corpus, ${await tied.count()} of them Taj/Mahal`);
  await tied.first().scrollIntoViewIfNeeded();           // scrolls the 420 px corpus box
  await shootBlock(p2, hideBtn.locator("xpath=.."), `${OUT}/a2-corpus.png`);   // the corpus card only

  log("cross-examination strips (projector)");
  await hideBtn.click();
  await p2.getByRole("table", { name: "Bot leaderboard" }).waitFor({ timeout: 20000 });
  await shootBlock(p2, p2.getByRole("heading", { name: /Cross-examination/ }).locator("xpath=.."), `${OUT}/a2-exam-strips.png`);   // the block only

  log("lobby (projector)");
  await p2.getByRole("tab", { name: /Lobby/ }).click();
  await p2.getByRole("heading", { name: /Teams/ }).waitFor({ timeout: 15000 });
  await p2.evaluate(() => window.scrollTo(0, 0));
  await p2.waitForTimeout(600);
  await p2.screenshot({ path: `${OUT}/a2-lobby.png`, fullPage: false });
  await desk.close();
}

if (ACTIVITY === 2) {
  await shootActivity2();
  await browser.close();
  log(`done → ${OUT}/`);
  process.exit(0);
}

if (PROJECTOR_ONLY) {
  log("tournament (projector) only");
  const desk = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  const p2 = await desk.newPage();
  await p2.goto(URL, { waitUntil: "networkidle" });
  await p2.getByLabel("Your name").fill("Projector");
  await p2.getByRole("button", { name: /Join/ }).click();
  await p2.getByRole("tab", { name: /Tournament/ }).click();
  await p2.getByRole("table", { name: "Leaderboard" }).waitFor({ timeout: 20000 });
  await p2.waitForTimeout(800);
  await p2.screenshot({ path: `${OUT}/${PROJECTOR_FILE}`, fullPage: false });
  await browser.close();
  log(`done → ${OUT}/${PROJECTOR_FILE}`);
  process.exit(0);
}

const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await phone.newPage();

log(`open ${URL}`);
await joinRoom(page, "Aisha");
log("joined the room");

// Join a team with space.
const card = page.locator("div", { hasText: TEAM }).filter({ has: page.getByRole("button", { name: /^Join$/ }) }).last();
await card.getByRole("button", { name: /^Join$/ }).click();
await page.getByText(new RegExp(`Team ${TEAM}`)).waitFor({ timeout: 15000 });
log(`joined team ${TEAM}`);
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/lobby.png`, fullPage: false });

// Teach tab.
await page.getByRole("tab", { name: /Teach it/ }).click();
const canvas = page.locator('canvas[aria-label="Drawing canvas"]');
await canvas.waitFor();

async function stroke(points) {
  const box = await canvas.boundingBox();
  const P = points.map(([u, v]) => [box.x + u * box.width, box.y + v * box.height]);
  await page.mouse.move(P[0][0], P[0][1]);
  await page.mouse.down();
  for (const [x, y] of P.slice(1)) await page.mouse.move(x, y, { steps: 3 });
  await page.mouse.up();
}
const ellipse = (cx, cy, rx, ry, tilt = 0, n = 40) => Array.from({ length: n + 1 }, (_, i) => {
  const t = (i / n) * Math.PI * 2, x = rx * Math.cos(t), y = ry * Math.sin(t);
  return [cx + x * Math.cos(tilt) - y * Math.sin(tilt), cy + x * Math.sin(tilt) + y * Math.cos(tilt)];
});
async function drawMango(k) {
  await stroke(ellipse(0.5 + (k % 3) * 0.02, 0.52, 0.30 + k * 0.01, 0.23, -0.5 + k * 0.1));
  await stroke([[0.62, 0.30], [0.66, 0.20]]); // stem
}
async function drawBall(k) {
  await stroke(ellipse(0.5, 0.5, 0.27 + k * 0.01, 0.27 + k * 0.01));
  await stroke([[0.5, 0.24], [0.5, 0.76]]); // seam
  for (const y of [0.34, 0.44, 0.54, 0.64]) await stroke([[0.46, y], [0.54, y + 0.02]]);
}
const add = () => page.getByRole("button", { name: "Add this drawing" }).click();
const pick = (label) => page.getByRole("button", { name: new RegExp(`^${label}`) }).first().click();

log("drawing 5 mangoes and 5 cricket balls");
await pick("Mango");
for (let k = 0; k < 5; k++) { await drawMango(k); await add(); }
await pick("Cricket ball");
for (let k = 0; k < 5; k++) { await drawBall(k); await add(); }
await pick("Mango");
await drawMango(1); // leave one on the canvas for the shot
await page.waitForTimeout(400);
const drawCard = page.locator("main > section", { hasText: "Add this drawing" });
const setCard = page.locator("main > section", { hasText: "Your examples" });
await page.screenshot({ path: `${OUT}/teach-full.png`, fullPage: true });
await drawCard.screenshot({ path: `${OUT}/teach-drawing.png` });

log("training");
await page.getByRole("button", { name: /Train it/ }).click();
await page.getByText(/correct on your own drawings/).waitFor({ timeout: 30000 });
await page.getByRole("button", { name: /What is it/ }).click();
await page.getByText(/sure$/).waitFor({ timeout: 10000 });
await page.waitForTimeout(400);
await drawCard.screenshot({ path: `${OUT}/teach-guess.png` });
await setCard.screenshot({ path: `${OUT}/teach-trained.png` });

log("tournament (phone)");
await page.getByRole("tab", { name: /Tournament/ }).click();
await page.getByRole("table", { name: "Leaderboard" }).waitFor({ timeout: 20000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/tournament-phone.png`, fullPage: true });
await phone.close();

log("tournament (projector)");
const desk = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
const p2 = await desk.newPage();
await p2.goto(URL, { waitUntil: "networkidle" });
await p2.getByLabel("Your name").fill("Projector");
await p2.getByRole("button", { name: /Join/ }).click();
await p2.getByRole("tab", { name: /Tournament/ }).click();
await p2.getByRole("table", { name: "Leaderboard" }).waitFor({ timeout: 20000 });
await p2.waitForTimeout(800);
await p2.screenshot({ path: `${OUT}/${PROJECTOR_FILE}`, fullPage: false });
await desk.close();
await browser.close();
log(`done → ${OUT}/`);
