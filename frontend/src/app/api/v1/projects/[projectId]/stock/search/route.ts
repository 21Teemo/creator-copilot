import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  let body: any = {};
  try {
    body = await request.json();
  } catch (e) {}

  const format = body.contentFormat || "long";
  const isShort = format === "short";

  const images = isShort
    ? [
        {
          sceneNumber: 1,
          imageUrl: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=600&auto=format&fit=crop",
          visualPrompt: "Retro green terminal screen pulsing, text SYSTEM BOOTING"
        },
        {
          sceneNumber: 2,
          imageUrl: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=600&auto=format&fit=crop",
          visualPrompt: "Close-up of neon mechanical key switches clicking in a dark studio"
        },
        {
          sceneNumber: 3,
          imageUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=600&auto=format&fit=crop",
          visualPrompt: "Glow-in-the-dark oscilloscope lines synching to heavy audio waves"
        }
      ]
    : [
        {
          sceneNumber: 1,
          imageUrl: "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?q=80&w=600&auto=format&fit=crop",
          visualPrompt: "Camera pans slowly across a dim developer setup, terminal screen showing green code lines"
        },
        {
          sceneNumber: 2,
          imageUrl: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=600&auto=format&fit=crop",
          visualPrompt: "Close-up of hands typing on mechanical keyboards, backlit in deep blue and indigo"
        },
        {
          sceneNumber: 3,
          imageUrl: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=600&auto=format&fit=crop",
          visualPrompt: "Green neon laser lines forming a holographic city grid, oscilloscope waving in sync"
        },
        {
          sceneNumber: 4,
          imageUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=600&auto=format&fit=crop",
          visualPrompt: "Wide view of city skyline from a skyscraper window, raindrops falling on glass"
        }
      ];

  await new Promise((resolve) => setTimeout(resolve, 600));

  return NextResponse.json(images);
}
