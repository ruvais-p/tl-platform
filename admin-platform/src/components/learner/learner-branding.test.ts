import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = resolve(process.cwd(), "src");
const css = readFileSync(resolve(sourceRoot, "app/globals.css"), "utf8");
const rootLayout = readFileSync(resolve(sourceRoot, "app/layout.tsx"), "utf8");
const learnerLayout = readFileSync(resolve(sourceRoot, "app/learn/layout.tsx"), "utf8");
const learnerTheme = css.match(/\.learner-theme \{([\s\S]*?)\n\}/)?.[1] ?? "";

function themeColor(name: string) {
  const value = learnerTheme.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`, "i"))?.[1];
  if (!value) throw new Error(`Missing learner theme color: ${name}`);
  return value;
}

function luminance(hex: string) {
  const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(foreground: string, background: string) {
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
    / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
}

function learnerComponentSources() {
  const directory = resolve(sourceRoot, "components/learner");
  return readdirSync(directory)
    .filter((name) => name.endsWith(".tsx"))
    .map((name) => readFileSync(resolve(directory, name), "utf8"));
}

describe("learner branding", () => {
  it("loads Poppins only at the learner route boundary", () => {
    expect(learnerLayout).toContain('import { Poppins } from "next/font/google"');
    expect(learnerLayout).toContain('variable: "--font-poppins"');
    expect(learnerLayout).toContain('weight: ["400", "500", "600", "700"]');
    expect(learnerLayout).toContain('display: "swap"');
    expect(learnerTheme).toContain("--font-sans: var(--font-poppins), Arial, sans-serif;");
    expect(rootLayout).toContain("Geist, Geist_Mono");
    expect(rootLayout).not.toContain("Poppins");
  });

  it("maps the approved palette to learner-only semantic tokens", () => {
    expect(themeColor("primary").toLowerCase()).toBe("#3ab664");
    expect(themeColor("secondary").toLowerCase()).toBe("#66d2e3");
    expect(themeColor("accent").toLowerCase()).toBe("#b5e5f8");
    expect(css.slice(0, css.indexOf(".learner-theme"))).not.toMatch(/#3ab664|#66d2e3|#b5e5f8/i);
  });

  it("keeps learner brand foreground pairings at WCAG AA contrast", () => {
    const foreground = themeColor("primary-foreground");
    expect(contrast(foreground, themeColor("primary"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(themeColor("secondary-foreground"), themeColor("secondary"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(themeColor("accent-foreground"), themeColor("accent"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(themeColor("brand-strong"), themeColor("background"))).toBeGreaterThanOrEqual(4.5);
  });

  it("uses the accessible strong brand token for standalone learner text", () => {
    for (const source of learnerComponentSources()) {
      expect(source).not.toMatch(/\btext-primary(?=["\s])/);
    }
  });

  it("provides a visible learner focus outline", () => {
    expect(css).toMatch(/\.learner-theme :where\([^)]+\):focus-visible \{/);
    expect(css).toContain("outline: 2px solid var(--ring);");
    expect(contrast(themeColor("ring"), themeColor("background"))).toBeGreaterThanOrEqual(3);
  });
});
