import "server-only";

import * as cheerio from "cheerio";
import { fetchProductHtml } from "./safe-fetch";

export interface ExtractedProduct {
  productName: string | null;
  description: string | null;
  imageUrl: string | null;
  price: number | null;
  currency: string | null;
  sourceUrl: string;
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const cleaned = value.replace(/\s+/g, " ").trim();

  return cleaned || null;
}

function getString(value: unknown): string | null {
  if (typeof value === "string") return cleanText(value);

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function getProductObjects(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.flatMap(getProductObjects);
  }

  if (!value || typeof value !== "object") return [];

  const object = value as Record<string, unknown>;
  const type = object["@type"];

  const types = Array.isArray(type) ? type : [type];

  if (
    types.some(
      (item) =>
        typeof item === "string" &&
        item.toLowerCase() === "product",
    )
  ) {
    return [object];
  }

  const graph = object["@graph"];

  if (Array.isArray(graph)) {
    return graph.flatMap(getProductObjects);
  }

  return [];
}

function getFirstValue(
  ...values: unknown[]
): string | null {
  for (const value of values) {
    const result = getString(value);

    if (result) return result;
  }

  return null;
}

function getImageValue(value: unknown): string | null {
  if (typeof value === "string") return cleanText(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      const image = getImageValue(item);

      if (image) return image;
    }

    return null;
  }

  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;

    return getFirstValue(object.url, object.contentUrl);
  }

  return null;
}

function getOffers(
  value: unknown,
): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is Record<string, unknown> =>
        !!item && typeof item === "object",
    );
  }

  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;

    if (object["@type"] === "AggregateOffer") {
      return [object];
    }

    if (object["@type"] === "Offer") {
      return [object];
    }

    return [object];
  }

  return [];
}

function parsePrice(value: unknown): number | null {
  const raw = getString(value);

  if (!raw) return null;

  const normalized = raw.replace(/,/g, "").trim();

  if (!/^\d+(?:\.\d{1,4})?$/.test(normalized)) {
    return null;
  }

  const price = Number(normalized);

  return Number.isFinite(price) ? price : null;
}

function resolveSafeHttpUrl(
  value: string | null,
  baseUrl: string,
): string | null {
  if (!value) return null;

  try {
    const resolved = new URL(value, baseUrl);

    if (!["http:", "https:"].includes(resolved.protocol)) {
      return null;
    }

    if (resolved.username || resolved.password) {
      return null;
    }

    return resolved.toString();
  } catch {
    return null;
  }
}

export async function extractProduct(
  productUrl: string,
): Promise<ExtractedProduct> {
  const { html, finalUrl } = await fetchProductHtml(productUrl);
  const $ = cheerio.load(html);

  const structuredProducts: Record<string, unknown>[] = [];

  $('script[type="application/ld+json"]').each((_, element) => {
    const rawJson = $(element).text().trim();

    if (!rawJson) return;

    try {
      const parsed: unknown = JSON.parse(rawJson);

      structuredProducts.push(...getProductObjects(parsed));
    } catch {
      // Invalid JSON-LD is ignored; metadata fallbacks remain available.
    }
  });

  const product = structuredProducts[0];

  const offers = getOffers(product?.offers);
  const offer = offers[0];

  const productName = getFirstValue(
    product?.name,
    $('meta[property="og:title"]').attr("content"),
    $('meta[name="twitter:title"]').attr("content"),
    $("h1").first().text(),
    $("title").text(),
  );

  const description = getFirstValue(
    product?.description,
    $('meta[property="og:description"]').attr("content"),
    $('meta[name="description"]').attr("content"),
  );

  const structuredImage = getImageValue(product?.image);

  const imageUrl = resolveSafeHttpUrl(
    getFirstValue(
      structuredImage,
      $('meta[property="og:image"]').attr("content"),
      $('meta[name="twitter:image"]').attr("content"),
    ),
    finalUrl,
  );

  const price = parsePrice(
    getFirstValue(
      offer?.price,
      offer?.lowPrice,
      $('meta[property="product:price:amount"]').attr("content"),
      $('meta[property="og:price:amount"]').attr("content"),
    ),
  );

  const currency = getFirstValue(
    offer?.priceCurrency,
    $('meta[property="product:price:currency"]').attr("content"),
    $('meta[property="og:price:currency"]').attr("content"),
  )?.toUpperCase() ?? null;

  return {
    productName,
    description,
    imageUrl,
    price,
    currency,
    sourceUrl: finalUrl,
  };
}