import { describe, it, expect } from "vitest";
import { STARTER_TEXTS, HISTORY_TEXT, getText } from "./index.js";
import { tokenize, isWord } from "../tokenize.js";
import { trainModel, coverage, generate } from "../ngram.js";

const words = (t) => tokenize(t).filter(isWord).length;

describe("starter texts", () => {
  it("has the six texts with ids, titles, emoji and word counts", () => {
    expect(STARTER_TEXTS.map((t) => t.id)).toEqual(["history", "biology", "cricket", "cooking", "space", "folktales"]);
    for (const t of STARTER_TEXTS) {
      expect(t.title.length).toBeGreaterThan(2);
      expect(t.emoji.length).toBeGreaterThan(0);
      expect(t.words).toBe(words(t.text));
    }
  });
  it("meets the length floors", () => {
    expect(words(HISTORY_TEXT)).toBeGreaterThanOrEqual(1800);
    expect(words(HISTORY_TEXT)).toBeLessThanOrEqual(2300);
    for (const t of STARTER_TEXTS.filter((x) => x.id !== "history")) expect(words(t.text), t.id).toBeGreaterThanOrEqual(600);
  });
  it("is plain prose: no quotes, bullets or headings; sentences end with punctuation", () => {
    for (const t of STARTER_TEXTS) {
      expect(t.text, t.id).not.toMatch(/["“”]/);
      expect(t.text, t.id).not.toMatch(/^\s*[-*#]/m);
      expect(t.text.trim(), t.id).toMatch(/[.!?]$/);
    }
  });
  it("getText resolves ids", () => {
    expect(getText("cricket").id).toBe("cricket");
    expect(getText("nope")).toBeUndefined();
  });
});

describe("HistoryBot behaviour", () => {
  const m = trainModel(HISTORY_TEXT);
  it("knows history words and not biology words", () => {
    const hist = coverage(m, "Who built the Taj Mahal and where is Lahore Fort?");
    const bio = coverage(m, "What is a cell made of and how does DNA carry information?");
    expect(hist.known / hist.total).toBeGreaterThanOrEqual(0.6);
    expect(bio.known / bio.total).toBeLessThanOrEqual(0.34);
  });
  it("still answers a biology question, in history words only", () => {
    const { text } = generate(m, "What is a cell made of and how does DNA carry information?", { seed: 0 });
    expect(text.split(" ").length).toBeGreaterThanOrEqual(6);
    for (const t of tokenize(text)) if (isWord(t)) expect(m.uni[t], t).toBeDefined();
  });
  it("seeds from the question for a history question", () => {
    expect(generate(m, "Tell me about Akbar and Fatehpur Sikri", { seed: 0 }).seededFrom).toBe("question");
  });
});
