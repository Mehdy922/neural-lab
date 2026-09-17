import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { BotChat } from "./BotChat.jsx";
import { trainModel } from "../lm/ngram.js";

const model = trainModel("Akbar ruled the Mughal empire from Agra. Akbar built a new city. The Mughal empire grew under Akbar. Babur founded the Mughal empire. Shah Jahan built the Taj Mahal at Agra.");
const ask = (text) => {
  fireEvent.change(screen.getByLabelText("Your question"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));
};

describe("BotChat", () => {
  it("requires a topic, then answers with a coverage line", () => {
    const onAsk = vi.fn();
    render(<BotChat model={model} onAsk={onAsk} typingMs={0} />);
    ask("Who built the Taj Mahal?");
    expect(screen.getByText(/Pick a topic/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /History/ }));
    ask("Who built the Taj Mahal?");
    expect(onAsk).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Recognised 3 of 3 words in your question.")).toBeTruthy();
    expect(screen.getByText("Who built the Taj Mahal?")).toBeTruthy();
  });
  it("forgets the topic after every question so each one is tagged on purpose", () => {
    render(<BotChat model={model} requireVote={false} typingMs={0} />);
    fireEvent.click(screen.getByRole("button", { name: /History/ }));
    ask("Who was Akbar?");
    ask("What is pizza?");
    expect(screen.getByText(/Pick a topic/)).toBeTruthy();
    expect(screen.queryByText("What is pizza?")).toBeNull();
  });
  it("says so when it recognised none of the words, and hides the line when there are no content words", () => {
    render(<BotChat model={model} requireVote={false} requireTopic={false} typingMs={0} />);
    ask("What is a cell?");
    expect(screen.getByText("It recognised none of your words. It answered anyway.")).toBeTruthy();
    ask("what is 2+2");
    expect(screen.queryByText(/of 0 words/)).toBeNull();
  });
  it("blocks the next question until the last answer is voted on (before asking for a topic), then records the vote", () => {
    const onVote = vi.fn();
    render(<BotChat model={model} onVote={onVote} typingMs={0} />);
    fireEvent.click(screen.getByRole("button", { name: /Science/ }));
    ask("What is a cell?");
    ask("Another?");                                                    // no topic picked: the forgotten vote must surface first
    expect(screen.getByText(/Vote on the last answer first/)).toBeTruthy();
    expect(screen.queryByText(/Pick a topic/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Nonsense/ }));
    expect(onVote).toHaveBeenCalledWith(expect.objectContaining({ q: "What is a cell?", topic: "science", verdict: "nonsense" }), "nonsense");
  });
  it("only counts the first vote on an answer; the verdict row is then decided", () => {
    const onVote = vi.fn();
    render(<BotChat model={model} onVote={onVote} typingMs={0} />);
    fireEvent.click(screen.getByRole("button", { name: /Science/ }));
    ask("What is a cell?");
    fireEvent.click(screen.getByRole("button", { name: /Right/ }));
    fireEvent.click(screen.getByRole("button", { name: /Wrong/ }));
    expect(onVote).toHaveBeenCalledTimes(1);
    expect(onVote).toHaveBeenCalledWith(expect.objectContaining({ verdict: "right" }), "right");
    expect(screen.getByRole("button", { name: /Right/ }).disabled).toBe(true);
  });
  it("Ask again adds a new answer bubble, keeps the old one, and stops after two extra tries", () => {
    const onAsk = vi.fn();
    render(<BotChat model={model} requireVote={false} requireTopic={false} onAsk={onAsk} typingMs={0} />);
    ask("Akbar");
    fireEvent.click(screen.getByRole("button", { name: /Ask again/ }));
    expect(onAsk).toHaveBeenCalledTimes(2);
    expect(onAsk.mock.calls[1][0].attempt).toBe(1);
    expect(screen.getAllByText("Akbar").length).toBe(2);           // both question bubbles remain
    fireEvent.click(screen.getByRole("button", { name: /Ask again/ }));
    expect(onAsk.mock.calls[2][0].attempt).toBe(2);
    expect(screen.queryByRole("button", { name: /Ask again/ })).toBeNull();
  });
  it("shows a typing pause before the answer when typingMs > 0", async () => {
    vi.useFakeTimers();
    try {
      render(<BotChat model={model} requireVote={false} requireTopic={false} typingMs={500} />);
      ask("Akbar");
      expect(screen.getByText(/is typing/)).toBeTruthy();
      expect(screen.getByRole("status").textContent).toMatch(/is typing/);   // announced to screen readers
      await act(async () => { await vi.advanceTimersByTimeAsync(600); });
      expect(screen.queryByText(/is typing/)).toBeNull();
    } finally { vi.useRealTimers(); }
  });
});
