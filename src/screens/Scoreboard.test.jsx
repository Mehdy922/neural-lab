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
