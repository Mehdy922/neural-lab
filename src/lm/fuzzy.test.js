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

// ── irregular groups ─────────────────────────────────────────────────────────
// Forms no spelling rule can reach. They matter twice over: the word-forms stage runs before the
// typo stage, so a missing group is not only a silent miss — it leaves the typo stage free to
// reach for a wrong real word, which is visible nonsense in front of a class.
describe("a bot reads an irregular form of a word its text really contains", () => {
  const bot = (id) => trainModel(STARTER_TEXTS.find((t) => t.id === id).text);

  // The headline defect. It is fixed one stage earlier than a form table can manage: "better" is
  // an evaluative word, as free of topic as the many/more/most already in STOPWORDS, so it never
  // reaches the typo stage at all rather than being intercepted just before it.
  it("never reads better as batter, on any bot", () => {
    expect(STOPWORDS.has("better")).toBe(true);
    expect(bot("cricket").uni["batter"]).toBeDefined();          // the word it used to land on
    for (const t of STARTER_TEXTS) expect(resolveWord(bot(t.id), "better"), t.id).toBeNull();
  });
  it("reads child as children on the cooking bot, not chili", () => {
    expect(resolveWord(bot("cooking"), "child")).toEqual({ word: "children", how: "stem" });
  });
  it("reads heard as hear on the history bot, not hard", () => {
    expect(resolveWord(history, "heard")).toEqual({ word: "hear", how: "stem" });
  });
  it("reads threw as throw on the cricket bot, not three", () => {
    expect(resolveWord(bot("cricket"), "threw")).toEqual({ word: "throw", how: "stem" });
  });

  // Both directions, because a student types whichever form the question wants while the text
  // holds whichever form its own sentences wanted.
  const PLURALS = [
    ["biology", "child", "children"], ["biology", "tooth", "teeth"], ["biology", "leaf", "leaves"],
    ["space", "man", "men"], ["space", "foot", "feet"], ["folktales", "person", "people"],
    ["cooking", "knives", "knife"], ["cooking", "lives", "life"],
  ];
  it.each(PLURALS)("the %s bot reads %s as %s", (id, typed, read) => {
    expect(resolveWord(bot(id), typed)).toEqual({ word: read, how: "stem" });
  });

  it("links all three of eat, ate and eaten to one another, which a flat past-to-base map could not", () => {
    for (const [a, b] of [["eat", "ate"], ["eat", "eaten"], ["ate", "eat"],
                          ["ate", "eaten"], ["eaten", "eat"], ["eaten", "ate"]]) {
      expect([...wordForms(a)], `${a} should reach ${b}`).toContain(b);
    }
    const cooking = bot("cooking");                  // its text says "eat" and neither other form
    expect(cooking.uni["ate"]).toBeUndefined();
    expect(cooking.uni["eaten"]).toBeUndefined();
    expect(resolveWord(cooking, "ate")?.word).toBe("eat");
    expect(resolveWord(cooking, "eaten")?.word).toBe("eat");
  });

  it("keeps its three-letter members, which the stem floor would otherwise cut", () => {
    for (const [word, form] of [["see", "saw"], ["men", "man"], ["ate", "eat"], ["sat", "sit"], ["pay", "paid"]]) {
      expect([...wordForms(word)], word).toContain(form);
    }
  });

  // Evaluative comparatives carry no topic signal at all — "which is better" is the shape of a
  // question about anything whatever — so they belong beside many/more/most in STOPWORDS rather
  // than in this table. Keeping them out is what keeps "It recognised none of your words" intact
  // for a question whose topic words are all foreign.
  it("treats the comparatives as stopwords instead of as word forms", () => {
    for (const w of ["good", "better", "best", "bad", "worse", "worst", "little", "less", "least"]) {
      expect(STOPWORDS.has(w), w).toBe(true);
    }
    expect([...wordForms("good")]).not.toContain("better");
    expect([...wordForms("better")]).not.toContain("good");
    expect([...wordForms("little")]).not.toContain("less");
    // the history text really says "best", and that is still not a way in for "better" or "good"
    expect(history.uni["best"]).toBeDefined();
    expect(resolveWord(history, "better")).toBeNull();
    expect(resolveWord(history, "good")).toBeNull();
  });


  // The invariant, at the level of the new table. A group is only ever a bridge between forms of a
  // word the text really holds; with no member in the text, every member stays foreign.
  it("resolves nothing when the text holds no member of the group", () => {
    for (const [id, w] of [["history", "geese"], ["history", "wolves"], ["history", "mice"],
                           ["history", "swum"], ["cricket", "tomatoes"], ["cricket", "loaves"],
                           ["cricket", "heroes"], ["biology", "potatoes"]]) {
      expect(resolveWord(bot(id), w), `${id}: ${w} must stay unrecognised`).toBeNull();
    }
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
  it("allows a length difference of at most one, which at cap 1 is a fast path and nothing more", () => {
    // Two words whose lengths differ by more than 1 are already more than one edit apart, so
    // editDistance rejects them on its own. The clause only saves the walk. These assert the
    // half it does decide: one letter shorter and one letter longer both still reach "delhi".
    expect(resolveWord(m, "delh")?.word).toBe("delhi");          // 4 letters, one short
    expect(resolveWord(m, "delhii")?.word).toBe("delhi");        // 6 letters, one long
    expect(editDistance("del", "delhi", 1)).toBeGreaterThan(1);  // 2 apart: the cap rejects it anyway
  });
  it("allows exactly one edit, at every length", () => {
    expect(resolveWord(m, "capitol")?.word).toBe("capital");       // 7 letters, 1 edit
    expect(resolveWord(m, "capetol")).toBeNull();                  // 7 letters, 2 edits
    expect(resolveWord(m, "emperers")?.word).toBe("emperors");     // 8 letters, 1 edit
    expect(resolveWord(m, "emparers")).toBeNull();                 // 8 letters, 2 edits: a longer word buys no slack
    expect(resolveWord(m, "sultanete")?.word).toBe("sultanate");   // 9 letters, 1 edit
    expect(resolveWord(m, "sultenete")).toBeNull();                // 9 letters, 2 edits
  });
  it("does not stretch a long real word onto a different long real word", () => {
    // "happened" is two edits from "hardened" and every one of the 15 measured ESL errors is a
    // single edit, so two edits bought nothing and cost the student a rewritten question.
    const h = trainModel("This system of groups later hardened into castes.");
    expect(editDistance("happened", "hardened", 2)).toBe(2);
    expect(resolveWord(h, "happened")).toBeNull();
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
// Words from another world entirely. These catch a matcher that has gone broadly wrong.
const OFF_TOPIC = [
  "biryani", "photosynthesis", "ronaldo", "minecraft", "bitcoin", "tiktok", "algebra", "dinosaur",
  "pizza", "burger", "volcano", "python", "homework", "molecule", "neuron", "gravity", "momentum",
  "chemistry", "messi", "football", "planet", "galaxy", "oxygen", "physics", "earthquake", "guitar",
  "elephant", "samosa", "youtube", "whatsapp", "helicopter", "vaccine", "telescope", "keyboard",
];
// Words that sit one edit from a word these texts really contain, and are held out by a single
// guard each. Without them the sweep passes with the first-character guard or the four-letter
// floor deleted, which a mutation run proved. Each is noted with the guard it pins:
//   cell  -> fell/well        mood -> food/good        coal -> goal        worth -> north
//   mars  -> wars             (first character)
//   whr   -> war/why/who      now  -> no/new/not       (four-letter floor)
const NEAR_MISS = ["cell", "mars", "mood", "coal", "worth", "whr", "now"];
const FOREIGN = [...OFF_TOPIC, ...NEAR_MISS];

// Words from that list that genuinely appear in a given starter text, so of course they resolve.
const IN_TEXT = {
  history: ["now"],
  biology: ["photosynthesis", "molecule", "oxygen", "cell"],
  cooking: ["biryani"],
  space: ["gravity", "planet", "telescope", "mars"],
};
// An everyday plural of a word that genuinely appears: the space text says "galaxies".
const INFLECTION_OF_AN_IN_TEXT_WORD = { space: { galaxy: "galaxies" } };
// Accepted false positives: short real words one edit from a different real word the text contains.
// This is a class, not a list of freaks — on short words one edit from a vocabulary word the rate
// runs at a few per cent, and these are the instances this particular sample happens to expose.
// Accepted on purpose: tightening the thresholds to kill them also kills britsh->british,
// rulled->ruled and mahel->mahal, which were measured. The sweep's job is to notice a NEW one.
const DOCUMENTED_FALSE_POSITIVE = {
  biology: { planet: "plant" },
  cricket: { mars: "mark" },
  space: { mood: "moon" },
};

describe("words outside the text stay unrecognised (all six starter texts)", () => {
  it("uses a list of at least 20 clearly foreign words, plus near misses that pin the guards", () => {
    expect(OFF_TOPIC.length).toBeGreaterThanOrEqual(20);
    expect(new Set(FOREIGN).size).toBe(FOREIGN.length);
    for (const w of ["biryani", "photosynthesis", "ronaldo", "minecraft", "bitcoin", "tiktok", "algebra", "dinosaur"]) expect(OFF_TOPIC).toContain(w);
    for (const w of NEAR_MISS) expect(FOREIGN).toContain(w);
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

  it("leaks exactly the four measured words across all six texts, and no others", () => {
    const leaks = [];
    for (const t of STARTER_TEXTS) {
      const m = trainModel(t.text);
      for (const w of FOREIGN) {
        if (m.uni[w]) continue;                         // genuinely in this text
        const r = resolveWord(m, w);
        if (r) leaks.push(`${t.id}: ${w} -> ${r.word} (${r.how})`);
      }
    }
    expect(leaks.sort()).toEqual([
      "biology: planet -> plant (fuzzy)",      // accepted: short real words one edit apart
      "cricket: mars -> mark (fuzzy)",         // accepted: same class
      "space: galaxy -> galaxies (stem)",      // not a leak: a correct plural of "galaxies", which is in the text
      "space: mood -> moon (fuzzy)",           // accepted: same class
    ]);
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
  // The original question, back to recognising none of its words. "better" is a stopword now, so
  // it drops out of the question alongside "is" and "than" rather than counting as a word the bot
  // failed on: known is 0 again, and total is 3 rather than the 4 this test once asserted.
  it("still recognises nothing in a question made of foreign words", () => {
    const c = coverage(history, "Is biryani better than pizza or a samosa?");
    expect(c.known).toBe(0);
    expect(c.total).toBe(3);                         // biryani, pizza, samosa: "better" is a stopword
    expect(c.corrections).toEqual([]);
    expect(c.unknownWords).toEqual(["biryani", "pizza", "samosa"]);
  });
  it("counts a foreign adjective it has no opinion about, rather than dropping it", () => {
    const c = coverage(history, "Is biryani tastier than pizza or a samosa?");
    expect(c.known).toBe(0);
    expect(c.total).toBe(4);                         // "tastier" is not a stopword, so it is counted
    expect(c.corrections).toEqual([]);
    expect(c.unknownWords).toEqual(["biryani", "tastier", "pizza", "samosa"]);
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
    expect(c.total).toBe(2);                       // biryani, pizza: "wich" reads as "with", "better" is a stopword
    expect(c.corrections).toEqual([]);
  });
  it("counts a foreign adjective, and still recognises none of the words", () => {
    const c = coverage(history, "Wich is tastier, biryani or pizza?");
    expect(c.known).toBe(0);
    expect(c.total).toBe(3);                       // tastier, biryani, pizza
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

// ── a different year is a different question ─────────────────────────────────
describe("numbers are matched by exact spelling only", () => {
  it("never reads one year as another", () => {
    expect(history.uni["1947"]).toBeDefined();
    expect(resolveWord(history, "1947")).toEqual({ word: "1947", how: "exact" });
    expect(resolveWord(history, "1948")).toBeNull();     // one edit from 1947 and from 1940, and neither is meant
    expect(resolveWord(history, "1949")).toBeNull();
    expect(resolveWord(history, "1906")).toEqual({ word: "1906", how: "exact" });
    expect(resolveWord(history, "1907")).toBeNull();
  });
  it("tells the student the year was not recognised rather than answering a different one", () => {
    const c = coverage(history, "What happened in 1948?");
    expect(c.total).toBe(2);                             // happened, 1948 ("what" and "in" are stopwords)
    expect(c.known).toBe(0);
    expect(c.unknownWords).toEqual(["happened", "1948"]);
    expect(c.corrections).toEqual([]);
  });
  it("still recognises a year the text really contains", () => {
    const c = coverage(history, "What happened in 1947?");
    expect(c.total).toBe(2);
    expect(c.known).toBe(1);
    expect(c.knownWords).toEqual(["1947"]);
    expect(c.corrections).toEqual([]);
  });
  it("does not seed an answer from a year the text has never read", () => {
    const m = trainModel("Pakistan became independent in 1947. The country was new.");
    expect(resolveWord(m, "1948")).toBeNull();
    expect(generate(m, "1948", { seed: 0 }).seededFrom).toBe("random");
    expect(generate(m, "1947", { seed: 0 }).seededFrom).toBe("question");
  });
});

// ── a stem key must be a word, not a fragment ────────────────────────────────
describe("two-letter fragments are not indexed as stems", () => {
  it("does not put a fragment of a vocabulary word into the index", () => {
    expect([...wordForms("used")]).not.toContain("us");    // "-ed" stripped twice over leaves a fragment
    expect([...wordForms("died")]).toContain("die");       // three letters: a real word, still indexed
    expect([...wordForms("fled")]).not.toContain("fl");
  });
  it("does not read us as used", () => {
    expect(resolveWord(history, "us")).toBeNull();
  });
  it("keeps the climax line on the most natural thing a class types", () => {
    const c = coverage(history, "Tell us about biryani");
    expect(c.total).toBe(1);                               // biryani alone: "us" is a stopword
    expect(c.known).toBe(0);
    expect(c.corrections).toEqual([]);
  });
  it("still resolves every stem that matters", () => {
    expect(resolveWord(history, "die")).toEqual({ word: "died", how: "stem" });
    expect(resolveWord(history, "mughals")).toEqual({ word: "mughal", how: "stem" });
  });
});

describe("us is a pronoun, in every text", () => {
  it("is a stopword, so it carries no topic signal anywhere", () => {
    expect(STOPWORDS.has("us")).toBe(true);
  });
  it("is dropped even by a bot whose text really contains the word", () => {
    const space = trainModel(STARTER_TEXTS.find((t) => t.id === "space").text);
    expect(space.uni["us"]).toBeDefined();          // the space text does say "us"
    const c = coverage(space, "Tell us about Ronaldo");
    expect(c.total).toBe(1);                        // ronaldo alone
    expect(c.known).toBe(0);
    expect(c.corrections).toEqual([]);
  });
});
