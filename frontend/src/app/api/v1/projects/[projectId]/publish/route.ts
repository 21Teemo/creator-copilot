import { NextRequest, NextResponse } from "next/server";

export async function POST() {
  await new Promise((resolve) => setTimeout(resolve, 600));

  return NextResponse.json({
    status: "published",
    publishedUrl: "https://studio.youtube.com/video/mock-draft/edit",
    message: "Uploaded as draft successfully."
  });
}
