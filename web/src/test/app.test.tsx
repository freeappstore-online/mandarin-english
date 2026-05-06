import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../App";
import { Shell } from "../components/Shell";

describe("App", () => {
  it("renders without crashing", () => {
    render(<App />);
  });

  it("Shell component renders with FreeAppStore link", () => {
    render(<Shell>content</Shell>);
    const link = screen.getByRole("link", { name: /freeappstore/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://freeappstore.online");
  });

  it("contains the sidebar on desktop layout", () => {
    const { container } = render(<App />);
    const aside = container.querySelector("aside");
    expect(aside).toBeInTheDocument();
  });
});
