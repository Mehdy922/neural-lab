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

describe("HistoryBot accuracy (the punchline must survive text edits)", () => {
  const model = trainModel(HISTORY_TEXT);
  const QA = [
    ["Who built the Taj Mahal?", /shah jahan|taj mahal|mumtaz/],
    ["When did Pakistan become independent?", /1947|independent/],
    ["Who founded the Muslim League?", /muslim league|1906|dhaka/],
    ["What happened at the battle of Panipat?", /babur|panipat|lodi|1526/],
    ["Who was Akbar?", /akbar|mughal|fatehpur/],
    ["What was the Lahore Resolution?", /lahore resolution|1940|resolution/],
    ["Who is Muhammad Ali Jinnah?", /jinnah|quaid|muslim league|governor/],
    ["Tell me about the Indus Valley", /indus|mohenjo|harappa|cities|drains/],
    ["Who was Ashoka?", /ashoka|maurya|kalinga|buddhism|pillars|edicts/],
    ["What is Taxila famous for?", /taxila|learning|students|gandhara/],
    ["Who was Muhammad bin Qasim?", /qasim|sindh|dahir|712|arab/],
    ["What did Sir Syed Ahmad Khan do?", /aligarh|syed|college|education|1875/],
    ["What happened in 1857?", /1857|uprising|company|rose up|british/],
    ["Who was Ranjit Singh?", /ranjit|sikh|punjab|lahore|maharaja/],
    ["What was the first capital of Pakistan?", /karachi|capital/],
    ["Who built Fatehpur Sikri?", /akbar|fatehpur|sikri/],
    ["Who was Babur?", /babur|timur|panipat|mughal|central asia/],
    ["When was the battle of Plassey?", /plassey|1757|bengal|company/],
    ["What did Allama Iqbal say in 1930?", /iqbal|1930|allahabad|homeland/],
    ["Who was Aurangzeb?", /aurangzeb|1707|1658|deccan|mughal/],
  ];
  it("answers at least 10 of 20 plain history questions on topic (seed 0)", () => {
    const hits = QA.filter(([q, re]) => re.test(generate(model, q, { seed: 0 }).text.toLowerCase()));
    expect(hits.length, `on-topic: ${hits.map(([q]) => q).join(" | ")}`).toBeGreaterThanOrEqual(10);
  });
  it("never opens two different questions with the same stopword phrase", () => {
    const opens = QA.map(([q]) => generate(model, q, { seed: 0 }).text.toLowerCase().split(" ").slice(0, 2).join(" "));
    expect(opens.filter((o) => o === "what is").length).toBe(0);
  });
});
