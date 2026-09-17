import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BotChat } from "./BotChat.jsx";
import { trainModel } from "../lm/ngram.js";

const model = trainModel("Akbar ruled the Mughal empire from Agra. Akbar built a new city. The Mughal empire grew under Akbar. Babur founded the Mughal empire. Shah Jahan built the Taj Mahal at Agra.");

describe("BotChat", () => {
  it("requires a topic, then answers with a coverage line", () => {
    const onAsk = vi.fn();
    render(<BotChat model={model} onAsk={onAsk} />);
    fireEvent.change(screen.getByLabelText("Your question"), { target: { value: "Who built the Taj Mahal?" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(screen.getByText(/Pick a topic/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /History/ }));
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(onAsk).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Recognised 3 of 3 words in your question.")).toBeTruthy();
    expect(screen.getByText("Who built the Taj Mahal?")).toBeTruthy();
  });
  it("blocks the next question until the last answer is voted on, then records the vote", () => {
    const onVote = vi.fn();
    render(<BotChat model={model} onVote={onVote} />);
    fireEvent.click(screen.getByRole("button", { name: /Science/ }));
    fireEvent.change(screen.getByLabelText("Your question"), { target: { value: "What is a cell?" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(screen.getByText("Recognised 0 of 1 words in your question.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Your question"), { target: { value: "Another?" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(screen.getByText(/Vote on the last answer first/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Nonsense/ }));
    expect(onVote).toHaveBeenCalledWith(expect.objectContaining({ q: "What is a cell?", topic: "science", verdict: "nonsense" }), "nonsense");
  });
  it("only counts the first vote on an answer; the verdict row is then decided", () => {
    const onVote = vi.fn();
    render(<BotChat model={model} onVote={onVote} />);
    fireEvent.click(screen.getByRole("button", { name: /Science/ }));
    fireEvent.change(screen.getByLabelText("Your question"), { target: { value: "What is a cell?" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    fireEvent.click(screen.getByRole("button", { name: /Right/ }));
    fireEvent.click(screen.getByRole("button", { name: /Wrong/ }));
    expect(onVote).toHaveBeenCalledTimes(1);
    expect(onVote).toHaveBeenCalledWith(expect.objectContaining({ verdict: "right" }), "right");
    expect(screen.getByRole("button", { name: /Right/ }).disabled).toBe(true);
    expect(screen.getByRole("button", { name: /Wrong/ }).disabled).toBe(true);
    expect(screen.getByRole("button", { name: /Nonsense/ }).disabled).toBe(true);
  });
  it("Ask again regenerates and clears the vote; requireVote=false hides votes", () => {
    const onAsk = vi.fn();
    render(<BotChat model={model} requireVote={false} requireTopic={false} onAsk={onAsk} />);
    fireEvent.change(screen.getByLabelText("Your question"), { target: { value: "Akbar" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(screen.queryByRole("button", { name: /Right/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Ask again/ }));
    expect(onAsk).toHaveBeenCalledTimes(2);
    expect(onAsk.mock.calls[1][0].attempt).toBe(1);
  });
});
