import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("../rooms/hooks.js", () => ({ useTeamBot: () => ({ value: null, loading: false }) }));
const api = { sendBot: vi.fn(() => Promise.resolve()) };
vi.mock("../rooms/api.js", () => ({ sendBot: (...a) => api.sendBot(...a), MAX_BOT_TEXT: 6000, MIN_BOT_WORDS: 150 }));

import { TrainBot } from "./TrainBot.jsx";

const base = { code: "ABCDE", uid: "u1", team: { id: "tA", name: "Aloo" }, isTeacher: false, flash: () => {} };

describe("TrainBot", () => {
  it("needs 150 words before Train enables; a starter text is enough", () => {
    render(<TrainBot {...base} />);
    const train = screen.getByRole("button", { name: /Train my bot/ });
    expect(train.disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Cricket/ }));
    expect(train.disabled).toBe(false);
    fireEvent.click(train);
    expect(screen.getByText(/different words/)).toBeTruthy();
    expect(screen.getByLabelText("Your question")).toBeTruthy();
  });
  it("counts own text and sends the combined text with sources", async () => {
    render(<TrainBot {...base} />);
    fireEvent.change(screen.getByLabelText("Your own text"), { target: { value: "word ".repeat(160) } });
    expect(screen.getByText(/160 words ·/)).toBeTruthy();   // the counter; the Train button also says "160 words"
    expect(screen.getByRole("button", { name: /Train my bot \(160 words\)/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Train my bot/ }));
    fireEvent.click(screen.getByRole("button", { name: /Send my bot to the class/ }));
    await Promise.resolve();
    expect(api.sendBot).toHaveBeenCalledWith(expect.objectContaining({ code: "ABCDE", teamId: "tA", uid: "u1", sources: ["own"] }));
  });
});
