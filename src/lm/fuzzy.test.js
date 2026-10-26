// Forgiving word matching. Students type English on phones; a misspelling must not make an
// in-text topic look out-of-text. The one thing that must not break: a word genuinely outside a
// bot's text stays unrecognised, so the hallucination beat survives.
import { describe, it, expect } from "vitest";
import { trainModel, coverage, generate, resolveWord } from "./ngram.js";
import { wordForms, editDistance, STOPWORDS, tokenize, isWord } from "./tokenize.js";
import { STARTER_TEXTS, HISTORY_TEXT } from "./texts/index.js";

const history = trainModel(HISTORY_TEXT);

describe("editDistance (Damerau-Levenshtein)", () => {
  it("counts a transposition as one edit, not two", () => {
    expect(editDistance("dehli", "delhi", 2)).toBe(1);   // the single most common typo class
    expect(editDistance("biult", "built", 2)).toBe(1);
  });
  it("counts substitutions, insertions and deletions", () => {
    expect(editDistance("akber", "akbar", 2)).toBe(1);
    expect(editDistance("britsh", "british", 2)).toBe(1);
    expect(editDistance("delhli", "delhi", 2)).toBe(1);
    expect(editDistance("delhi", "delhi", 2)).toBe(0);
  });
  it("gives up past the cap instead of counting on", () => {
    expect(editDistance("biryani", "britain", 1)).toBeGreaterThan(1);
    expect(editDistance("abcd", "wxyz", 2)).toBeGreaterThan(2);
  });
});

describe("wordForms", () => {
  it("covers the everyday endings a student types", () => {
    expect([...wordForms("mughals")]).toContain("mughal");
    expect([...wordForms("indias")]).toContain("india");
    expect([...wordForms("cities")]).toContain("city");
    expect([...wordForms("wishes")]).toContain("wish");
    expect([...wordForms("ruled")]).toContain("rule");
    expect([...wordForms("died")]).toContain("die");
    expect([...wordForms("ruling")]).toContain("rule");
    expect([...wordForms("akbar's")]).toContain("akbar");
  });
  it("covers irregular verbs in both directions", () => {
    expect([...wordForms("built")]).toContain("build");
    expect([...wordForms("build")]).toContain("built");
    expect([...wordForms("fight")]).toContain("fought");
    expect([...wordForms("fought")]).toContain("fight");
  });
  it("always includes the word itself", () => {
    expect([...wordForms("delhi")]).toContain("delhi");
  });
});

describe("resolveWord against the history text", () => {
  // The 15 realistic ESL errors measured against this text by the validated prototype.
  const ESL = [
    ["mahel", "mahal", "fuzzy"], ["biult", "built", "fuzzy"], ["dehli", "delhi", "fuzzy"],
    ["delhli", "delhi", "fuzzy"], ["akber", "akbar", "fuzzy"], ["mughul", "mughal", "fuzzy"],
    ["mughals", "mughal", "stem"], ["die", "died", "stem"], ["emperers", "emperors", "fuzzy"],
    ["britsh", "british", "fuzzy"], ["capitol", "capital", "fuzzy"], ["indias", "india", "stem"],
    ["rulled", "ruled", "fuzzy"], ["build", "built", "stem"], ["fight", "fought", "stem"],
  ];
  it.each(ESL)("reads %s as %s (%s)", (typed, read, how) => {
    expect(resolveWord(history, typed)).toEqual({ word: read, how });
  });
  it("resolves all 15 of them", () => {
    expect(ESL.filter(([typed, read]) => resolveWord(history, typed)?.word === read).length).toBe(15);
  });
  it("returns the word itself, marked exact, when it is really in the text", () => {
    expect(resolveWord(history, "akbar")).toEqual({ word: "akbar", how: "exact" });
    expect(resolveWord(history, "taj")).toEqual({ word: "taj", how: "exact" });
  });
});

describe("resolveWord guards (the thresholds the prototype measured)", () => {
  const m = trainModel("Delhi became the capital city of the sultanate in the north. The emperors ruled from Agra.");
  it("does not fuzzy-match words shorter than four letters", () => {
    expect(resolveWord(m, "del")).toBeNull();        // one edit from "delhi" would be too loose at this length
    expect(resolveWord(m, "agr")).toBeNull();
  });
  it("requires the same first letter", () => {
    expect(resolveWord(m, "felhi")).toBeNull();      // one edit from "delhi", but the first letter differs
  });
  it("allows a length difference of at most one", () => {
    expect(resolveWord(m, "delh")?.word).toBe("delhi");
    expect(resolveWord(m, "del")).toBeNull();
  });
  it("allows one edit up to seven letters and two from eight", () => {
    expect(resolveWord(m, "capitol")?.word).toBe("capital");       // 7 letters, 1 edit
    expect(resolveWord(m, "capetol")).toBeNull();                  // 7 letters, 2 edits: past the cap
    expect(resolveWord(m, "emperers")?.word).toBe("emperors");     // 8 letters, 1 edit
    expect(resolveWord(m, "emparers")?.word).toBe("emperors");     // 8 letters, 2 edits: still inside the cap
  });
  it("returns null for a word it cannot reach", () => {
    expect(resolveWord(m, "biryani")).toBeNull();
  });
});

describe("stopwords are matched by exact spelling only", () => {
  const m = trainModel("There were emperors in the north. The city of Delhi was their capital.");
  it("never stems or fuzzes a stopword", () => {
    expect(STOPWORDS.has("these")).toBe(true);
    expect(editDistance("these", "there", 1)).toBe(1);   // one edit apart, and "there" is in the text
    expect(resolveWord(m, "these")).toBeNull();          // but a stopword carries no topic signal, so it is not matched
    expect(STOPWORDS.has("them")).toBe(true);
    expect(resolveWord(m, "them")).toBeNull();           // would otherwise reach "then"/"their"
  });
  it("still matches a stopword that really is in the text", () => {
    expect(resolveWord(m, "the")).toEqual({ word: "the", how: "exact" });
    expect(resolveWord(m, "their")).toEqual({ word: "their", how: "exact" });
  });
  it("still matches content words in the same text", () => {
    expect(resolveWord(m, "emperers")?.word).toBe("emperors");
  });
});

// ── the invariant ────────────────────────────────────────────────────────────
// A word genuinely outside a bot's text must stay unrecognised. The lesson's climax is a bot
// answering a question whose every word it failed to recognise.
const FOREIGN = [
  "biryani", "photosynthesis", "ronaldo", "minecraft", "bitcoin", "tiktok", "algebra", "dinosaur",
  "pizza", "burger", "volcano", "python", "homework", "molecule", "neuron", "gravity", "momentum",
  "chemistry", "messi", "football", "planet", "galaxy", "oxygen", "physics", "earthquake", "guitar",
  "elephant", "samosa", "youtube", "whatsapp", "helicopter", "vaccine", "telescope", "keyboard",
];
// Words from that list that genuinely appear in a given starter text, so of course they resolve.
const IN_TEXT = { biology: ["photosynthesis", "molecule", "oxygen"], cooking: ["biryani"], space: ["gravity", "planet", "telescope"] };
// An everyday plural of a word that genuinely appears: the space text says "galaxies".
const INFLECTION_OF_AN_IN_TEXT_WORD = { space: { galaxy: "galaxies" } };
// The one measured false positive across 34 words x 6 texts: two real words one edit apart.
// Accepted on purpose — tightening the thresholds to kill it also kills britsh->british and rulled->ruled.
const DOCUMENTED_FALSE_POSITIVE = { biology: { planet: "plant" } };

describe("words outside the text stay unrecognised (all six starter texts)", () => {
  it("uses a list of at least 20 clearly foreign words", () => {
    expect(FOREIGN.length).toBeGreaterThanOrEqual(20);
    expect(new Set(FOREIGN).size).toBe(FOREIGN.length);
    for (const w of ["biryani", "photosynthesis", "ronaldo", "minecraft", "bitcoin", "tiktok", "algebra", "dinosaur"]) expect(FOREIGN).toContain(w);
  });

  it.each(STARTER_TEXTS.map((t) => [t.id, t]))("%s", (id, t) => {
    const m = trainModel(t.text);
    for (const w of FOREIGN) {
      const inText = IN_TEXT[id]?.includes(w);
      const inflected = INFLECTION_OF_AN_IN_TEXT_WORD[id]?.[w];
      const falsePositive = DOCUMENTED_FALSE_POSITIVE[id]?.[w];
      if (inText) {
        expect(m.uni[w], `${id}: ${w} was listed as in-text`).toBeDefined();
        expect(resolveWord(m, w), `${id}: ${w}`).toEqual({ word: w, how: "exact" });
      } else if (inflected) {
        expect(m.uni[inflected], `${id}: ${inflected} was listed as in-text`).toBeDefined();
        expect(resolveWord(m, w)?.word, `${id}: ${w}`).toBe(inflected);
      } else if (falsePositive) {
        expect(resolveWord(m, w)?.word, `${id}: ${w}`).toBe(falsePositive);
      } else {
        expect(resolveWord(m, w), `${id}: ${w} must stay unrecognised`).toBeNull();
      }
    }
  });

  it("leaks exactly the two measured words across all six texts, and no others", () => {
    const leaks = [];
    for (const t of STARTER_TEXTS) {
      const m = trainModel(t.text);
      for (const w of FOREIGN) {
        if (m.uni[w]) continue;                         // genuinely in this text
        const r = resolveWord(m, w);
        if (r) leaks.push(`${t.id}: ${w} -> ${r.word} (${r.how})`);
      }
    }
    expect(leaks.sort()).toEqual(["biology: planet -> plant (fuzzy)", "space: galaxy -> galaxies (stem)"]);
  });

  it("recognises none of the words of a plainly off-text question", () => {
    for (const w of ["biryani", "ronaldo", "minecraft"]) expect(resolveWord(history, w), w).toBeNull();
  });
});

describe("coverage counts a corrected word as recognised", () => {
  it("counts a typo as known and says what it read instead", () => {
    const c = coverage(history, "Who built the Taj Mahel?");
    expect(c.total).toBe(3);                               // built, taj, mahel
    expect(c.known).toBe(3);
    expect(c.corrections).toEqual([{ typed: "mahel", read: "mahal" }]);
  });
  it("reports every correction, in the order they were typed", () => {
    const c = coverage(history, "Did the Mughals rule Dehli and Agra?");
    expect(c.known).toBe(c.total);
    expect(c.corrections).toEqual([{ typed: "mughals", read: "mughal" }, { typed: "dehli", read: "delhi" }]);
  });
  it("reports no corrections when every word was spelled right", () => {
    const c = coverage(history, "Who built the Taj Mahal at Agra?");
    expect(c.known).toBe(4);
    expect(c.corrections).toEqual([]);
  });
  it("hands back the words the bot actually read, so they can be highlighted in its text", () => {
    const c = coverage(history, "Who built the Taj Mahel?");
    expect(c.knownWords).toEqual(["built", "taj", "mahal"]);
    expect(c.unknownWords).toEqual([]);
  });
  it("still recognises nothing in a question made of foreign words", () => {
    const c = coverage(history, "Is biryani better than pizza or a samosa?");
    expect(c.known).toBe(0);
    expect(c.total).toBe(4);
    expect(c.corrections).toEqual([]);
    expect(c.unknownWords).toEqual(["biryani", "better", "pizza", "samosa"]);
  });
  it("is quiet on an empty model", () => {
    const empty = trainModel("");
    expect(coverage(empty, "anything")).toEqual({ known: 0, total: 1, knownWords: [], unknownWords: ["anything"], corrections: [] });
  });
});

describe("generate seeds from the corrected word", () => {
  // One sentence per start, and one continuation at every step, so the answer is fixed once the
  // seed word is. That is the point: if resolution never reached the generator, "Dehli" would fall
  // through to a random sentence start instead.
  const TINY = "Mughal rulers made Delhi their capital city for many long years. Agra was a quiet town beside a wide river.";
  const m = trainModel(TINY);
  it("answers a misspelled question exactly as it answers the spelled one", () => {
    const typo = generate(m, "Who ruled Dehli?", { seed: 0 });
    const spelled = generate(m, "Who ruled Delhi?", { seed: 0 });
    expect(spelled.seededFrom).toBe("question");
    expect(typo.seededFrom).toBe("question");            // not "random": the correction reached the generator
    expect(typo.text).toBe(spelled.text);
    expect(typo.text.toLowerCase().startsWith("delhi their capital")).toBe(true);
  });
  it("seeds from a corrected word in the bigram pair scan too", () => {
    const { text, seededFrom } = generate(m, "Tell me about the Mughul rulers", { seed: 0 });
    expect(seededFrom).toBe("question");
    expect(text.toLowerCase().startsWith("mughal rulers")).toBe(true);
  });
  it("leaves a question of foreign words alone", () => {
    expect(generate(m, "What is biryani?", { seed: 0 }).seededFrom).toBe("random");
  });
  it("passes stopwords through unchanged", () => {
    // "these" is one edit from "their", which is in this text, but stopwords are never corrected,
    // so no "these ..." pair can be invented for the seed.
    const { seededFrom } = generate(trainModel("Their capital was Delhi."), "Were these capital?", { seed: 0 });
    expect(seededFrom).toBe("question");                 // from "capital" alone, not from a "these capital" pair
  });
  it("answers a real history question the same way whether or not the name is spelled right", () => {
    const a = generate(history, "Who built the Taj Mahel?", { seed: 0 });
    const b = generate(history, "Who built the Taj Mahal?", { seed: 0 });
    expect(a.seededFrom).toBe("question");
    const opening = (s) => tokenize(s).filter(isWord).slice(0, 2);
    expect(opening(a.text)).toEqual(opening(b.text));    // the same seed pair, so the bot used the correction
    expect(opening(a.text)).toEqual(["taj", "mahal"]);
  });
});

// ── a word that reads as a stopword is a stopword ────────────────────────────
// A misspelled stopword is not itself in STOPWORDS, so it reaches the matcher as a content word
// and could land on a stopword of the text. It carries no topic signal either way, so it drops out
// of the question's words entirely rather than counting as recognised.
describe("a word that reads as a stopword carries no topic signal", () => {
  it("still reports what the matcher found, so the policy is visible in one place", () => {
    expect(resolveWord(history, "whta")).toEqual({ word: "what", how: "fuzzy" });
    expect(STOPWORDS.has("what")).toBe(true);
  });
  it("drops out of the question's words instead of counting as known", () => {
    const c = coverage(history, "Whta is photosynthesis?");
    expect(c.total).toBe(1);                       // photosynthesis alone: "whta" reads as "what"
    expect(c.known).toBe(0);
    expect(c.unknownWords).toEqual(["photosynthesis"]);
    expect(c.corrections).toEqual([]);             // nothing worth telling a student about
  });
  it("leaves the climax intact when every real word is foreign", () => {
    const c = coverage(history, "Wich is better, biryani or pizza?");
    expect(c.known).toBe(0);                       // the line must still read "It recognised none of your words"
    expect(c.total).toBe(3);                       // better, biryani, pizza
    expect(c.corrections).toEqual([]);
  });
  it("never seeds the generator from a misspelled stopword", () => {
    const m = trainModel("Delhi was the capital. The king ruled with care.");
    expect(resolveWord(m, "wich")).toEqual({ word: "with", how: "fuzzy" });
    const { text, seededFrom } = generate(m, "Wich care?", { seed: 0 });
    expect(text.toLowerCase().startsWith("with")).toBe(false);   // no invented "with care" pair
    expect(seededFrom).toBe("question");
    expect(text.toLowerCase().startsWith("care")).toBe(true);    // seeded from the one real word
  });
  it("still recognises a real content word in the same question", () => {
    const c = coverage(history, "Wich emperers ruled Dehli?");
    expect(c.total).toBe(3);                       // emperers, ruled, dehli
    expect(c.known).toBe(3);
    expect(c.corrections).toEqual([{ typed: "emperers", read: "emperors" }, { typed: "dehli", read: "delhi" }]);
  });
});
