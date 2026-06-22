import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  let body: any = {};
  try {
    body = await request.json();
  } catch (e) {}

  const format = body.contentFormat || "long";
  const isShort = format === "short";

  const description = isShort
    ? `Get locked in. This is the science of why dark synth beats increase focus while coding.

#shorts #synthwave #coding #cyberpunk #focus`
    : `A deep dive documentary into the relationship between late-night coding flow states, analog voltage oscillator frequencies, and retro-futuristic cyberpunk soundscapes. 

TIMESTAMPS:
0:00 - The Dim Workspace
1:15 - Rise of Focus Beats
3:20 - Analog Oscillator Frequencies
5:45 - Breaking Through Dystopian Aesthetics`;

  const tags = isShort
    ? ["shorts", "coding", "synthwave", "cyberpunk", "focus"]
    : ["cyberpunk", "synthwave", "creative-coding", "ambient-music", "documentary", "retro-tech"];

  const chapters = isShort
    ? []
    : [
        { timestamp: "0:00", title: "The Dim Workspace" },
        { timestamp: "1:15", title: "Rise of Focus Beats" },
        { timestamp: "3:20", title: "Analog Oscillator Frequencies" },
        { timestamp: "5:45", title: "Breaking Through Dystopian Aesthetics" }
      ];

  await new Promise((resolve) => setTimeout(resolve, 600));

  return NextResponse.json({ description, tags, chapters });
}
