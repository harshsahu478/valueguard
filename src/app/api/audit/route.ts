import { NextResponse } from "next/server";
import { z } from "zod";

const auditRequestSchema = z.object({
  productUrl: z.url(),
});

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();

    const validation = auditRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Please provide a valid product URL." },
        { status: 400 },
      );
    }

    const url = new URL(validation.data.productUrl);

    if (
      !["http:", "https:"].includes(url.protocol) ||
      !url.hostname.includes(".")
    ) {
      return NextResponse.json(
        { error: "Please provide a valid HTTP or HTTPS product URL." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        productUrl: url.toString(),
        status: "received",
        message: "Product URL received. Audit engine is not connected yet.",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body." },
      { status: 400 },
    );
  }
}