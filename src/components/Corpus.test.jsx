import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Corpus } from "./Corpus.jsx";

describe("Corpus", () => {
  it("renders the text and highlights the given words case-insensitively", () => {
    render(<Corpus text={"Akbar ruled from Agra.\n\nBabur founded the empire."} highlight={["agra", "babur"]} />);
    const marks = screen.getAllByText((_, el) => el.tagName === "MARK");
    expect(marks.map((m) => m.textContent)).toEqual(["Agra", "Babur"]);
    expect(screen.getByText(/ruled from/)).toBeTruthy();
  });
  it("compact mode drops the scroll box and uses columns for the projector", () => {
    const { container } = render(<Corpus text={"One two.\n\nThree four."} compact />);
    const box = container.firstChild;
    expect(box.style.maxHeight).toBe("none");
    expect(box.style.columnCount).toBe("5");
  });
});
