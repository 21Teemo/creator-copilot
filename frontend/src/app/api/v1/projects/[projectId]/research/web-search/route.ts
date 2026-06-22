import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  let body: any = {};
  try {
    body = await request.json();
  } catch (e) {}

  const format = body.contentFormat || "long";
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

  await new Promise((resolve) => setTimeout(resolve, 600));

  return NextResponse.json({ summaryText, sources });
}
