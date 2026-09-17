import { describe, it, expect } from "vitest";
import { tokenize, contentWords, detokenize, hashString, STOPWORDS, isWord, isEnd } from "./tokenize.js";

describe("tokenize", () => {
  it("lowercases, keeps words and sentence ends, drops other punctuation", () => {
    expect(tokenize("Akbar ruled; Delhi grew! Did it? Yes.")).toEqual(["akbar", "ruled", "delhi", "grew", "!", "did", "it", "?", "yes", "."]);
  });
  it("keeps apostrophes and digits, normalises curly quotes", () => {
    expect(tokenize("It’s 1947.")).toEqual(["it's", "1947", "."]);
  });
  it("collapses repeated sentence ends", () => {
    expect(tokenize("Why?! Because...")).toEqual(["why", "?", "because", "."]);
  });
  it("isWord / isEnd", () => {
    expect(isWord("akbar")).toBe(true); expect(isWord(".")).toBe(false);
    expect(isEnd("?")).toBe(true); expect(isEnd("akbar")).toBe(false);
  });
});

describe("contentWords", () => {
  it("drops stopwords and duplicates, keeps order", () => {
    expect(contentWords("What is the capital of the Mughal empire?")).toEqual(["capital", "mughal", "empire"]);
    expect(STOPWORDS.has("what")).toBe(true);
    expect(STOPWORDS.has("mughal")).toBe(false);
  });
  it("drops single letters", () => {
    expect(contentWords("a b cell")).toEqual(["cell"]);
  });
});

describe("detokenize", () => {
  it("capitalises sentence starts and attaches punctuation", () => {
    expect(detokenize(["akbar", "ruled", ".", "delhi", "grew", "?"])).toBe("Akbar ruled. Delhi grew?");
  });
  it("handles empty input", () => {
    expect(detokenize([])).toBe("");
  });
});

describe("hashString", () => {
  it("is deterministic and non-negative", () => {
    expect(hashString("akbar")).toBe(hashString("akbar"));
    expect(hashString("akbar")).not.toBe(hashString("babur"));
    expect(hashString("anything")).toBeGreaterThanOrEqual(0);
  });
});
