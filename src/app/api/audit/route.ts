import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      !("productUrl" in body) ||
      typeof body.productUrl !== "string"
    ) {
      return NextResponse.json(
        { error: "productUrl must be a string." },
        { status: 400 },
      );
    }

    let url: URL;

    try {
      url = new URL(body.productUrl);
    } catch {
      return NextResponse.json(
        { error: "Please provide a valid URL." },
        { status: 400 },
      );
    }

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