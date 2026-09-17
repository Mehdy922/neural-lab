import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

let botValue = null;   // what the mocked useTeamBot reports as the team's sent bot; a test can set it to lock the student in
vi.mock("../rooms/hooks.js", () => ({
  useTeamModel: () => ({ value: null, loading: false, error: null }),
  useTeamBot: () => ({ value: botValue, loading: false, error: null }),
}));
vi.mock("../rooms/api.js", () => ({
  createTeam: vi.fn(), joinTeam: vi.fn(), leaveTeam: vi.fn(), renameTeam: vi.fn(), deleteTeam: vi.fn(), moveMember: vi.fn(),
  DEFAULT_TEAM_CAP: 4,
}));
vi.mock("../components/QrLink.jsx", () => ({ QrLink: () => null }));

import { Lobby } from "./Lobby.jsx";

const teams = { t1: { name: "Aloo", createdAt: 1 }, t2: { name: "Bhindi", createdAt: 2 } };
const members = { u1: { name: "Sana", teamId: "t1" }, u2: { name: "Bilal", teamId: "t2" }, me: { name: "Zara" } };
const base = { code: "ABCDE", uid: "me", members, teams, team: null, isTeacher: false, flash: () => {} };
const teacherProps = { ...base, isTeacher: true, meta: { teamCap: 4 } };

describe("Lobby team limit (student view)", () => {
  it("lets students create a team while under the limit", () => {
    render(<Lobby {...base} meta={{ teamCap: 4, maxTeams: 3 }} />);
    expect(screen.getByLabelText("New team name")).toBeTruthy();
    expect(screen.getByText("2/3")).toBeTruthy();
  });
  it("hides the create form and explains when the limit is reached", () => {
    render(<Lobby {...base} meta={{ teamCap: 4, maxTeams: 2 }} />);
    expect(screen.queryByLabelText("New team name")).toBeNull();
    expect(screen.getByText(/All 2 teams are made/)).toBeTruthy();
    expect(screen.getByText("2/2")).toBeTruthy();
  });
  it("has no limit when maxTeams is unset", () => {
    render(<Lobby {...base} meta={{ teamCap: 4 }} />);
    expect(screen.getByLabelText("New team name")).toBeTruthy();
    expect(screen.queryByText(/teams are made/)).toBeNull();
  });
});

describe("Lobby teacher hint", () => {
  it("tells the activity-2 teacher to press Start chatting", () => {
    render(<Lobby {...teacherProps} activity={2} />);
    expect(screen.getByText(/Press/).textContent).toMatch(/Start chatting/);
  });
  it("drops the Press sentence once the lesson has started", () => {
    render(<Lobby {...teacherProps} activity={2} meta={{ teamCap: 4, phase: "chat" }} />);
    expect(screen.getByText(/Put this on the projector/).textContent).toBe("Put this on the projector. Students scan the code or type it in.");
    expect(screen.queryByText(/Press/)).toBeNull();
  });
});

describe("Lobby student hint", () => {
  afterEach(() => { botValue = null; });
  const inTeam = { ...base, team: { id: "t1", name: "Aloo" } };
  // The hint's tab name sits in a nested <b>, so match the paragraph and read its textContent.
  const hint = () => screen.getByText(/You're in/).textContent;

  it("waits for the teacher while the room is in the lobby", () => {
    render(<Lobby {...inTeam} meta={{ teamCap: 4, phase: "lobby" }} />);
    expect(hint()).toMatch(/Wait for your teacher to start, or switch teams below\./);
  });
  it("treats a room with no phase yet as the lobby", () => {
    render(<Lobby {...inTeam} meta={{ teamCap: 4 }} />);
    expect(hint()).toMatch(/Wait for your teacher to start/);
    expect(hint()).not.toMatch(/has started/);
  });
  it("points at HistoryBot once activity 2 has started", () => {
    render(<Lobby {...inTeam} activity={2} meta={{ teamCap: 4, phase: "chat" }} />);
    expect(hint()).toMatch(/You're in Aloo\. Your teacher has started — open HistoryBot above\./);
  });
  it("points at Teach it once activity 1 has started", () => {
    render(<Lobby {...inTeam} activity={1} meta={{ teamCap: 4, phase: "teach" }} />);
    expect(hint()).toMatch(/open Teach it above\./);
  });
  it("tells a locked-in student to ask the teacher to move them", () => {
    botValue = { text: "x", sentBy: "u1" };
    render(<Lobby {...inTeam} activity={2} meta={{ teamCap: 4, phase: "train" }} />);
    expect(hint()).toMatch(/Your team has sent its bot, so you're locked in\. Ask your teacher if you need to move\./);
  });
});
