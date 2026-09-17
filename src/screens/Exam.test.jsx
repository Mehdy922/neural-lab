import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const TEXT = "Cricket is a bat and ball game. The bowler bowls the ball. The batter hits the ball. A match has two innings.";
const THREE = { tA: { text: TEXT, sources: ["cricket"] }, tB: { text: TEXT, sources: ["cooking"] }, tC: { text: TEXT, sources: ["space"] } };
let botsValue = THREE;   // what the mocked useBots reports; a test can swap it and rerender
vi.mock("../rooms/hooks.js", () => ({
  useBots: () => ({ value: botsValue, loading: false }),
  useBotVotes: () => ({ value: null, loading: false }),
}));
vi.mock("../rooms/api.js", () => ({ castBotVote: vi.fn() }));

import { Exam } from "./Exam.jsx";

const base = { code: "ABCDE", uid: "student-1", teams: { tA: { name: "Aloo" }, tB: { name: "Bhindi" }, tC: { name: "Chai" }, tD: { name: "Daal" } }, isTeacher: false, flash: () => {} };
const asking = () => screen.getByText(/Asking/).textContent.match(/Asking (.*?)'s bot/)[1];

describe("Exam", () => {
  beforeEach(() => { botsValue = THREE; });

  it("starts on another team's bot, never your own, and names its sources by title", () => {
    render(<Exam {...base} team={{ id: "tA", name: "Aloo" }} />);
    expect(screen.getByText(/Asking/).textContent).not.toMatch(/Aloo's bot/);
    expect(screen.getByText(/Asking/).textContent).toMatch(/fed on: (In the kitchen|Space)\./);   // sources sit in a nested <b>, so match on the paragraph's textContent
  });
  it("spreads examiners across bots by uid", () => {
    const picks = new Set();
    for (const uid of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      const { unmount } = render(<Exam {...base} uid={uid} team={{ id: "tA", name: "Aloo" }} />);
      picks.add(asking());
      unmount();
    }
    expect(picks.size).toBe(2);   // Bhindi and Chai both get examiners
  });
  it("pins the default bot for the session: a bot that arrives later does not move the examiner", () => {
    const props = { ...base, uid: "pin-1", team: { id: "tA", name: "Aloo" } };   // hash("pin-1") picks different bots from a pool of 2 and a pool of 3
    const { rerender } = render(<Exam {...props} />);
    const before = asking();
    botsValue = { ...THREE, tD: { text: TEXT, sources: ["folktales"] } };
    rerender(<Exam {...props} />);
    expect(asking()).toBe(before);
  });
});
