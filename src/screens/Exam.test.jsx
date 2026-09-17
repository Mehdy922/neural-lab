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
