import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const web = resolve(__dirname, "../..");
const root = resolve(web, "..");

function read(relativeTo: string, filePath: string): string {
  return readFileSync(resolve(relativeTo, filePath), "utf-8");
}

describe("CSS compliance", () => {
  const css = read(web, "src/index.css");

  it("contains --paper, --ink, --accent CSS variables", () => {
    expect(css).toContain("--paper");
    expect(css).toContain("--ink");
    expect(css).toContain("--accent");
  });

  it("contains prefers-color-scheme or data-theme (dark mode)", () => {
    const hasDarkMode =
      css.includes("prefers-color-scheme") || css.includes("data-theme");
    expect(hasDarkMode).toBe(true);
  });

  it("references Manrope font", () => {
    expect(css).toContain("Manrope");
  });
});

describe("HTML compliance", () => {
  const html = read(web, "index.html");

  it("contains FreeAppStore in title", () => {
    expect(html).toMatch(/<title>[^<]*FreeAppStore[^<]*<\/title>/);
  });

  it("has viewport meta tag", () => {
    expect(html).toMatch(/<meta\s[^>]*name="viewport"/);
  });

  it("has manifest link", () => {
    expect(html).toMatch(/<link\s[^>]*rel="manifest"/);
  });
});

describe("PWA manifest", () => {
  it("public/manifest.json exists and has name, display, start_url", () => {
    const manifestPath = resolve(web, "public/manifest.json");
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    expect(manifest).toHaveProperty("name");
    expect(manifest).toHaveProperty("display");
    expect(manifest).toHaveProperty("start_url");
  });
});

describe("Shell compliance", () => {
  const shell = read(web, "src/components/Shell.tsx");

  it("contains freeappstore.online link", () => {
    expect(shell).toContain("freeappstore.online");
  });
});

describe("License", () => {
  it("LICENSE file exists at project root", () => {
    expect(existsSync(resolve(root, "LICENSE"))).toBe(true);
  });
});
