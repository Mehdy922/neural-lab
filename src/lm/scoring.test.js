import { describe, it, expect } from "vitest";
import { TOPICS, VERDICTS, TOPIC_IDS, VERDICT_IDS, MIN_VOTES_TO_SHOW, MIN_FOREIGN_VOTES, topicAccuracy, splitHistoryVsRest, botLeaderboard, recentVotes, botTopicTallies, nonsenseOfTheDay } from "./scoring.js";

const v = (topic, verdict, at = 1) => ({ uid: "u", topic, verdict, q: "q", a: "a", known: 1, total: 2, at });
const votes = {
  a: v("history", "right", 5), b: v("history", "right", 4), c: v("history", "wrong", 3),
  d: v("science", "wrong", 2), e: v("science", "nonsense", 1), f: v("sport", "right", 6),
};

describe("constants", () => {
  it("topics and verdicts", () => {
    expect(TOPIC_IDS).toEqual(["history", "science", "sport", "maths", "everyday", "other"]);
    expect(VERDICT_IDS).toEqual(["right", "wrong", "nonsense"]);
    expect(TOPICS.every((t) => t.label && t.emoji)).toBe(true);
    expect(VERDICTS.every((t) => t.label && t.emoji)).toBe(true);
    expect(MIN_VOTES_TO_SHOW).toBe(10);
    expect(MIN_FOREIGN_VOTES).toBe(3);
  });
});

describe("topicAccuracy", () => {
  it("counts per topic in TOPICS order, nonsense = wrong, pct null when no votes", () => {
    const rows = topicAccuracy(votes);
    expect(rows.map((r) => r.topic)).toEqual(TOPIC_IDS);
    expect(rows[0]).toMatchObject({ topic: "history", n: 3, right: 2 });
    expect(rows[0].pct).toBeCloseTo(2 / 3, 6);
    expect(rows[1]).toMatchObject({ topic: "science", n: 2, right: 0, pct: 0 });
    expect(rows[3]).toMatchObject({ topic: "maths", n: 0, right: 0, pct: null });
  });
  it("ignores malformed records and null input", () => {
    expect(topicAccuracy(null).every((r) => r.n === 0)).toBe(true);
    expect(topicAccuracy({ x: { topic: "bogus", verdict: "right" } }).every((r) => r.n === 0)).toBe(true);
  });
});

describe("splitHistoryVsRest", () => {
  it("splits history from everything else", () => {
    const s = splitHistoryVsRest(votes);
    expect(s.history).toMatchObject({ n: 3, right: 2 });
    expect(s.rest).toMatchObject({ n: 3, right: 1 });
    expect(s.total).toBe(6);
  });
});

describe("botLeaderboard", () => {
  const teams = { tA: { name: "Aloo" }, tB: { name: "Bhindi" }, tC: { name: "Chai" } };
  const bots = { tA: { text: "x" }, tB: { text: "y" }, tC: { text: "z" } };
  const bv = (bot, asker, verdict) => ({ uid: "u", botTeamId: bot, askerTeamId: asker, topic: "history", verdict, q: "q", at: 1 });
  const botVotes = {
    1: bv("tA", "tB", "right"), 2: bv("tA", "tC", "right"), 3: bv("tA", "tB", "wrong"), 4: bv("tA", "tA", "right"),
    5: bv("tB", "tA", "wrong"), 6: bv("tB", "tC", "nonsense"), 7: bv("tB", "tA", "right"), 8: bv("tB", "tC", "right"),
    9: bv("tC", "tA", "right"),
  };
  it("scores foreign votes only, excludes own votes, gates on MIN_FOREIGN_VOTES", () => {
    const rows = botLeaderboard(botVotes, teams, bots);
    const a = rows.find((r) => r.teamId === "tA"), b = rows.find((r) => r.teamId === "tB"), c = rows.find((r) => r.teamId === "tC");
    expect(a.foreign).toMatchObject({ n: 3, right: 2 }); expect(a.foreign.pct).toBeCloseTo(2 / 3, 6);
    expect(a.own).toMatchObject({ n: 1, right: 1, pct: 1 });
    expect(b.foreign).toMatchObject({ n: 4, right: 2, pct: 0.5 });
    expect(c.foreign).toMatchObject({ n: 1, right: 1, pct: null });
  });
  it("sorts by foreign pct desc with nulls last", () => {
    expect(botLeaderboard(botVotes, teams, bots).map((r) => r.teamId)).toEqual(["tA", "tB", "tC"]);
  });
  it("uses a fallback name for deleted teams and handles null input", () => {
    expect(botLeaderboard(null, {}, { tZ: { text: "q" } })[0]).toMatchObject({ teamId: "tZ", name: "Unknown team", foreign: { n: 0, pct: null } });
    expect(botLeaderboard(null, teams, null)).toEqual([]);
  });
});

describe("recentVotes", () => {
  it("returns newest first, limited", () => {
    expect(recentVotes(votes, 2).map((x) => x.at)).toEqual([6, 5]);
    expect(recentVotes(null)).toEqual([]);
  });
});

describe("botTopicTallies", () => {
  const bv = {
    a: { askerTeamId: "tB", botTeamId: "tA", topic: "sport", verdict: "right" },
    b: { askerTeamId: "tB", botTeamId: "tA", topic: "sport", verdict: "wrong" },
    c: { askerTeamId: "tC", botTeamId: "tA", topic: "science", verdict: "nonsense" },
    d: { askerTeamId: "tA", botTeamId: "tA", topic: "sport", verdict: "right" },   // own team: excluded
    e: { askerTeamId: "tB", botTeamId: "tB", topic: "sport", verdict: "right" },   // other bot
  };
  it("tallies foreign votes per topic in fixed order", () => {
    const rows = botTopicTallies(bv, "tA");
    expect(rows.map((r) => r.topic)).toEqual(["history", "science", "sport", "maths", "everyday", "other"]);
    expect(rows.find((r) => r.topic === "sport")).toMatchObject({ n: 2, right: 1, pct: 0.5 });
    expect(rows.find((r) => r.topic === "science")).toMatchObject({ n: 1, right: 0, pct: 0 });
    expect(rows.find((r) => r.topic === "history")).toMatchObject({ n: 0, right: 0, pct: null });
  });
});

describe("nonsenseOfTheDay", () => {
  it("picks the nonsense vote with the lowest coverage, newest on ties, ignoring zero-total", () => {
    const votes = {
      a: { topic: "science", verdict: "nonsense", q: "cells?", known: 1, total: 2, at: 1 },
      b: { topic: "maths", verdict: "nonsense", q: "7x8", known: 0, total: 0, at: 5 },
      c: { topic: "other", verdict: "nonsense", q: "pizza", known: 0, total: 1, at: 3 },
      d: { topic: "other", verdict: "nonsense", q: "sky blue", known: 0, total: 2, at: 4 },
      e: { topic: "history", verdict: "right", q: "akbar", known: 1, total: 1, at: 9 },
    };
    expect(nonsenseOfTheDay(votes).q).toBe("sky blue");
    expect(nonsenseOfTheDay({})).toBeNull();
  });
});

describe("recentVotes ids", () => {
  it("carries the record key as id", () => {
    const rows = recentVotes({ k1: { topic: "history", verdict: "right", at: 1 }, k2: { topic: "other", verdict: "wrong", at: 2 } });
    expect(rows.map((r) => r.id)).toEqual(["k2", "k1"]);
  });
});
