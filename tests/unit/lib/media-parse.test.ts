import { describe, expect, test } from "bun:test";
import { mediaUrlsToImages, parseMediaFromContent } from "../../../src/lib/media-parse";

describe("parseMediaFromContent", () => {
  test("removes valid MEDIA lines and separates displayable URLs from local paths", () => {
    const parsed = parseMediaFromContent(
      [
        "before",
        'MEDIA: ["https://example.test/a.png"],',
        "MEDIA: http://example.test/b.jpg",
        "MEDIA: data:image/png;base64,abc",
        "MEDIA: /tmp/local.png",
        "MEDIA: ./relative.png",
        "MEDIA: file:///tmp/local.png",
        String.raw`MEDIA: C:\Users\kilian\image.png`,
        "after",
      ].join("\n"),
    );

    expect(parsed.text).toBe("before\nafter");
    expect(parsed.mediaUrls).toEqual([
      "https://example.test/a.png",
      "http://example.test/b.jpg",
      "data:image/png;base64,abc",
    ]);
    expect(parsed.localPaths).toEqual([
      "/tmp/local.png",
      "./relative.png",
      "file:///tmp/local.png",
      String.raw`C:\Users\kilian\image.png`,
    ]);
  });

  test("keeps malformed or non-uppercase media markers as text", () => {
    const parsed = parseMediaFromContent(
      [
        "MEDIA:   ",
        "media: https://example.test/lower.png",
        " MEDIA:https://example.test/tight.png",
      ].join("\n"),
    );

    expect(parsed.text).toBe("MEDIA:   \nmedia: https://example.test/lower.png");
    expect(parsed.mediaUrls).toEqual(["https://example.test/tight.png"]);
    expect(parsed.localPaths).toEqual([]);
  });
});

describe("mediaUrlsToImages", () => {
  test("generates stable numbered alt text", () => {
    expect(mediaUrlsToImages(["a", "b", "c"])).toEqual([
      { alt: "Image 1", url: "a" },
      { alt: "Image 2", url: "b" },
      { alt: "Image 3", url: "c" },
    ]);
  });
});
