import { describe, it, expect } from "vitest";
import { trainModel, coverage, generate, modelStats } from "./ngram.js";
import { tokenize, isWord } from "./tokenize.js";

const CORPUS = `Akbar ruled the Mughal empire from Agra. Akbar built a new city at Fatehpur Sikri.
The Mughal empire grew under Akbar. Babur founded the Mughal empire after the battle of Panipat.
Shah Jahan built the Taj Mahal at Agra for his wife. Aurangzeb ruled for almost fifty years.
The empire became weak after Aurangzeb died. Traders came to the coast by sea.`;

describe("trainModel", () => {
  const m = trainModel(CORPUS);
  it("counts unigrams, bigrams, trigrams and sentence starts", () => {
    expect(m.order).toBe(3);
    expect(m.uni.akbar).toBe(3);
    expect(m.bi.mughal.empire).toBe(3);
    expect(m.tri["the mughal"].empire).toBe(3);
    expect(m.starts.akbar).toBe(2);
    expect(m.starts.the).toBe(2);
  });
  it("reports stats", () => {
    const s = modelStats(m);
    expect(s.words).toBe(tokenize(CORPUS).filter(isWord).length);
    expect(s.vocab).toBeGreaterThan(30);
  });
});

describe("coverage", () => {
  const m = trainModel(CORPUS);
  it("counts known content words of the question", () => {
    const c = coverage(m, "Who built the Taj Mahal at Agra?");
    expect(c.total).toBe(4);            // built, taj, mahal, agra
    expect(c.known).toBe(4);
  });
  it("reports unknown words for off-topic questions", () => {
    const c = coverage(m, "What is a cell made of?");
    expect(c.total).toBe(2);            // cell, made
    expect(c.known).toBe(0);
    expect(c.unknownWords).toEqual(["cell", "made"]);
  });
});

describe("generate", () => {
  const m = trainModel(CORPUS);
  it("is deterministic for the same question and seed", () => {
    const a = generate(m, "Who was Akbar?", { seed: 0 });
    const b = generate(m, "Who was Akbar?", { seed: 0 });
    expect(a.text).toBe(b.text);
  });
  it("uses only vocabulary words and ends with a full stop", () => {
    for (let seed = 0; seed < 5; seed++) {
      const { text } = generate(m, "What is DNA?", { seed });
      expect(text.length).toBeGreaterThan(0);
      expect(/[.!?]$/.test(text)).toBe(true);
      for (const t of tokenize(text)) if (isWord(t)) expect(m.uni[t], t).toBeDefined();
    }
  });
  it("seeds from the question when it can", () => {
    expect(generate(m, "Tell me about the Mughal empire", { seed: 1 }).seededFrom).toBe("question");
    expect(generate(m, "What is a cell?", { seed: 1 }).seededFrom).toBe("random");
  });
  it("respects the word budget", () => {
    const { words } = generate(m, "Akbar", { seed: 2, maxWords: 12 });
    expect(words).toBeLessThanOrEqual(12);
    expect(words).toBeGreaterThanOrEqual(1);
  });
  it("a different attempt changes the seed input", () => {
    const outs = new Set(Array.from({ length: 6 }, (_, i) => generate(m, "Akbar", { seed: i }).text));
    expect(outs.size).toBeGreaterThan(1);
  });
});

describe("degenerate model", () => {
  it("does not throw on an empty-vocabulary model", () => {
    const empty = trainModel("");
    expect(() => generate(empty, "anything")).not.toThrow();
    expect(generate(empty, "anything")).toEqual({ text: "", seededFrom: "random", words: 0 });
    expect(coverage(empty, "anything").known).toBe(0);
  });
});
