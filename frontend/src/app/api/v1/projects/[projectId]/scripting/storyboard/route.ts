import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  let body: any = {};
  try {
    body = await request.json();
  } catch (e) {}

  const format = body.contentFormat || "long";
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

  await new Promise((resolve) => setTimeout(resolve, 600));

  return NextResponse.json({ script, outline, storyboard });
}
