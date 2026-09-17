import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

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
const CORPUS_BTN = { name: "Show me everything it has ever read" };

describe("Scoreboard", () => {
  afterEach(() => { sessionStorage.clear(); });   // hidden items persist per room for the session; one test must not leak into the next

  it("waits below ten votes", () => {
    votesValue = { a: v("history", "right", 1) };
    render(<Scoreboard {...base} />);
    expect(screen.getByText(/waiting for questions/i)).toBeTruthy();
  });
  it("keeps the bars, headline and corpus card hidden during the chat phase even with many votes, but shows the feed", () => {
    votesValue = many();
    render(<Scoreboard {...base} meta={{ phase: "chat", activity: 2 }} />);
    expect(screen.queryByText(/answers were judged/)).toBeNull();
    expect(screen.queryByText("It never once said 'I don't know'. Why not?")).toBeNull();
    expect(screen.queryByRole("button", CORPUS_BTN)).toBeNull();          // the corpus is a reveal beat
    expect(screen.getByText(/14 answers judged so far/)).toBeTruthy();
    expect(screen.getByText("q15")).toBeTruthy();                       // newest feed item (at = 15)
  });
  it("shows per-topic bars, the headline split, the question, the corpus card and the nonsense of the day once revealed", () => {
    votesValue = many();
    render(<Scoreboard {...base} />);
    expect(screen.getByText(/14 answers were judged/)).toBeTruthy();
    expect(screen.getByText(/75% of history/)).toBeTruthy();
    expect(screen.getByText(/17% of everything else/)).toBeTruthy();
    expect(screen.getByText("It never once said 'I don't know'. Why not?")).toBeTruthy();
    expect(screen.getByRole("button", CORPUS_BTN)).toBeTruthy();
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
    fireEvent.click(screen.getByRole("button", { name: /hide q7/i }));   // q7 is in the latest-8 feed and is not the nonsense card
    expect(screen.queryByText("q7")).toBeNull();
  });
  it("lets the teacher hide the nonsense of the day; the next one takes its place", () => {
    votesValue = many();
    render(<Scoreboard {...base} />);
    const card = screen.getByText("Nonsense of the day").parentElement;
    const btn = within(card).getByRole("button", { name: /^Hide / });
    const q = btn.getAttribute("aria-label").replace(/^Hide /, "");
    expect(card.textContent).toContain(q);
    fireEvent.click(btn);
    expect(screen.queryByText(q)).toBeNull();                                   // gone from the card and from the feed
    const next = screen.queryByText("Nonsense of the day");
    if (next) expect(next.parentElement.textContent).not.toContain(q);          // a different question, or no card at all
  });
  it("remembers hidden items for the room across a remount (sessionStorage)", () => {
    votesValue = many();
    const first = render(<Scoreboard {...base} />);
    fireEvent.click(screen.getByRole("button", { name: /hide q7/i }));
    first.unmount();
    render(<Scoreboard {...base} />);
    expect(screen.queryByText("q7")).toBeNull();
    expect(screen.getByText("q6")).toBeTruthy();
    expect(JSON.parse(sessionStorage.getItem("nl.hidden.ABCDE"))).toEqual(["h7"]);
  });
  it("feed coverage line follows the phone rule: silent with no content words, 'none' when nothing was recognised", () => {
    votesValue = { ...many(), n0: v("maths", "right", 50, { q: "what is 2+2", known: 0, total: 0 }), n1: v("science", "wrong", 51, { q: "what is a cell", known: 0, total: 2 }) };
    render(<Scoreboard {...base} />);
    expect(screen.queryByText(/of 0 words/)).toBeNull();
    expect(screen.getByText(/recognised none of the words/)).toBeTruthy();
    expect(screen.getAllByText(/recognised 1 of 2 words/).length).toBeGreaterThan(0);
  });
  it("corpus card: projector-sized for the teacher, a scroll box for students; the caption says when no word was recognised", () => {
    votesValue = many();
    const teacher = render(<Scoreboard {...base} />);
    fireEvent.click(screen.getByRole("button", CORPUS_BTN));
    expect(screen.getByText(/It recognised none of the words from “q15”\./)).toBeTruthy();   // q15 is the focus by default; no question word is in the text
    const box = screen.getByText(/Mohenjo-daro/).parentElement;
    expect(box.style.columnCount).toBe("5");
    expect(box.style.maxHeight).toBe("none");
    expect(box.parentElement.style.width).toBe("100vw");                                    // breaks out of the 960 px column
    teacher.unmount();
    render(<Scoreboard {...base} isTeacher={false} />);
    fireEvent.click(screen.getByRole("button", CORPUS_BTN));
    const phoneBox = screen.getByText(/Mohenjo-daro/).parentElement;
    expect(phoneBox.style.maxHeight).toBe("420px");
    expect(phoneBox.style.columnCount).toBe("");
    expect(phoneBox.parentElement.style.width).toBe("");
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
