import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const api = {
  setLabels: vi.fn(() => Promise.resolve()),
  setTeamCap: vi.fn(() => Promise.resolve()),
  setMaxTeams: vi.fn(() => Promise.resolve()),
  resetBoard: vi.fn(() => Promise.resolve()),
  closeRoom: vi.fn(() => Promise.resolve()),
};
vi.mock("../rooms/api.js", () => ({
  setLabels: (...a) => api.setLabels(...a),
  setTeamCap: (...a) => api.setTeamCap(...a),
  setMaxTeams: (...a) => api.setMaxTeams(...a),
  resetBoard: (...a) => api.resetBoard(...a),
  closeRoom: (...a) => api.closeRoom(...a),
  MAX_TEAMS_MIN: 2,
  MAX_TEAMS_MAX: 20,
}));

import { Settings } from "./Settings.jsx";

const base = { code: "ABCDE", flash: () => {} };

describe("Settings max teams", () => {
  it("shows the current limit and sets a new one", () => {
    render(<Settings {...base} meta={{ labels: ["Mango", "Cricket ball"], teamCap: 4, maxTeams: 6 }} />);
    const input = screen.getByLabelText("Max teams");
    expect(input.value).toBe("6");
    fireEvent.change(input, { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: "Set max teams" }));
    expect(api.setMaxTeams).toHaveBeenCalledWith({ code: "ABCDE", maxTeams: "8" });
  });
  it("blank means no limit", () => {
    render(<Settings {...base} meta={{ labels: ["Mango", "Cricket ball"], teamCap: 4 }} />);
    const input = screen.getByLabelText("Max teams");
    expect(input.value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Set max teams" }));
    expect(api.setMaxTeams).toHaveBeenCalledWith({ code: "ABCDE", maxTeams: "" });
  });
});

describe("Settings", () => {
  it("keeps a half-typed team cap when an unrelated meta snapshot arrives", () => {
    const meta1 = { labels: ["Mango", "Cricket ball"], teamCap: 4, phase: "lobby" };
    const { rerender } = render(<Settings {...base} meta={meta1} />);
    fireEvent.change(screen.getByLabelText("Team cap"), { target: { value: "6" } });
    // new snapshot: same values, new array identity, phase changed
    const meta2 = { labels: ["Mango", "Cricket ball"], teamCap: 4, phase: "teach" };
    rerender(<Settings {...base} meta={meta2} />);
    expect(screen.getByLabelText("Team cap").value).toBe("6");
  });
  it("resyncs a field when its value actually changes remotely", () => {
    const { rerender } = render(<Settings {...base} meta={{ labels: ["Mango", "Cricket ball"], teamCap: 4 }} />);
    rerender(<Settings {...base} meta={{ labels: ["Sun", "Flower"], teamCap: 4 }} />);
    expect(screen.getByLabelText("First thing").value).toBe("Sun");
    expect(screen.getByLabelText("Second thing").value).toBe("Flower");
  });
  it("run sheet reads the room's team size, names the projector tab and ends with Close room", () => {
    render(<Settings {...base} meta={{ labels: ["Mango", "Cricket ball"], teamCap: 6 }} />);
    expect(screen.getByText("Teams of 6. Team name in. Projector: Lobby. No explaining.")).toBeTruthy();
    expect(screen.getByText("Send to the class. Press Reveal tournament. Projector: Tournament.")).toBeTruthy();
    expect(screen.getByText("Out. Settings → Close room, so nobody rejoins it next lesson.")).toBeTruthy();
  });
  it("activity-1 notes end with the Wrap line, and Reset asks about rounds", () => {
    render(<Settings {...base} meta={{ labels: ["Mango", "Cricket ball"], teamCap: 4 }} />);
    expect(screen.getByRole("heading", { name: "Wrap" })).toBeTruthy();
    expect(screen.getByText(/A machine only knows what it was shown\. Yours was shown ten drawings by four people\./)).toBeTruthy();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    fireEvent.click(screen.getByRole("button", { name: /Reset board/ }));
    expect(confirmSpy).toHaveBeenCalledWith("Wipe every sent machine, challenge and round score and go back to round 1 of Teach it? Teams stay.");
    confirmSpy.mockRestore();
  });
});

describe("Settings for activity 2", () => {
  it("hides the drawing pair and resets with the activity", () => {
    render(<Settings {...base} activity={2} meta={{ labels: ["Mango", "Cricket ball"], teamCap: 4, activity: 2 }} />);
    expect(screen.queryByLabelText("First thing")).toBeNull();
    expect(screen.getByLabelText("Team cap")).toBeTruthy();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: /Reset board/ }));
    expect(api.resetBoard).toHaveBeenCalledWith({ code: "ABCDE", activity: 2 });
    window.confirm.mockRestore();
  });
  it("shows the activity-2 notes and hides the activity-1-only ones", () => {
    render(<Settings {...base} activity={2} meta={{ labels: ["Mango", "Cricket ball"], teamCap: 4, activity: 2 }} />);
    expect(screen.getByRole("heading", { name: "Before you start" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "The reveal" })).toBeNull();   // merged into "Say this · Reveal"
    expect(screen.queryByRole("heading", { name: /Bendy fence/ })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Wrap" })).toBeNull();
  });
  it("activity-2 notes carry the religion warning and the teacher script", () => {
    render(<Settings {...base} activity={2} meta={{ labels: ["Mango", "Cricket ball"], teamCap: 4, activity: 2 }} />);
    expect(screen.getByText(/Students will ask it about religion/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Say this" })).toBeTruthy();
    expect(screen.getByText(/Then, on the Scoreboard: "Look at the strips\. Every bot has one bump\. Where is the bump\? That is what it read\."/)).toBeTruthy();   // unique to the script ("one bump" also appears in the run sheet)
  });
  it("activity-2 run sheet reads the team size, sends the projector to the Scoreboard for the strips and ends with Close room", () => {
    render(<Settings {...base} activity={2} meta={{ labels: ["Mango", "Cricket ball"], teamCap: 5, activity: 2 }} />);
    expect(screen.getByText("Teams of 5. Room code in. Projector: Lobby.")).toBeTruthy();
    expect(screen.getByText("Projector: Scoreboard. Look at the strips: every bot has one bump. Where is it?")).toBeTruthy();
    expect(screen.getByText("Out. Settings → Close room, so nobody rejoins it next lesson.")).toBeTruthy();
  });
});
