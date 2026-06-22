import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  let body: any = {};
  try {
    body = await request.json();
  } catch (e) {}

  const format = body.contentFormat || "long";
  const isShort = format === "short";

  const titles = isShort
    ? [
        "The secret chord in Cyberpunk tracks 🎹🔥",
        "Why coding in the dark sounds like THIS...",
        "This synth changed coding forever! 💻🎧",
        "Unlock FLOW STATE with analog waves 🧠⚡️"
      ]
    : [
        "How Dark Synthwave Restructured the Cyberpunk Film Aesthetic",
        "The Rise of Night-Coding Beats: A Sonic Deep Dive",
        "From Moog to Daft Punk: The History of Voltage Synths",
        "The Neurology of Code: Sound waves for Focus"
      ];

  await new Promise((resolve) => setTimeout(resolve, 600));

  return NextResponse.json({ titles });
}
