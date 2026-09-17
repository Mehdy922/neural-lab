import { describe, it, expect } from "vitest";
import { isProjectorSafe, PROJECTOR_DENYLIST } from "./projectorFilter.js";

describe("isProjectorSafe", () => {
  it("hides questions containing a denylisted whole word, case-insensitively", () => {
    expect(isProjectorSafe("who is Allah")).toBe(false);
    expect(isProjectorSafe("WHAT DOES GOD LOOK LIKE?")).toBe(false);
    expect(isProjectorSafe("khuda kaun hai")).toBe(false);
    expect(isProjectorSafe("who is our rasool")).toBe(false);
    expect(isProjectorSafe("is this a good idea")).toBe(true);      // "god" inside "good" is not a word match
    expect(isProjectorSafe("Who founded the Muslim League?")).toBe(true);
    expect(isProjectorSafe("When did Akbar die?")).toBe(true);          // legitimate history must reach the projector
    expect(isProjectorSafe("How did Islam reach Sindh?")).toBe(true);
    expect(isProjectorSafe("")).toBe(true);
  });
  it("matches whole words only, so place names and the history text's own names stay on the projector", () => {
    expect(isProjectorSafe("Where is Bombay?")).toBe(true);           // "bomb" inside "Bombay"
    expect(isProjectorSafe("Is Essex in England?")).toBe(true);        // "sex" inside "Essex"
    expect(isProjectorSafe("Who was Muhammad bin Qasim?")).toBe(true); // bare "muhammad" is deliberately not on the list
  });
  it("exports the list so the teacher notes can describe it", () => {
    expect(PROJECTOR_DENYLIST.length).toBeGreaterThan(10);
  });
});
