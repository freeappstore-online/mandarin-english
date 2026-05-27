import { render, screen, fireEvent, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "../App";
import { STORAGE_KEY, TAB_KEY, CONTRAST_KEY, FONT_SCALE_KEY } from "../storage";

beforeEach(() => { localStorage.clear(); });
afterEach(() => {
  document.documentElement.removeAttribute("data-contrast");
  document.documentElement.style.fontSize = "";
});

function getBottomNav() {
  const nav = document.querySelector("nav");
  if (!nav) throw new Error("nav not found");
  return nav;
}

describe("App rendering", () => {
  it("renders without crashing", () => {
    render(<App />);
  });

  it("renders bottom navigation with three tabs", () => {
    render(<App />);
    const nav = getBottomNav();
    const buttons = nav.querySelectorAll("button");
    expect(buttons.length).toBe(3);
    expect(Array.from(buttons).map((b) => b.getAttribute("aria-label"))).toEqual(["Phrases", "Practice", "Settings"]);
  });

  it("marks active tab with aria-current=page", () => {
    render(<App />);
    const active = document.querySelector('[aria-current="page"]');
    expect(active).not.toBeNull();
    expect(active!.getAttribute("aria-label")).toBe("Phrases");
  });
});

describe("Tab navigation", () => {
  it("switching tabs persists to localStorage", () => {
    render(<App />);
    const nav = getBottomNav();
    const settingsBtn = within(nav).getByRole("button", { name: "Settings" });
    fireEvent.click(settingsBtn);
    expect(localStorage.getItem(TAB_KEY)).toBe("settings");
  });

  it("restores last tab on mount", () => {
    localStorage.setItem(TAB_KEY, "settings");
    render(<App />);
    expect(screen.getByRole("heading", { name: /settings/i })).toBeInTheDocument();
  });
});

describe("Add phrase flow", () => {
  it("add form starts collapsed", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: /\+ add phrase/i })).toBeInTheDocument();
    expect(screen.queryByText(/what you'll say/i)).not.toBeInTheDocument();
  });

  it("expanding the add form reveals input fields", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /\+ add phrase/i }));
    expect(screen.getByText(/what you'll say/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });
});

describe("Contrast setting", () => {
  it("normal contrast does not set data-contrast", () => {
    render(<App />);
    expect(document.documentElement.hasAttribute("data-contrast")).toBe(false);
  });

  it("selecting high sets data-contrast=high and persists", () => {
    render(<App />);
    fireEvent.click(within(getBottomNav()).getByRole("button", { name: "Settings" }));
    fireEvent.click(screen.getByRole("button", { name: /^high$/i }));
    expect(document.documentElement.getAttribute("data-contrast")).toBe("high");
    expect(localStorage.getItem(CONTRAST_KEY)).toBe("high");
  });

  it("selecting max sets data-contrast=max", () => {
    render(<App />);
    fireEvent.click(within(getBottomNav()).getByRole("button", { name: "Settings" }));
    fireEvent.click(screen.getByRole("button", { name: /^max$/i }));
    expect(document.documentElement.getAttribute("data-contrast")).toBe("max");
  });

  it("restores stored contrast on mount", () => {
    localStorage.setItem(CONTRAST_KEY, "high");
    render(<App />);
    expect(document.documentElement.getAttribute("data-contrast")).toBe("high");
  });
});

describe("Font size setting", () => {
  it("default font scale leaves root font-size empty", () => {
    render(<App />);
    expect(document.documentElement.style.fontSize).toBe("");
  });

  it("non-default scale sets root font-size in px", () => {
    localStorage.setItem(FONT_SCALE_KEY, "1.3");
    render(<App />);
    expect(document.documentElement.style.fontSize).toBe(`${16 * 1.3}px`);
  });
});

describe("Pair switcher", () => {
  it("clicking the other pair switches form labels", () => {
    render(<App />);
    // Initial pair is English→Mandarin. Open the form.
    fireEvent.click(screen.getByRole("button", { name: /\+ add phrase/i }));
    expect(screen.getByText(/Mandarin \(what you'll say\)/i)).toBeInTheDocument();
    // Switch pair via the pair bar.
    const pairBar = screen.getByRole("button", { name: "Mandarin → English" });
    fireEvent.click(pairBar);
    // After switch the form is collapsed again (key-based remount).
    fireEvent.click(screen.getByRole("button", { name: /\+ add phrase/i }));
    expect(screen.getByText(/English \(what you'll say\)/i)).toBeInTheDocument();
  });
});

describe("Storage on add", () => {
  it("adding a phrase writes to localStorage with full payload", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /\+ add phrase/i }));
    const inputs = document.querySelectorAll("form input");
    // inputs order: target, native, pronunciation, topic
    fireEvent.change(inputs[0]!, { target: { value: "谢谢" } });
    fireEvent.change(inputs[1]!, { target: { value: "Thank you" } });
    fireEvent.change(inputs[3]!, { target: { value: "polite" } });
    fireEvent.click(screen.getByRole("button", { name: /^add phrase$/i }));
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    const added = stored.find((p: { target: string }) => p.target === "谢谢");
    expect(added).toBeDefined();
    expect(added.native).toBe("Thank you");
    expect(added.topic).toBe("polite");
    expect(added.practiced).toBe(false);
  });
});
