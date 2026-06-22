import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  let body: any = {};
  try {
    body = await request.json();
  } catch (e) {}

  const format = body.contentFormat || "long";
  const isShort = format === "short";

  const videos = isShort
    ? [
        {
          sceneNumber: 1,
          videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
          visualPrompt: "Retro green terminal screen pulsing, text SYSTEM BOOTING"
        },
        {
          sceneNumber: 2,
          videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
          visualPrompt: "Close-up of neon mechanical key switches clicking in a dark studio"
        },
        {
          sceneNumber: 3,
          videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
          visualPrompt: "Glow-in-the-dark oscilloscope lines synching to heavy audio waves"
        }
      ]
    : [
        {
          sceneNumber: 1,
          videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
          visualPrompt: "Camera pans slowly across a dim developer setup, terminal screen showing green code lines"
        },
        {
          sceneNumber: 2,
          videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
          visualPrompt: "Close-up of hands typing on mechanical keyboards, backlit in deep blue and indigo"
        },
        {
          sceneNumber: 3,
          videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
          visualPrompt: "Green neon laser lines forming a holographic city grid, oscilloscope waving in sync"
        },
        {
          sceneNumber: 4,
          videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
          visualPrompt: "Wide view of city skyline from a skyscraper window, raindrops falling on glass"
        }
      ];

  await new Promise((resolve) => setTimeout(resolve, 600));

  return NextResponse.json(videos);
}
