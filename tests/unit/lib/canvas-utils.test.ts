import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createBlobUrlFromBase64, getDataUrlMimeType } from "../../../src/lib/canvas-utils";

const originalCreateObjectUrl = URL.createObjectURL;
const createdBlobs: Blob[] = [];

beforeEach(() => {
  createdBlobs.length = 0;
  URL.createObjectURL = ((blob: Blob) => {
    createdBlobs.push(blob);
    return `blob:canvas-${createdBlobs.length}`;
  }) as typeof URL.createObjectURL;
});

describe("canvas utils", () => {
  test("creates blob URLs from raw base64 with the fallback MIME type", async () => {
    const url = createBlobUrlFromBase64("aGk=", "image/png");

    expect(url).toBe("blob:canvas-1");
    expect(createdBlobs).toHaveLength(1);
    expect(createdBlobs[0]?.type).toBe("image/png");
    expect(await createdBlobs[0]?.text()).toBe("hi");
  });

  test("uses data URL MIME types over fallback MIME types", async () => {
    const url = createBlobUrlFromBase64("data:image/jpeg;base64,aGk=", "image/png");

    expect(url).toBe("blob:canvas-1");
    expect(createdBlobs[0]?.type).toBe("image/jpeg");
    expect(await createdBlobs[0]?.text()).toBe("hi");
    expect(getDataUrlMimeType("data:image/webp;base64,aGk=")).toBe("image/webp");
  });

  test("rejects invalid base64 before creating an object URL", () => {
    expect(() => createBlobUrlFromBase64("%%%", "image/png")).toThrow("Invalid base64 data");
    expect(createdBlobs).toEqual([]);
    expect(getDataUrlMimeType("not-a-data-url")).toBeNull();
  });
});

afterEach(() => {
  URL.createObjectURL = originalCreateObjectUrl;
});
