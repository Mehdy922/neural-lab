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
