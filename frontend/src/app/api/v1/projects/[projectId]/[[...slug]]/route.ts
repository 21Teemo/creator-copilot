import { NextRequest, NextResponse } from "next/server";

// In-memory store for simulated background video renders
const renderTasks = new Map<string, { progress: number; status: string; format: string }>();

// Helper to wait
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; slug?: string[] }> }
) {
  const { projectId, slug } = await context.params;
  const path = slug ? slug.join("/") : "";
  
  let body: any = {};
  try {
    body = await request.json();
  } catch (e) {
    // Body might be empty
  }

  const format = body.contentFormat || "long";
  const includeAudio = body.includeAudio || false;

  await sleep(600); // Simulate API latency

  // Stage 1: Explore Trends
  if (path === "research/trends/short" || path === "research/trends/long") {
    const isShort = path.includes("short");
    
    const trendsData = isShort
      ? [
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
        ]
      : [
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
    return NextResponse.json(trendsData);
  }

  // Stage 1: Summarize / Fact Finder
  if (path === "research/summarize" || path === "research/web-search") {
    const isShort = format === "short";
    
    const summaryText = isShort
      ? `## Cyber Synth Shorts Niche Brief

### Hook Analysis
* **Retention Pattern**: Start with a heavy, pitch-bent oscillator filter sweep within the first 1.5 seconds.
* **Intrigue**: Present the synthesizer as a 'focus hacker' or 'brain interface' tool rather than just music.

### Narrow Themes
* Retro-futurism (specifically 1980s neon blueprints) out-performs generic electronic backgrounds by 42%.
* Focus beats are highly sought after; users look for "programming playlists" and "assembly tracks".`
      : `## Synthesized Music & Dystopian Art Research Brief

### Niche Definition & History
The synthesis of dark electronic soundscapes is deeply rooted in late 1970s analog experimentation (specifically Moog and Sequential Circuits) combined with German minimal techno. The aesthetic transitioned from pure audio to a structural pillars of sci-fi filmmaking, establishing the blueprint for retro-futuristic audio-visual environments.

### Core Trends
* **Synthesizer Leads**: Continuous interest in vintage hardware controllers and custom modular Eurorack setups.
* **Audio-Visual Synesthesia**: The correlation between oscilloscope screens, terminal layouts, and low-frequency pulses is highly engaging.
* **Productivity Catalysts**: Creative coding tracks are shifting from traditional slow lo-fi toward high-energy synth loops to maintain focus.`;

    const sources = [
      {
        title: "The Neurological Focus of 72Bpm Audio Filters",
        url: "https://journals.soundscience.org/neuro-focus-beats",
        snippet: "This study evaluates how low-pass hums at 72Bpm interact with beta-wave brain states to isolate auditory distractions."
      },
      {
        title: "Analog Dystopia: Moog Controllers in Dystopian Film (1982)",
        url: "https://archive.retrowave.org/analog-dystopia-moog",
        snippet: "A breakdown of original patch designs used in early cyber sci-fi scores to create feelings of urban weight."
      },
      {
        title: "YouTube Analytics: Retention Speeds in Audio-First Shorts",
        url: "https://creator.youtube-trends.com/audio-retention-2025",
        snippet: "Data shows that audio channels implementing visual oscilloscope grids retain short-form viewers 1.8x longer."
      }
    ];

    return NextResponse.json({ summaryText, sources });
  }

  // Stage 2: Script / Storyboard Generator
  if (path === "scripting/storyboard") {
    const isShort = format === "short";

    const script = isShort
      ? `[Scene 1 - Visual: Retro green terminal screen pulsing. Text sweeps across: SYSTEM BOOTING]
Voiceover: Ever wonder why night-coding feels so... addictive?

[Scene 2 - Visual: Close-up of neon keys being clicked in dark studio]
Voiceover: It's not just the quiet. It's the sound. Specifically, low-frequency dark synth waves.

[Scene 3 - Visual: Oscilloscope screen waves sync perfectly to heavy synthesizer pulses]
Voiceover: Science shows 72Bpm loops lock your brain into flow state. Boot up your terminal, throw on the beats, and write code.`
      : `[Scene 1 - Visual: Camera pans slowly across a dim developer setup. Green screen glow illuminates a retro coding terminal]
Voiceover: In the quiet hours of the night, the line between technology and art begins to blur. For developers, this workspace is a digital canvas.

[Scene 2 - Visual: Close-up of hands typing on custom mechanical keyboards in a dimly lit studio]
Voiceover: But code requires focus. And focus requires a soundtrack. The rises of dark electronic beats has redefined the nighttime developer studio.

[Scene 3 - Visual: Green neon laser lines forming a holographic city grid. Oscilloscope waves pulse to heavy synth basslines]
Voiceover: Born from 1980s analog voltage oscillators, this genre blends low-pass filters with a steady pacing that maps to cognitive flow states.

[Scene 4 - Visual: A wide view of the illuminated city skyline through a dark developer window]
Voiceover: Next time you boot your terminal, listen closely to the frequency of focus. Booting up, coding on, and breaking through.`;

    const outline = isShort
      ? [
          {
            sectionTitle: "Hook: The Addiction",
            durationSeconds: 10,
            talkingPoints: ["Why night coding feels different", "Visual of green terminal booting"]
          },
          {
            sectionTitle: "Body: The Sonic Secret",
            durationSeconds: 20,
            talkingPoints: ["Low-frequency dark synths", "72Bpm tempo cognitive locking"]
          },
          {
            sectionTitle: "CTA: Boot Up",
            durationSeconds: 15,
            talkingPoints: ["Encourage coder flow state", "Call to subscribe"]
          }
        ]
      : [
          {
            sectionTitle: "Introduction: Dim Workspace",
            durationSeconds: 45,
            talkingPoints: ["Quiet coding aesthetic", "Line between tech and art"]
          },
          {
            sectionTitle: "Focus Soundtrack",
            durationSeconds: 60,
            talkingPoints: ["Why ambient synthwave is rising", "Mechanical keyboard typing soundscapes"]
          },
          {
            sectionTitle: "The Science of Frequencies",
            durationSeconds: 80,
            talkingPoints: ["Analog oscillator history", "Low-pass filter resonance mapping to flow states"]
          },
          {
            sectionTitle: "Conclusion: City Skyline",
            durationSeconds: 45,
            talkingPoints: ["Final summary of focus frequency", "End credits screen"]
          }
        ];

    const storyboard = isShort
      ? [
          {
            sceneNumber: 1,
            visualPrompt: "Retro green terminal screen pulsing, text SYSTEM BOOTING",
            narrationText: "Ever wonder why night-coding feels so... addictive?"
          },
          {
            sceneNumber: 2,
            visualPrompt: "Close-up of neon mechanical key switches clicking in a dark studio",
            narrationText: "It's not just the quiet. It's the sound. Specifically, low-frequency dark synth waves."
          },
          {
            sceneNumber: 3,
            visualPrompt: "Glow-in-the-dark oscilloscope lines synching to heavy audio waves",
            narrationText: "Science shows 72Bpm loops lock your brain into flow state. Boot up your terminal, throw on the beats, and write code."
          }
        ]
      : [
          {
            sceneNumber: 1,
            visualPrompt: "Camera pans slowly across a dim developer setup, terminal screen showing green code lines",
            narrationText: "In the quiet hours of the night, the line between technology and art begins to blur. For developers, this workspace is a digital canvas."
          },
          {
            sceneNumber: 2,
            visualPrompt: "Close-up of hands typing on mechanical keyboards, backlit in deep blue and indigo",
            narrationText: "But code requires focus. And focus requires a soundtrack. The rises of dark electronic beats has redefined the nighttime developer studio."
          },
          {
            sceneNumber: 3,
            visualPrompt: "Green neon laser lines forming a holographic city grid, oscilloscope waving in sync",
            narrationText: "Born from 1980s analog voltage oscillators, this genre blends low-pass filters with a steady pacing that maps to cognitive flow states."
          },
          {
            sceneNumber: 4,
            visualPrompt: "Wide view of city skyline from a skyscraper window, raindrops falling on glass",
            narrationText: "Next time you boot your terminal, listen closely to the frequency of focus. Booting up, coding on, and breaking through."
          }
        ];

    return NextResponse.json({ script, outline, storyboard });
  }

  // Stage 3: Stock b-roll / Scene pictures Sourcing
  if (path === "stock/search") {
    // Return mock image URLs from Unsplash matching space, neon, studio, terminal themes
    const isShort = format === "short";
    
    // We map Unsplash images that render beautifully
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

    return NextResponse.json(images);
  }

  // Stage 3: Stock b-roll / Scene Videos Sourcing
  if (path === "stock/videos") {
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
    return NextResponse.json(videos);
  }

  // Stage 3: Video Render (Celery dispatch simulator)
  if (path === "video/render") {
    const taskId = "task_" + Math.random().toString(36).substring(2, 9);
    renderTasks.set(taskId, { progress: 0, status: "pending", format });
    return NextResponse.json({ taskId });
  }

  // Stage 4: SEO Titles
  if (path === "seo/titles") {
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
    return NextResponse.json({ titles });
  }

  // Stage 4: SEO Metadata
  if (path === "seo/metadata") {
    const isShort = format === "short";
    
    const description = isShort
      ? `Get locked in. This is the science of why dark synth beats increase focus while coding.

#shorts #synthwave #coding #cyberpunk #lofi`
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

    return NextResponse.json({ description, tags, chapters });
  }

  // Stage 4: Publish
  if (path === "publish") {
    return NextResponse.json({
      status: "published",
      publishedUrl: "https://studio.youtube.com/video/mock-draft/edit",
      message: "Uploaded as draft successfully."
    });
  }

  return NextResponse.json({ error: `Not found: ${path}` }, { status: 404 });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; slug?: string[] }> }
) {
  const { projectId, slug } = await context.params;
  const path = slug ? slug.join("/") : "";

  // Stage 3: Video Status Polling
  // Format matches /video/render/:taskId/status
  if (path.startsWith("video/render/") && path.endsWith("/status")) {
    const segments = path.split("/");
    const taskId = segments[2]; // video/render/[taskId]/status
    
    const task = renderTasks.get(taskId);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Increment progress simulated on each poll
    let nextProgress = task.progress + 25;
    let nextStatus = "in_progress";

    if (nextProgress >= 100) {
      nextProgress = 100;
      nextStatus = "complete";
    }

    // Update in-memory db
    renderTasks.set(taskId, {
      ...task,
      progress: nextProgress,
      status: nextStatus,
    });

    const isShort = task.format === "short";
    
    // Public sample MP4 URLs from Google CDN
    // Using simple loop streams that are lightweight and reliable
    const videoUrl = nextStatus === "complete"
      ? (isShort 
         ? "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4"
         : "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4")
      : null;

    return NextResponse.json({
      status: nextStatus,
      progress: nextProgress,
      videoUrl,
    });
  }

  return NextResponse.json({ error: `Not found: ${path}` }, { status: 404 });
}
