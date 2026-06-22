import { NextRequest, NextResponse } from "next/server";

export async function POST() {
  const trendsData = [
    {
      title: "Why coding in the dark sounds like THIS... 💻🎹",
      views: "840K",
      duration: "0:45",
      description: "An breakdown of night-coding aesthetics, deep synth filters, and low-pass hums.",
      channelName: "SynthTheory",
      publishedAt: "2 days ago"
    },
    {
      title: "The synth wave formula for maximum focus 🧠🎧",
      views: "1.2M",
      duration: "0:58",
      description: "Quick tutorial on how 72Bpm tempo blocks keep the brain locked into deep work states.",
      channelName: "FocusBeats",
      publishedAt: "1 week ago"
    },
    {
      title: "Building retro electronic hooks in 30 seconds 🎹🔥",
      views: "340K",
      duration: "0:30",
      description: "Using old Roland Jupiter filters to construct an infectious cyberpunk bassline.",
      channelName: "AnalogStudio",
      publishedAt: "3 days ago"
    },
    {
      title: "I coded a tracker in assembly and it sounds like 1989",
      views: "92K",
      duration: "0:55",
      description: "Demonstrating clean 8-bit tracking limitations and square-wave lead configurations.",
      channelName: "ByteCore",
      publishedAt: "5 days ago"
    },
    {
      title: "Lo-Fi vs Dark Ambient: The Ultimate Chill Battle",
      views: "450K",
      duration: "0:59",
      description: "Comparing tape saturation cracks with deep digital pad echoes for late-night editing sessions.",
      channelName: "VibeLab",
      publishedAt: "4 days ago"
    }
  ];

  await new Promise((resolve) => setTimeout(resolve, 600));

  return NextResponse.json(trendsData);
}
