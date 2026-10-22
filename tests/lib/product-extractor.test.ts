import { beforeEach, describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("../../src/lib/safe-fetch", () => ({
  fetchProductHtml: vi.fn(),
}));

import { extractProduct } from "../../src/lib/product-extractor";
import { fetchProductHtml } from "../../src/lib/safe-fetch";

const mockedFetchProductHtml = vi.mocked(fetchProductHtml);

describe("extractProduct", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts product details from JSON-LD", async () => {
    mockedFetchProductHtml.mockResolvedValue({
      finalUrl: "https://shop.example/products/headphones",
      html: `
        <html>
          <head>
            <script type="application/ld+json">
              {
                "@context": "https://schema.org",
                "@type": "Product",
                "name": "Wireless Headphones",
                "description": "Noise cancelling headphones",
                "image": "https://shop.example/headphones.jpg",
                "offers": {
                  "@type": "Offer",
                  "price": "2499.00",
                  "priceCurrency": "INR"
                }
              }
            </script>
          </head>
          <body>
            <h1>Wireless Headphones</h1>
          </body>
        </html>
      `,
    });

    const result = await extractProduct(
      "https://shop.example/products/headphones",
    );

    expect(result.productName).toBe("Wireless Headphones");
    expect(result.description).toBe("Noise cancelling headphones");
    expect(result.imageUrl).toBe(
      "https://shop.example/headphones.jpg",
    );
    expect(result.price).toBe(2499);
    expect(result.currency).toBe("INR");
    expect(result.sourceUrl).toBe(
      "https://shop.example/products/headphones",
    );
  });

  it("uses Open Graph metadata when JSON-LD is unavailable", async () => {
    mockedFetchProductHtml.mockResolvedValue({
      finalUrl: "https://shop.example/product",
      html: `
        <html>
          <head>
            <meta property="og:title" content="Bluetooth Speaker" />
            <meta
              property="og:description"
              content="Portable Bluetooth speaker"
            />
          </head>
          <body>
            <h1>Bluetooth Speaker</h1>
          </body>
        </html>
      `,
    });

    const result = await extractProduct(
      "https://shop.example/product",
    );

    expect(result.productName).toBe("Bluetooth Speaker");
    expect(result.description).toBe(
      "Portable Bluetooth speaker",
    );
  });

  it("returns null for unavailable product details", async () => {
    mockedFetchProductHtml.mockResolvedValue({
      finalUrl: "https://shop.example/unknown",
      html: "<html><body><p>No product information</p></body></html>",
    });

    const result = await extractProduct(
      "https://shop.example/unknown",
    );

    expect(result.productName).toBeNull();
    expect(result.description).toBeNull();
    expect(result.imageUrl).toBeNull();
    expect(result.price).toBeNull();
    expect(result.currency).toBeNull();
  });

  it("propagates fetch errors", async () => {
    mockedFetchProductHtml.mockRejectedValue(
      new Error("Network error"),
    );

    await expect(
      extractProduct("https://shop.example/product"),
    ).rejects.toThrow("Network error");
  });
});