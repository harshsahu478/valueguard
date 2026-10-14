"use client";

import { useState } from "react";
import type { SubmitEvent } from "react";

type AuditResponse = {
  success: true;
  data: {
    productUrl: string;
    status: string;
    message: string;
  };
};

type ApiError = {
  error: string;
};

export default function ProductAuditForm() {
  const [productUrl, setProductUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AuditResponse["data"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ productUrl }),
      });

      const payload: unknown = await response.json();

      if (!response.ok) {
        const message =
          typeof payload === "object" &&
          payload !== null &&
          "error" in payload &&
          typeof payload.error === "string"
            ? payload.error
            : "The audit request failed.";

        throw new Error(message);
      }

      if (
        typeof payload !== "object" ||
        payload === null ||
        !("success" in payload) ||
        payload.success !== true ||
        !("data" in payload) ||
        typeof payload.data !== "object" ||
        payload.data === null ||
        !("productUrl" in payload.data) ||
        typeof payload.data.productUrl !== "string" ||
        !("status" in payload.data) ||
        typeof payload.data.status !== "string" ||
        !("message" in payload.data) ||
        typeof payload.data.message !== "string"
      ) {
        throw new Error("The server returned an unexpected response.");
      }

      setResult({
        productUrl: payload.data.productUrl,
        status: payload.data.status,
        message: payload.data.message,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3 sm:flex-row">
        <input
          type="url"
          value={productUrl}
          onChange={(event) => setProductUrl(event.target.value)}
          placeholder="https://example.com/product"
          aria-label="Product URL"
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
          required
          disabled={isLoading}
        />

        <button
          type="submit"
          disabled={isLoading}
          className="rounded-lg bg-black px-5 py-3 font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Submitting..." : "Audit Product"}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}

      {result && (
        <section
          aria-live="polite"
          className="mt-5 rounded-xl border border-gray-200 bg-white p-5"
        >
          <p className="text-sm font-medium text-gray-500">API response</p>

          <p className="mt-2 break-all font-medium text-gray-900">
            {result.productUrl}
          </p>

          <p className="mt-2 text-sm text-gray-600">
            Status: {result.status}
          </p>

          <p className="mt-2 text-sm leading-6 text-gray-600">
            {result.message}
          </p>
        </section>
      )}
    </div>
  );
}