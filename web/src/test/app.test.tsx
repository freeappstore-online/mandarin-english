import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../App";

describe("App", () => {
  it("renders without crashing", () => {
    render(<App />);
  });

  it("renders bottom navigation with three tabs", () => {
    const { container } = render(<App />);
    const nav = container.querySelector("nav");
    expect(nav).not.toBeNull();
    const buttons = nav!.querySelectorAll("button");
    expect(buttons.length).toBe(3);
    const labels = Array.from(buttons).map((b) => b.textContent?.trim());
    expect(labels).toContain("Phrases");
    expect(labels).toContain("Practice");
    expect(labels).toContain("Settings");
  });
});
