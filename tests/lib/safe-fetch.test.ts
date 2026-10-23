import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn().mockResolvedValue([
    {
      address: "93.184.216.34",
      family: 4,
    },
  ]),
}));

import { lookup } from "node:dns/promises";
import { fetchProductHtml } from "../../src/lib/safe-fetch";

const mockedLookup = vi.mocked(lookup);

describe("fetchProductHtml", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns HTML for a successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<html><body>Product</body></html>", {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
          },
        }),
      ),
    );

    const result = await fetchProductHtml(
      "https://example.com/product",
    );

    expect(mockedLookup).toHaveBeenCalled();
    expect(result.html).toContain("Product");
    expect(result.finalUrl).toBe(
      "https://example.com/product",
    );
  });

  it("rejects unsupported content types", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response('{"message":"not HTML"}', {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }),
      ),
    );

    await expect(
      fetchProductHtml("https://example.com/product"),
    ).rejects.toMatchObject({
      code: "UNSUPPORTED_CONTENT",
    });
  });
});
