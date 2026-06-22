import { NextRequest, NextResponse } from "next/server";

export async function POST() {
  const trendsData = [
    {
      title: "How Dark Synthwave Restructured Cyberpunk Aesthetics",
      views: "2.3M",
      duration: "14:20",
      description: "An in-depth documentary examining how the low-mid frequencies of modern synthwave shaped the cinematic shadows of modern science fiction.",
      channelName: "CineSonic",
      publishedAt: "3 weeks ago"
    },
    {
      title: "The Science of Deep Work Playlists: Why Ambient Beats Lock You In",
      views: "950K",
      duration: "18:45",
      description: "Exploring the neurological relationship between low-frequency brown noise filters and spatial audio in focus soundscapes.",
      channelName: "MindPulse",
      publishedAt: "2 weeks ago"
    },
    {
      title: "From Moog to Daft Punk: A Complete History of Synthesized Leads",
      views: "4.1M",
      duration: "25:30",
      description: "A chronological masterclass mapping the physical evolution of voltage control oscillators to modern EDM production houses.",
      channelName: "RetroWaveDoc",
      publishedAt: "1 month ago"
    },
    {
      title: "Retro-Futurism: Exploring the 1980s Vision of 2026",
      views: "1.8M",
      duration: "12:15",
      description: "Analyzing the visual art, industrial grids, and musical scores that defined the neon dystopian horizon.",
      channelName: "FutureClassic",
      publishedAt: "5 days ago"
    },
    {
      title: "Late Night Coding - Cyberpunk Ambience & Modular Synths [8 Hours]",
      views: "6.2M",
      duration: "8:00:00",
      description: "A continuous live recording from a custom Eurorack setup configured for programming focus and tape delay spacing.",
      channelName: "PatchBay",
      publishedAt: "2 months ago"
    }
  ];

  await new Promise((resolve) => setTimeout(resolve, 600));

  return NextResponse.json(trendsData);
}
