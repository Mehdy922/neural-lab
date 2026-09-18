// Builds slides/Neural-Lab-Lesson-2.pptx — the 40 minute lesson "Talk to the machine". Four briefing
// slides run BEFORE the chat, a STOP divider holds the deck while HistoryBot is being questioned, and
// the rest is shown only after the scoreboard is revealed. Same theme and helpers as the Lesson 1 deck.
//
//   npm run slides:2        (expects screenshots in slides/img/ — see scripts/screenshots.mjs)

import history from "../src/lm/texts/history.js";
import { C, DISP, SANS, W, H, M, makePptx, title, sub, card, badge, body, pixelArt, art, img, arrow } from "./lib.mjs";

const { pptx, slide } = makePptx({ title: "Talk to the machine" });

// A rounded pill with larger text than badge(); used for the three verdicts and the echo row.
const pill = (s, text, x, y, w, fill, color, h = 0.42, fontSize = 13) =>
  s.addText(text, { x, y, w, h, fontFace: SANS, fontSize, bold: true, color, align: "center", valign: "middle",
    fill: { color: fill }, line: { color: fill, width: 0 }, shape: pptx.ShapeType.roundRect, rectRadius: 0.21 });
const kicker = (s, text, x, y, w, color = C.mangoDeep) =>
  s.addText(text, { x, y, w, h: 0.3, fontFace: SANS, fontSize: 10, bold: true, color, charSpacing: 1 });

// ═════════════════════════════════════════════════════════════════════════
// 1 · Title
{
  const s = slide("1 min for this slide and the next. Recap in one line: last time your machine scored 100% on your own drawings and dropped on everyone else's, because a machine only knows what it was shown. Today the machine talks instead of looking, and the same thing is going to happen. Keep the energy up; the payoff is the moment the scoreboard is revealed.");
  badge(s, "LESSON 2 · TALK TO THE MACHINE", M, 0.5, C.sun, C.ink, 3.1);
  badge(s, "GRADES 9–12 · 40 MIN", M + 3.25, 0.5, C.paper, C.muted, 2.2);
  s.addText("Last time it saw.\nThis time it talks.", { x: M, y: 1.0, w: 6.2, h: 1.6, fontFace: DISP, fontSize: 42, bold: true, color: C.ink, valign: "middle" });
  s.addText("A machine only knows what it was shown.", { x: M, y: 2.65, w: 6, h: 0.8, fontFace: SANS, fontSize: 18, color: C.muted });
  badge(s, "PART 1 · HISTORYBOT", M, 3.7, C.mango, C.paper, 2.2);
  badge(s, "PART 2 · TRAIN YOUR BOT", M + 2.35, 3.7, C.sky, C.paper, 2.4);
  // What it saw last time, and a speech bubble for what it does this time.
  pixelArt(s, art(0, 0, 11), 7.0, 1.0, 1.1, C.mangoDeep);
  pixelArt(s, art(1, 1, 12), 8.4, 1.0, 1.1, C.skyDeep);
  s.addText("Ask it anything.", { x: 7.0, y: 2.5, w: 2.5, h: 0.9, fontFace: DISP, fontSize: 16, bold: true, color: C.paper, align: "center", valign: "middle",
    fill: { color: C.sky }, line: { color: C.skyDeep, width: 1.5 }, shape: pptx.ShapeType.wedgeRoundRectCallout });
}

// 2 · Recap
{
  const s = slide("Part of the same minute. Ask what they remember from last time. Let them say it: 100% on their own drawings, then the drop on everyone else's, because it had only ever seen their pencils. Do not explain further. This lesson makes the same point with words instead of drawings, and it only lands if they get there themselves.");
  title(s, "Same machines, different pencils.");
  sub(s, "What do you remember?", 1.15);
  const h = 3.2, w = h * (2560 / 1600);   // tournament-projector-r1.png is 2560×1600
  img(s, "tournament-projector-r1.png", (W - w) / 2, 1.7, w, h);
}

// 3 · Briefing
{
  const s = slide("2 min. Read the script on the left aloud, slowly. It is the whole briefing. Then the mission. Each verdict is a report on the bot, not a vote for it; say that twice. Do not explain how the bot works or why it might be wrong. They find that out themselves in the next ten minutes.");
  title(s, "The briefing.");
  card(s, M, 1.35, 5.3, 3.4);
  body(s, "“There is a bot on your phone. It has read exactly one thing in its life. Ask it anything. Tag the topic, read the answer, then tell me: right, wrong, or nonsense. Be honest — this is a report on it, not a vote for it.”", M + 0.3, 1.6, 4.7, 3.0, { fontSize: 20 });
  card(s, 6.1, 1.35, 3.4, 1.95, C.soft);
  kicker(s, "YOUR MISSION", 6.3, 1.45, 3.0);
  body(s, "Find one answer it gets right, one it gets wrong, and one that is pure nonsense. Then try to trick it.", 6.3, 1.75, 3.0, 1.5, { fontSize: 14.5 });
  pill(s, "👍 Right", 6.1, 3.45, 3.4, C.sun, C.ink);
  pill(s, "👎 Wrong", 6.1, 3.97, 3.4, C.paper, C.ink);
  pill(s, "🤪 Nonsense", 6.1, 4.49, 3.4, C.paper, C.ink);
}

// 4 · Join now
{
  const s = slide("Projector: Lobby now; switch to Scoreboard once you press Start chatting — only the feed shows.");
  title(s, "Join now.");
  const cw = 5.5;
  card(s, M, 1.4, cw, 2.45);
  s.addText("mehdy922.github.io/neural-lab", { x: M, y: 1.58, w: cw, h: 0.6, fontFace: SANS, fontSize: 20, bold: true, color: C.skyDeep, align: "center" });
  s.addText("ROOM CODE", { x: M, y: 2.2, w: cw, h: 0.4, fontFace: SANS, fontSize: 12, bold: true, color: C.muted, align: "center" });
  s.addText("— on the projector —", { x: M, y: 2.6, w: cw, h: 1.0, fontFace: DISP, fontSize: 28, bold: true, color: C.ink, align: "center", valign: "middle" });
  const iw = 3.3, ih = iw / (2560 / 1600);   // a2-lobby.png is 2560×1600
  img(s, "a2-lobby.png", 6.2, 1.4, iw, ih);
  body(s, "the Lobby's team list, as students see it", 6.2, 1.4 + ih + 0.08, iw, 0.3, { fontSize: 11, color: C.muted, align: "center" });
  sub(s, [
    { text: "Scan the QR, or open the link → " },
    { text: "Activity 2 · Talk to the machine", options: { bold: true } },
    { text: " → " },
    { text: "Student", options: { bold: true } },
    { text: " → code → your name → team." },
  ], 4.05, { h: 0.9, align: "center", fontSize: 14 });
}

// ── STOP: HistoryBot is being questioned ─────────────────────────────────
{
  const s = slide("About 8 min of chatting. Do not show anything past this point until you have pressed Reveal scoreboard and the room has read the bars. Walk the room; nudge teams towards questions off the history topic. The collapse only lands if they see it before anyone explains it.");
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0.09, w: W, h: H - 0.09, fill: { color: C.ink }, line: { color: C.ink, width: 0 } });
  s.addText("STOP", { x: M, y: 1.4, w: W - 2 * M, h: 0.5, fontFace: SANS, fontSize: 14, bold: true, color: C.sun, align: "center" });
  s.addText("Do not go past this until the scoreboard is revealed.", { x: M, y: 1.9, w: W - 2 * M, h: 1.6, fontFace: DISP, fontSize: 40, bold: true, color: C.paper, align: "center", valign: "middle" });
  s.addText("Let them chat. Press Reveal scoreboard, let the room read the bars, then continue.", { x: M, y: 3.6, w: W - 2 * M, h: 0.6, fontFace: SANS, fontSize: 16, color: C.line, align: "center" });
}

// 6 · What just happened
{
  const s = slide("1 min. Let them read the bars first. Every question got a full-sentence answer: right on history, mostly wrong on everything else. Ask the question on the right. Take three answers from the room and agree with none of them: nod, thank them, move on. The next two slides are the answer.");
  title(s, "What just happened?", { h: 0.8 });
  const ih = 3.65, iw = ih * (2560 / 2056);   // a2-scoreboard.png is 2560×2056
  img(s, "a2-scoreboard.png", M, 1.3, iw, ih);
  const x = M + iw + 0.3, w = W - M - x;
  card(s, x, 1.3, w, 1.6);
  s.addText([
    { text: "37 answers were judged. It was right about " },
    { text: "100% of history", options: { bold: true } },
    { text: " and " },
    { text: "26% of everything else", options: { bold: true } },
    { text: "." },
  ], { x: x + 0.2, y: 1.4, w: w - 0.4, h: 1.4, fontFace: SANS, fontSize: 15, color: C.ink, valign: "middle" });
  card(s, x, 3.05, w, 1.9, C.soft);
  kicker(s, "WORK THIS OUT BEFORE ANYONE TELLS YOU", x + 0.2, 3.15, w - 0.4);
  s.addText("It never once said 'I don't know'. Why not?", { x: x + 0.2, y: 3.45, w: w - 0.4, h: 1.4, fontFace: DISP, fontSize: 21, bold: true, color: C.ink, valign: "middle" });
}

// 7 · This is its whole mind (the corpus, laid out natively)
{
  const s = slide("3 min. Everything HistoryBot has ever read is on this screen: about 2,000 words, nothing else. Highlighted: the words from 'Who built the Taj Mahal?' that it recognised. Say: 'Find the sentence yours came from.' Give them a minute on their phones (HistoryBot tab → Show me everything it has ever read). Every word it said is in here. Take one answer from the room and find the pieces it was stitched from.");
  s.addText("This is its whole mind.", { x: M, y: 0.2, w: 5.4, h: 0.5, fontFace: DISP, fontSize: 26, bold: true, color: C.ink, valign: "middle" });
  s.addText("Highlighted: the words from “Who built the Taj Mahal?” it recognised.", { x: M, y: 0.66, w: 5.6, h: 0.28, fontFace: SANS, fontSize: 10.5, color: C.muted, valign: "top" });
  s.addText([
    { text: "On the phone:", options: { italic: false, breakLine: true } },
    { text: "“Recognised 3 of 3 words in your question.”", options: { breakLine: true } },
    { text: "“It recognised none of your words. It answered anyway.”" },
  ], { x: 5.9, y: 0.2, w: 3.75, h: 0.76, fontFace: SANS, fontSize: 10.5, italic: true, color: C.muted, align: "right", valign: "middle", paraSpaceAfter: 1 });

  // Five equal columns of tiny Calibri. 7 pt needs about 7 in of column on a 5.6 in slide, so the
  // whole text only fits at 5 pt; the point is that it all fits on one screen, and it stays legible
  // when zoomed. Columns are balanced with a rough Calibri width table; PowerPoint does the real wrap.
  const PT = 5, LS = 0.95, INSET = 2, COLS = 5;
  const x0 = 0.35, gap = 0.1, colW = (W - 2 * x0 - (COLS - 1) * gap) / COLS, y0 = 1.0, colH = 5.08 - y0;
  const WIDTH = { " ": .226, a: .479, b: .525, c: .423, d: .525, e: .498, f: .305, g: .471, h: .525, i: .229, j: .239, k: .455, l: .229, m: .799, n: .525, o: .527, p: .525, q: .525, r: .349, s: .391, t: .335, u: .525, v: .452, w: .715, x: .433, y: .453, z: .395,
    A: .579, B: .544, C: .533, D: .615, E: .488, F: .459, G: .631, H: .623, I: .252, J: .319, K: .520, L: .420, M: .855, N: .646, O: .662, P: .517, Q: .673, R: .543, S: .459, T: .487, U: .642, V: .567, W: .890, X: .519, Y: .487, Z: .468,
    ".": .252, ",": .250, ";": .268, ":": .268, "'": .221, "’": .250, "-": .306, "(": .303, ")": .303, "?": .463, "“": .418, "”": .418, "–": .498 };
  const em = (str) => [...str].reduce((a, ch) => a + (WIDTH[ch] ?? (/\d/.test(ch) ? .507 : .5)), 0);
  const budget = ((colW - 2 * INSET / 72) * 72) / PT;   // em per line
  const lines = [];   // { words, paraEnd } in reading order
  for (const words of history.text.split(/\n\s*\n/).map((p) => p.trim().split(/\s+/))) {
    let cur = [], w = 0;
    for (const word of words) {
      const ww = em(word), add = cur.length ? em(" ") + ww : ww;
      if (cur.length && w + add > budget) { lines.push({ words: cur, paraEnd: false }); cur = [word]; w = ww; }
      else { cur.push(word); w += add; }
    }
    lines.push({ words: cur, paraEnd: true });
  }
  const per = Math.ceil(lines.length / COLS);
  const HL = /(\b(?:Taj|Mahal|built)\b)/i;
  let rendered = 0;
  for (let c = 0; c < COLS; c++) {
    const col = lines.slice(c * per, (c + 1) * per);
    const runs = [];
    let para = [];
    const flush = (last) => {
      rendered += para.length;
      para.join(" ").split(HL).forEach((part, i) => {
        if (part) runs.push({ text: part, options: i % 2 ? { highlight: C.sun, bold: true, color: C.ink } : {} });
      });
      if (runs.length && !last) runs[runs.length - 1].options = { ...runs[runs.length - 1].options, breakLine: true };
      para = [];
    };
    col.forEach((ln, i) => { para.push(...ln.words); if (ln.paraEnd || i === col.length - 1) flush(i === col.length - 1); });
    const x = x0 + c * (colW + gap);
    s.addShape(pptx.ShapeType.roundRect, { x, y: y0, w: colW, h: colH, fill: { color: C.paper }, line: { color: C.line, width: 0.75 }, rectRadius: 0.05 });
    s.addText(runs, { x, y: y0, w: colW, h: colH, fontFace: SANS, fontSize: PT, color: C.ink, valign: "top", margin: INSET, lineSpacingMultiple: LS, paraSpaceAfter: 2 });
  }
  console.log(`corpus: ${rendered} words in ${COLS} columns · est ${lines.length} lines, ${per}/column`);
}

// 8 · How it works
{
  const s = slide("2 min. Only now say 'next word'. It read the 2,000 words and counted which word tends to follow which. To answer, it starts from the words in your question that it recognised and picks the most likely next word, then the next, until a full stop. Nothing in there checks whether the sentence is true. It cannot say 'I don't know' because it has no idea what knowing is; it only ever has a next word. Very sure and still wrong: the same lesson as the confidence bar last time. Keep the vocabulary to 'word' and 'bot'.");
  title(s, "How it works.");
  const steps = [["📖", "READ", "Count which word follows which."], ["🎯", "PICK", "The most likely next word."], ["🔁", "REPEAT", "One word at a time, until a full stop."]];
  steps.forEach(([e, h, t], i) => {
    const x = M + i * 3.15;
    card(s, x, 1.45, 2.7, 2.4);
    s.addText(e, { x, y: 1.55, w: 2.7, h: 0.7, fontFace: SANS, fontSize: 32, align: "center" });
    s.addText(h, { x, y: 2.2, w: 2.7, h: 0.4, fontFace: DISP, fontSize: 20, bold: true, color: C.skyDeep, align: "center" });
    body(s, t, x + 0.2, 2.65, 2.3, 1.1, { fontSize: 14, align: "center" });
    if (i < 2) arrow(s, x + 2.72, 2.45, 0.4);
  });
  card(s, 1.2, 4.05, 7.6, 0.85, C.soft);
  s.addText("Very sure and still wrong —\nremember 'The answer is a confidence.' from last time?", { x: 1.4, y: 4.05, w: 7.2, h: 0.85, fontFace: SANS, fontSize: 15, bold: true, color: C.ink, align: "center", valign: "middle" });
}

// 9 · Nonsense of the day
{
  const s = slide("1 min. Read it out with a straight face. The bot recognised nothing in the question, so it started from nowhere and produced the most common path through its 2,000 words: Mughal capitals. That is not lying; lying needs an idea of the truth. It has nothing else to say, so it says this, in a full sentence, confidently.");
  title(s, "Nonsense of the day.");
  card(s, 1.2, 1.4, 7.6, 2.35);
  s.addShape(pptx.ShapeType.roundRect, { x: 1.2, y: 1.4, w: 0.12, h: 2.35, fill: { color: C.berry }, line: { color: C.berry, width: 0 }, rectRadius: 0.06 });
  kicker(s, "NONSENSE OF THE DAY", 1.6, 1.55, 6.9, C.berry);
  body(s, "Maths · What is a prime number?", 1.6, 1.9, 6.9, 0.4, { fontSize: 15, color: C.muted });
  s.addText("“Later the capital moved away from fatehpur sikri near agra.”", { x: 1.6, y: 2.3, w: 6.9, h: 1.1, fontFace: DISP, fontSize: 24, bold: true, color: C.ink, valign: "middle" });
  body(s, "It recognised 0 of 2 words. It answered anyway.", 1.6, 3.45, 6.9, 0.4, { fontSize: 12, bold: true, color: C.muted });
  s.addText("It answered anyway. That is not lying.\nIt has nothing else to say.", { x: M, y: 3.95, w: W - 2 * M, h: 0.95, fontFace: DISP, fontSize: 21, bold: true, color: C.mangoDeep, align: "center", valign: "middle" });
}

// 10 · Part 2 briefing
{
  const s = slide("2 min briefing, then 6 min of training. Each team picks what its bot reads: one of the starter texts, or a paragraph they paste themselves. Everything they tick is the whole of what it will ever know; nothing else exists for it. Try it before sending: ask about its topic, then about something else, and watch the second answer. One phone per team sends, and sending again replaces the bot, so agree first. Press Open cross-examination when every team's bot is in.");
  title(s, "Part 2 · Train your bot.");
  const ih = 3.55, iw = ih * (780 / 2486);   // a2-trainbot-phone.png is 780×2486
  img(s, "a2-trainbot-phone.png", M + 0.2, 1.3, iw, ih);
  body(s, "student view", M, 1.3 + ih + 0.05, iw + 0.4, 0.3, { fontSize: 10, color: C.muted, align: "center" });
  const rules = [["☑️", "Tick what it reads — that is everything it will ever know.", "Train your bot → Train my bot"], ["📱", "One phone per team sends. Agree first.", "Send my bot to the class"], ["🎤", "Ask it about its topic, then about something else.", "Try it → Test your bot…"]];
  rules.forEach(([e, h, t], i) => {
    const x = 2.2, y = 1.3 + i * 1.2, w = W - M - x;
    card(s, x, y, w, 1.08);
    badge(s, String(i + 1), x - 0.25, y + 0.36, C.mango, C.paper, 0.5);
    s.addText(e, { x: x + 0.3, y: y + 0.19, w: 0.7, h: 0.7, fontFace: SANS, fontSize: 26, align: "center", valign: "middle" });
    s.addText(h, { x: x + 1.05, y: y + 0.1, w: w - 1.25, h: 0.55, fontFace: DISP, fontSize: 16, bold: true, color: C.ink, valign: "middle" });
    body(s, t, x + 1.05, y + 0.65, w - 1.25, 0.4, { fontSize: 11.5, color: C.muted });
  });
}

// 11 · Cross-examination debrief
{
  const s = slide("8 min of cross-examining, then 2 min here. Every bot is now questioned by strangers, so the Own team column is a dash: only strangers' votes count, the same rule as the tournament last time. Look at the strips. The bots that scored have their bump in exactly one topic — the one they read. Two strips here are flat: those bots were asked about things they had never read, and got them wrong — that is what the reds are. Ask every team with a bump: where is it? Then: what did it read? Same answer, every time.");
  title(s, "Cross-examination.");
  const iw = 7.6, ih = iw / (2560 / 856);   // a2-exam-strips.png is 2560×856
  img(s, "a2-exam-strips.png", (W - iw) / 2, 1.3, iw, ih);
  s.addText("Every bot has one bump. Where is it? That is what it read.", { x: M, y: 1.3 + ih + 0.1, w: W - 2 * M, h: 0.55, fontFace: DISP, fontSize: 21, bold: true, color: C.ink, align: "center", valign: "middle" });
  pill(s, "OWN TEAM  —  your own team's votes don't count", 0.7, 4.6, 4.2, C.paper, C.muted, 0.4, 11.5);
  pill(s, "STRANGERS  14%  the only score that matters", 5.1, 4.6, 4.2, C.leaf, C.paper, 0.4, 11.5);
}

// 12 · The big ones + exit
{
  const s = slide("4 min. The wrap, then the exit ticket: one line each, collect them. The big ones, the chatbots on their phones, work the same way, one word at a time, only they have read millions of times more, so the mistakes are rarer and much harder to spot. The question to leave in the room: what did it read, and who chose that?");
  title(s, "The big ones.");
  card(s, M, 1.35, 5.5, 3.25);
  s.addText([
    { text: "A language model only says what it has read, one word at a time, confidently, about anything. The big ones have read millions of times more, so the mistakes are rarer and harder to spot. " },
    { text: "What did it read, and who chose that?", options: { bold: true, color: C.mangoDeep } },
  ], { x: M + 0.3, y: 1.5, w: 4.9, h: 2.95, fontFace: SANS, fontSize: 17, color: C.ink, valign: "middle" });
  card(s, 6.3, 1.35, 3.2, 3.25, C.soft);
  kicker(s, "EXIT TICKET", 6.5, 1.5, 2.8);
  s.addText("Name one thing you asked a chatbot this month. What might it have read to answer? Who chose that?", { x: 6.5, y: 1.85, w: 2.8, h: 2.2, fontFace: DISP, fontSize: 15, bold: true, color: C.ink, valign: "top" });
  body(s, "One line each.", 6.5, 4.1, 2.8, 0.4, { fontSize: 12, color: C.muted });
  badge(s, "LAST LESSON: A MACHINE ONLY KNOWS WHAT IT WAS SHOWN", (W - 7.4) / 2, 4.75, C.sun, C.ink, 7.4);
}

const out = "slides/Neural-Lab-Lesson-2.pptx";
await pptx.writeFile({ fileName: out });
console.log(`wrote ${out} · ${pptx.slides.length} slides`);
