import { describe, expect, test } from "bun:test";

const animationsCss = await Bun.file("src/styles/animations.css").text();

describe("animations css", () => {
  test("uses a tuned Prompt Kit-style shimmer for running tool labels", () => {
    expect(animationsCss).toContain("--tool-call-shimmer-duration: 2.93s");
    expect(animationsCss).toContain("--tool-call-shimmer-spread: 20%");
    expect(animationsCss).toContain("background-clip: text");
    expect(animationsCss).toContain("-webkit-text-fill-color: transparent");
    expect(animationsCss).toContain(
      "animation: tool-call-text-shimmer var(--tool-call-shimmer-duration) linear infinite",
    );
  });

  test("keeps running tool labels readable when reduced motion is enabled", () => {
    expect(animationsCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(animationsCss).toContain("-webkit-text-fill-color: currentColor");
  });

  test("runs each shimmer cycle fully before resetting offscreen", () => {
    expect(animationsCss).toContain("--tool-call-shimmer-width: 140%");
    expect(animationsCss).toContain(
      "background-position: calc(100% + var(--tool-call-shimmer-width)) 50%",
    );
    expect(animationsCss).toContain(
      "background-position: calc(0% - var(--tool-call-shimmer-width)) 50%",
    );
    expect(animationsCss).toContain("background-size: var(--tool-call-shimmer-width) 100%");
    expect(animationsCss).toContain("background-repeat: no-repeat");
    expect(animationsCss).not.toContain("background-position: 100% 50%");
    expect(animationsCss).not.toContain("background-position: -100% 50%");
  });

  test("keeps a clipped base color under the moving shimmer band", () => {
    expect(animationsCss).toContain("background-color: var(--tool-call-shimmer-base)");
  });
});
