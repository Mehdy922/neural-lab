import { describe, it, expect } from "vitest";
import { PHASES, TABS, visibleTabs, nextPhase, PHASE_ACTIONS } from "./phases.js";
import { ACTIVITIES, PHASES_BY_ACTIVITY, TABS_BY_ACTIVITY, phaseAction, supportsRounds } from "./phases.js";

const keys = (tabs) => tabs.map((t) => t.key);

describe("phases", () => {
  it("has four phases in order", () => {
    expect(PHASES).toEqual(["lobby", "teach", "reveal", "fence"]);
  });
  it("nextPhase walks forward and stops", () => {
    expect(nextPhase("lobby")).toBe("teach");
    expect(nextPhase("teach")).toBe("reveal");
    expect(nextPhase("reveal")).toBe("fence");
    expect(nextPhase("fence")).toBeNull();
    expect(nextPhase("bogus")).toBeNull();
  });
  it("has an action label for every non-final phase", () => {
    expect(Object.keys(PHASE_ACTIONS).sort()).toEqual(["lobby", "reveal", "teach"]);
  });
});

describe("visibleTabs", () => {
  it("teacher always sees every tab plus settings", () => {
    for (const p of PHASES) {
      expect(keys(visibleTabs("teacher", p))).toEqual(["lobby", "teach", "tournament", "fence", "settings"]);
    }
  });
  it("student sees tabs gated by phase", () => {
    expect(keys(visibleTabs("student", "lobby"))).toEqual(["lobby"]);
    expect(keys(visibleTabs("student", "teach"))).toEqual(["lobby", "teach"]);
    expect(keys(visibleTabs("student", "reveal"))).toEqual(["lobby", "teach", "tournament"]);
    expect(keys(visibleTabs("student", "fence"))).toEqual(["lobby", "teach", "tournament", "fence"]);
  });
  it("student with unknown phase sees only lobby", () => {
    expect(keys(visibleTabs("student", undefined))).toEqual(["lobby"]);
  });
  it("TABS carry emoji and labels", () => {
    TABS.forEach((t) => { expect(t.emoji).toBeTruthy(); expect(t.label).toBeTruthy(); });
  });
});

describe("activity 2 phases", () => {
  it("defines both activities", () => {
    expect(Object.keys(ACTIVITIES)).toEqual(["1", "2"]);
    expect(ACTIVITIES[2].title).toBe("Talk to the machine");
    expect(PHASES_BY_ACTIVITY[2]).toEqual(["lobby", "chat", "reveal", "train", "exam"]);
    expect(PHASES_BY_ACTIVITY[1]).toEqual(PHASES);
  });
  it("walks activity 2 phases forward", () => {
    expect(nextPhase("lobby", 2)).toBe("chat");
    expect(nextPhase("chat", 2)).toBe("reveal");
    expect(nextPhase("reveal", 2)).toBe("train");
    expect(nextPhase("train", 2)).toBe("exam");
    expect(nextPhase("exam", 2)).toBeNull();
    expect(nextPhase("reveal", 1)).toBe("fence");
  });
  it("labels every non-final activity 2 phase", () => {
    expect(phaseAction("lobby", 2)).toBe("Start chatting");
    expect(phaseAction("chat", 2)).toBe("Reveal scoreboard");
    expect(phaseAction("reveal", 2)).toBe("Start training");
    expect(phaseAction("train", 2)).toBe("Open cross-examination");
    expect(phaseAction("exam", 2)).toBeUndefined();
    expect(phaseAction("reveal", 1)).toBe("Open bendy fence");
  });
  it("gates activity 2 tabs for students", () => {
    expect(keys(visibleTabs("student", "lobby", 2))).toEqual(["lobby"]);
    expect(keys(visibleTabs("student", "chat", 2))).toEqual(["lobby", "chat"]);
    expect(keys(visibleTabs("student", "reveal", 2))).toEqual(["lobby", "chat", "scoreboard"]);
    expect(keys(visibleTabs("student", "train", 2))).toEqual(["lobby", "chat", "scoreboard", "trainbot"]);
    expect(keys(visibleTabs("student", "exam", 2))).toEqual(["lobby", "chat", "scoreboard", "trainbot", "exam"]);
    expect(keys(visibleTabs("teacher", "lobby", 2))).toEqual(["lobby", "chat", "scoreboard", "trainbot", "exam", "settings"]);
    expect(TABS_BY_ACTIVITY[2].every((t) => t.emoji && t.label)).toBe(true);
  });
  it("only activity 1 has rounds", () => {
    expect(supportsRounds(1)).toBe(true);
    expect(supportsRounds(2)).toBe(false);
  });
});
