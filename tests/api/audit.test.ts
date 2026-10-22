import { describe, it, expect } from "vitest";
import { POST } from "../../src/app/api/audit/route";

describe("POST /api/audit", () => {
    it("accepts a valid product URL", async () => {
        const request = new Request("http://localhost:3000/api/audit", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                productUrl: "https://example.com/product",
            }),
        });

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(200);

        // Verify that the API returns a successful response.
        expect(body).toBeDefined();
        expect(body.success).toBe(true);
        expect(body.data).toBeDefined();
    });

    it("rejects an invalid URL", async () => {
        const request = new Request("http://localhost:3000/api/audit", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                productUrl: "not-a-valid-url",
            }),
        });

        const response = await POST(request);

        expect(response.status).toBe(400);
    });

    it("rejects a missing product URL", async () => {
        const request = new Request("http://localhost:3000/api/audit", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
        });

        const response = await POST(request);

        expect(response.status).toBe(400);
    });

    it("rejects malformed JSON", async () => {
        const request = new Request("http://localhost:3000/api/audit", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: "{invalid-json",
        });

        const response = await POST(request);

        expect(response.status).toBe(400);
    });
});