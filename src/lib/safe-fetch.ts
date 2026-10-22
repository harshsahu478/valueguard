import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const REQUEST_TIMEOUT_MS = 8_000;
const MAX_RESPONSE_BYTES = 1_000_000;

const ALLOWED_CONTENT_TYPES = new Set([
  "text/html",
  "application/xhtml+xml",
]);

export class SafeFetchError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "INVALID_URL"
      | "UNSAFE_HOST"
      | "DNS_ERROR"
      | "HTTP_ERROR"
      | "UNSUPPORTED_CONTENT"
      | "RESPONSE_TOO_LARGE"
      | "TIMEOUT"
      | "NETWORK_ERROR",
  ) {
    super(message);
    this.name = "SafeFetchError";
  }
}

export interface SafeHtmlResponse {
  finalUrl: string;
  html: string;
}

function isPublicIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);

  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }

  const [a, b, c] = parts;

  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0 && c === 0) return false;
  if (a === 192 && b === 0 && c === 2) return false;
  if (a === 192 && b === 88 && c === 99) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;

  return true;
}

function isPublicIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase().split("%")[0];

  if (normalized.includes(".")) {
    const lastColon = normalized.lastIndexOf(":");
    const embeddedIPv4 = normalized.slice(lastColon + 1);

    if (isIP(embeddedIPv4) === 4) {
      return isPublicIPv4(embeddedIPv4) &&
        normalized.startsWith("::ffff:");
    }
  }

  // Only globally routable unicast IPv6 addresses are accepted.
  // This intentionally rejects special-purpose ranges.
  const firstGroup = normalized.split(":")[0];

  if (!firstGroup) return false;

  const firstValue = Number.parseInt(firstGroup, 16);

  return (
    Number.isFinite(firstValue) &&
    firstValue >= 0x2000 &&
    firstValue <= 0x3fff &&
    !normalized.startsWith("2001:db8:")
  );
}

function isPublicIP(ip: string): boolean {
  const version = isIP(ip);

  if (version === 4) return isPublicIPv4(ip);
  if (version === 6) return isPublicIPv6(ip);

  return false;
}

async function validatePublicHost(url: URL): Promise<void> {
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (
    !["http:", "https:"].includes(url.protocol) ||
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.includes("%") ||
    url.username ||
    url.password
  ) {
    throw new SafeFetchError(
      "The supplied URL is not allowed.",
      "INVALID_URL",
    );
  }

  const literalVersion = isIP(hostname);

  if (literalVersion !== 0) {
    if (!isPublicIP(hostname)) {
      throw new SafeFetchError(
        "Private or reserved IP addresses are not allowed.",
        "UNSAFE_HOST",
      );
    }

    return;
  }

  let addresses: { address: string; family: number }[];

  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new SafeFetchError(
      "The product website could not be resolved.",
      "DNS_ERROR",
    );
  }

  if (
    addresses.length === 0 ||
    addresses.some((address) => !isPublicIP(address.address))
  ) {
    throw new SafeFetchError(
      "The hostname resolves to an unsafe IP address.",
      "UNSAFE_HOST",
    );
  }
}

export async function fetchProductHtml(
  inputUrl: string,
): Promise<SafeHtmlResponse> {
  let url: URL;

  try {
    url = new URL(inputUrl);
  } catch {
    throw new SafeFetchError("Please provide a valid URL.", "INVALID_URL");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new SafeFetchError(
      "Only HTTP and HTTPS URLs are supported.",
      "INVALID_URL",
    );
  }

  // Avoid accidentally sending fragments to the server.
  url.hash = "";

  await validatePublicHost(url);

  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  );

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      cache: "no-store",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "ValueGuardBot/1.0",
      },
    });

    if (response.status >= 300 && response.status < 400) {
      throw new SafeFetchError(
        "Redirects are not supported for product extraction.",
        "HTTP_ERROR",
      );
    }

    if (!response.ok) {
      throw new SafeFetchError(
        `The product website returned HTTP ${response.status}.`,
        "HTTP_ERROR",
      );
    }

    const contentType = response.headers
      .get("content-type")
      ?.split(";")[0]
      .trim()
      .toLowerCase();

    if (!contentType || !ALLOWED_CONTENT_TYPES.has(contentType)) {
      throw new SafeFetchError(
        "The URL did not return an HTML document.",
        "UNSUPPORTED_CONTENT",
      );
    }

    const declaredLength = Number(response.headers.get("content-length"));

    if (
      Number.isFinite(declaredLength) &&
      declaredLength > MAX_RESPONSE_BYTES
    ) {
      throw new SafeFetchError(
        "The product page exceeds the allowed response size.",
        "RESPONSE_TOO_LARGE",
      );
    }

    if (!response.body) {
      throw new SafeFetchError(
        "The website returned an empty response.",
        "HTTP_ERROR",
      );
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        totalBytes += value.byteLength;

        if (totalBytes > MAX_RESPONSE_BYTES) {
          await reader.cancel();

          throw new SafeFetchError(
            "The product page exceeds the allowed response size.",
            "RESPONSE_TOO_LARGE",
          );
        }

        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    const combined = new Uint8Array(totalBytes);
    let offset = 0;

    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return {
      finalUrl: url.toString(),
      html: new TextDecoder().decode(combined),
    };
  } catch (error) {
    if (error instanceof SafeFetchError) {
      throw error;
    }

    if (controller.signal.aborted) {
      throw new SafeFetchError(
        "The product website took too long to respond.",
        "TIMEOUT",
      );
    }

    throw new SafeFetchError(
      "Unable to retrieve the product page.",
      "NETWORK_ERROR",
    );
  } finally {
    clearTimeout(timeout);
  }
}