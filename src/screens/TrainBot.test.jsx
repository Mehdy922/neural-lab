import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

let sentValue = null;   // what the mocked useTeamBot reports as the team's already-sent bot
vi.mock("../rooms/hooks.js", () => ({ useTeamBot: () => ({ value: sentValue, loading: false }) }));
const api = { sendBot: vi.fn(() => Promise.resolve()) };
vi.mock("../rooms/api.js", () => ({ sendBot: (...a) => api.sendBot(...a), MAX_BOT_TEXT: 50000, MAX_OWN_TEXT: 6000, MIN_BOT_WORDS: 150 }));

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
  it("lets a teacher with no team train and test but not send", () => {
    render(<TrainBot {...base} isTeacher={true} team={null} />);
    fireEvent.click(screen.getByRole("button", { name: /Cricket/ }));
    fireEvent.click(screen.getByRole("button", { name: /Train my bot/ }));
    const sendBtn = screen.getByRole("button", { name: /Send my bot/ });
    expect(sendBtn.disabled).toBe(true);
    expect(screen.getByText("Only a team can send a bot. You can still train and test one here.")).toBeTruthy();
  });
  it("History alone is long enough to train and actually send (not blocked by the stored-text cap)", async () => {
    render(<TrainBot {...base} />);
    fireEvent.click(screen.getByRole("button", { name: /South Asian history/ }));
    fireEvent.click(screen.getByRole("button", { name: /Train my bot/ }));
    const sendBtn = screen.getByRole("button", { name: /Send my bot to the class/ });
    expect(sendBtn.disabled).toBe(false);
    fireEvent.click(sendBtn);
    await Promise.resolve();
    expect(api.sendBot).toHaveBeenCalledWith(expect.objectContaining({ code: "ABCDE", teamId: "tA", uid: "u1", sources: ["history"] }));
  });
  it("asks before replacing a bot the team already sent, and says who sent it", () => {
    api.sendBot.mockClear();   // earlier cases in this file record sends; this one must see none
    sentValue = { text: "x", sources: ["biology"], sentBy: "u9" };
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<TrainBot {...base} members={{ u9: { name: "Sana", teamId: "tA" } }} />);
    expect(screen.getByText(/sent by Sana/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Cricket/ }));
    fireEvent.click(screen.getByRole("button", { name: /Train my bot/ }));
    fireEvent.click(screen.getByRole("button", { name: /Send my bot/ }));
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringMatching(/already sent .*biology.*Replace it\?/));
    expect(api.sendBot).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
    sentValue = null;
  });
});
