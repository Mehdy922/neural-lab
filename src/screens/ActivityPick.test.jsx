import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ActivityPick } from "./ActivityPick.jsx";

describe("ActivityPick", () => {
  it("offers both activities", () => {
    const onPick = vi.fn();
    render(<ActivityPick onPick={onPick} />);
    fireEvent.click(screen.getByRole("button", { name: /Teach the machine/ }));
    expect(onPick).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByRole("button", { name: /Talk to the machine/ }));
    expect(onPick).toHaveBeenCalledWith(2);
  });
  it("offers to rejoin the last room", () => {
    const onRejoin = vi.fn();
    render(<ActivityPick onPick={vi.fn()} rejoinCode="ABCDE" onRejoin={onRejoin} />);
    fireEvent.click(screen.getByRole("button", { name: /Rejoin room ABCDE/ }));
    expect(onRejoin).toHaveBeenCalledWith("ABCDE");
    expect(screen.queryByRole("button", { name: /Rejoin room/ })).toBeTruthy();
  });
});
