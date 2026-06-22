import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface OutlineItem {
  sectionTitle: string;
  durationSeconds: number;
  talkingPoints: string[];
}

export interface StoryboardScene {
  sceneNumber: number;
  visualPrompt: string;
  narrationText: string;
}

export interface ThumbnailConcept {
  id: string;
  prompt: string;
  explanation: string;
  ctrScore?: number; // 0 to 100
  feedback?: string;
  imageUrl?: string;
}

export interface VisualStyle {
  id: string;
  name: string;
  aesthetic: string;
  colors: string[];
  lighting: string;
  composition: string;
  environment: string;
  promptSnippet: string;
  bestFor: string;
  pairings: string;
}

export const VISUAL_STYLES: VisualStyle[] = [
  {
    id: "default",
    name: "Default",
    aesthetic: "Default style generated from narration script and prompt context.",
    colors: ["#A855F7", "#6366F1"],
    lighting: "Standard dynamic studio lighting.",
    composition: "Balanced composition.",
    environment: "Standard scene setup.",
    promptSnippet: "",
    bestFor: "All video types.",
    pairings: "None"
  },
  {
    id: "corpse_bride",
    name: "Corpse Bride",
    aesthetic: "Tim Burton Stop-Motion. Dark whimsy, Gothic fantasy, elegant macabre stop-motion. High contrast, Victorian Gothic with playful horror.",
    colors: ["#F5F0E6", "#A8C5D9", "#6B5B8C", "#6B2D3C", "#1A1F3D", "#0D0D0D"],
    lighting: "Dramatic side/rim lighting, deep expressive shadows, cool moonlight or warm candle accents.",
    composition: "Slightly off-kilter framing, expressive theatrical poses, intricate fabric and bone textures.",
    environment: "Decaying yet opulent Victorian mansions, grand ballrooms with torn velvet, cobwebbed chandeliers.",
    promptSnippet: "Tim Burton Corpse Bride stop-motion style, high contrast lighting, detailed textures, whimsical dark humor, cinematic composition",
    bestFor: "Dark industrial techno, horror-tinged lyrics, classic gothic vibe.",
    pairings: "Blend with del Toro for richer textures; with Wes Anderson for symmetrical macabre formality."
  },
  {
    id: "del_toro",
    name: "Guillermo del Toro",
    aesthetic: "Dark Fantasy Cinematic. Cinematic dark fantasy with tragic beauty. Practical effects sensibility, rich tactile textures, monsters that feel soulful and beautiful. Mexican cultural resonance.",
    colors: ["#8B1E3D", "#C9A24E", "#1E3A2F", "#D4A017", "#0E3D4A", "#E8D9C0"],
    lighting: "Volumetric god rays through dusty air, strong practical light sources (candles, fire, lanterns). Warm highlights against cool deep shadows.",
    composition: "Cinematic wide shots with intimate character focus. Layered depth, foreground details (roots, ornate objects).",
    environment: "Labyrinthine mansions, overgrown ballrooms, candlelit cathedrals, opulent rooms reclaimed by nature.",
    promptSnippet: "Guillermo del Toro dark fantasy cinematic style, intricate practical textures, volumetric lighting, rich color grading, atmospheric depth",
    bestFor: "Cinematic dark fantasy, Latin fusion with gothic edge, tragic themes.",
    pairings: "Core with Arcane for painterly richness; with Dalí for surreal narrative depth."
  },
  {
    id: "pixar",
    name: "Pixar 3D",
    aesthetic: "Warm Family Storytelling. Polished 3D CGI with heart. Warm, appealing, emotionally resonant storytelling. Clean yet richly detailed surfaces.",
    colors: ["#E07A5F", "#3D8B8B", "#F2CC8F", "#6B3E4B", "#F4EDE4", "#2D4739"],
    lighting: "Beautiful soft key light with warm bounce, gentle rim lighting, pleasing color harmony.",
    composition: "Character-driven, clear focal points, dynamic readable angles. Strong silhouette readability.",
    environment: "Lush, detailed lavish interiors with warm wood, fabrics, and personal touches. Lived-in and inviting.",
    promptSnippet: "Pixar 3D animation style, warm cinematic lighting, highly detailed textures, emotional storytelling composition, appealing design, family-friendly whimsy",
    bestFor: "Whimsical or heartwarming character stories, meme-style or positive narratives.",
    pairings: "With Wes Anderson for symmetrical charm; with Amélie for intimate whimsical realism."
  },
  {
    id: "amelie",
    name: "Amélie",
    aesthetic: "Whimsical Realism. Whimsical narrative realism. Charming, slightly magical everyday beauty. Warm, saturated yet natural color grading. Intimate, story-rich frames.",
    colors: ["#C73E3A", "#2E8B57", "#E8C547", "#6FA8DC", "#F5EDE0", "#5C2A3D"],
    lighting: "Soft natural window light mixed with warm practicals. Gentle glows, shallow depth of field for intimacy.",
    composition: "Thoughtful framing that feels like a story moment captured. Leading lines to character.",
    environment: "Cozy opulent apartments or mansions with personal collections, plants, warm textiles.",
    promptSnippet: "Amélie whimsical realism style, warm saturated color grading, shallow depth of field, charming character in intimate lavish interior, narrative film still, delightful details",
    bestFor: "Narrative-driven or character-focused pieces, romantic or quirky tracks.",
    pairings: "With Pixar for 3D warmth; with Holiday Nakashima for filmic memory texture."
  },
  {
    id: "nakashima",
    name: "Tetsuya Nakashima",
    aesthetic: "Holiday Atmosphere. Stylized Japanese cinematic commercial aesthetic with memory/film grain texture. Vibrant yet nostalgic, condensed information-rich frames. Emotional polish.",
    colors: ["#4A7C8C", "#D98E4A", "#B76E79", "#2C3E2D", "#EDE4D5", "#9C2E2E"],
    lighting: "Polished cinematic with emotional color contrast. Soft highlights, gentle grain overlay for texture.",
    composition: "Dynamic yet controlled. Can be information-dense or beautifully sparse. Strong use of color blocks.",
    environment: "Stylized lavish spaces - grand hotels, ballrooms, or intimate dramatic rooms with rich textures.",
    promptSnippet: "Tetsuya Nakashima cinematic style, film grain texture, stylized commercial Japanese film aesthetic, emotional color grading, opulent memory-like lavish setting, polished yet textured",
    bestFor: "Special 'holiday' or memory-themed content, commercial polish, emotional or reflective pieces.",
    pairings: "With Amélie for intimate warmth; with Arcane for textured painterly depth."
  },
  {
    id: "arcane",
    name: "Arcane Season",
    aesthetic: "Painterly 3D Stylized Realism. Hand-painted texture over 3D forms. Rich, expressive, gritty-beautiful industrial fantasy. Dramatic lighting, emotional weight.",
    colors: ["#C9A04E", "#3D2A5E", "#8B4513", "#00A8A8", "#E8D5B7", "#1C2533"],
    lighting: "Dramatic key + rim + fill with strong emotional intent. Neon or magical practicals mixed with natural.",
    composition: "Epic yet character intimate. Strong use of negative space and leading lines.",
    environment: "Lavish but with industrial or arcane edge - grand halls with exposed structure, opulent decay.",
    promptSnippet: "Arcane League of Legends painterly 3D style, hand-painted textures, stylized realism, dramatic cinematic lighting, emotional atmosphere",
    bestFor: "Industrial techno, acid house, cyberpunk-gothic fusion tracks.",
    pairings: "With del Toro for deeper fantasy soul; with BDO for photoreal upgrade."
  },
  {
    id: "wes_anderson",
    name: "Wes Anderson",
    aesthetic: "Symmetrical Warmth & Family Absurdism. Meticulous symmetry, rich controlled color palettes, deadpan whimsy, obsessive detail. Perfectly composed frames.",
    colors: ["#D4A84B", "#C17B7B", "#3A5F3A", "#7BA3C9", "#F5EDE0", "#5C2A3D"],
    lighting: "Even, flattering, slightly theatrical. Clean shadows, beautiful color harmony. Often frontal or side light.",
    composition: "Strictly symmetrical or strongly centered. Horizontal lines, layered depth through set design.",
    environment: "Perfectly designed lavish interiors - grand hotels, family estates, ballrooms with obsessive symmetry.",
    promptSnippet: "Wes Anderson symmetrical composition style, rich controlled color palette, meticulous detail, deadpan whimsical character, centered framing",
    bestFor: "Quirky elegant tracks, family or ensemble skeleton concepts, shareable symmetrical thumbnails.",
    pairings: "With Pixar for warmer 3D appeal; with Corpse Bride for macabre formal symmetry."
  },
  {
    id: "dali",
    name: "Salvador Dalí",
    aesthetic: "Surrealist Absurdism. Hyper-detailed surreal dream logic. Precise rendering of the impossible. Symbolic, psychological, elegant absurdity.",
    colors: ["#D4AF37", "#4A6FA5", "#E8D9C0", "#1A1A2E", "#C65D3B", "#5E3A6E"],
    lighting: "Ethereal, often with long dramatic shadows or impossible light sources. Soft atmospheric perspective.",
    composition: "Classical yet impossible. Strong horizon lines or vanishing points. Symbolic objects arranged with intent.",
    environment: "Impossible lavish architecture - melting mansions, infinite ballrooms, floating furniture, desert interiors.",
    promptSnippet: "Salvador Dalí surrealist style, hyper-detailed precise rendering, dream logic, elegant absurd character in impossible lavish architecture, symbolic composition",
    bestFor: "Experimental, psychedelic, or deeply thematic tracks. Surreal music video concepts.",
    pairings: "With BDO for photoreal surrealism; with del Toro for narrative dark fantasy surreal."
  },
  {
    id: "bdo",
    name: "Black Desert Online",
    aesthetic: "Photorealistic Cinematic 3D. Ultra high-fidelity photorealistic 3D rendering. Stunning material detail, cinematic lighting and depth of field.",
    colors: ["#5C4033", "#C9A961", "#1E2A1E", "#A8B5C4", "#E8D9C0", "#6B1E2E"],
    lighting: "Cinematic three-point with beautiful global illumination and subtle caustics/reflections.",
    composition: "Cinematic photography approach. Strong use of depth of field, leading lines, rule of thirds.",
    environment: "Photorealistic lavish locations - real-world inspired grand estates, ballrooms, libraries.",
    promptSnippet: "Black Desert Online cinematic 3D style, photorealistic high-fidelity rendering, detailed materials and lighting, filmic depth of field",
    bestFor: "Premium, almost live-action quality visuals. High-production value thumbnails and key art.",
    pairings: "With Arcane for painterly upgrade; with Dalí for surreal photoreal scenes."
  }
];

interface ScriptingState {
  script: string;
  outline: OutlineItem[];
  storyboard: StoryboardScene[];
  thumbnailConcepts: ThumbnailConcept[];
  selectedStyle: string;
  setScript: (script: string) => void;
  setOutline: (outline: OutlineItem[]) => void;
  setStoryboard: (storyboard: StoryboardScene[]) => void;
  setThumbnailConcepts: (concepts: ThumbnailConcept[]) => void;
  updateThumbnailConceptGrade: (id: string, ctrScore: number, feedback: string) => void;
  setSelectedStyle: (styleId: string) => void;
  clearScripting: () => void;
}

export const useScriptingStore = create<ScriptingState>()(
  persist(
    (set) => ({
      script: "",
      outline: [],
      storyboard: [],
      thumbnailConcepts: [],
      selectedStyle: "default",
      setScript: (script) => {
        set((state) => {
          const sceneRegex = /\[Scene\s+(\d+)\s*-\s*Visual:\s*([\s\S]*?)\]/gi;
          const storyboard: StoryboardScene[] = [];
          let match;
          const matches: { index: number; sceneNumber: number; visualPrompt: string }[] = [];
          
          while ((match = sceneRegex.exec(script)) !== null) {
            matches.push({
              index: match.index,
              sceneNumber: parseInt(match[1], 10),
              visualPrompt: match[2].trim(),
            });
          }

          for (let i = 0; i < matches.length; i++) {
            const current = matches[i];
            const nextIndex = i + 1 < matches.length ? matches[i + 1].index : script.length;
            const startOfNarration = current.index + script.substring(current.index).indexOf("]") + 1;
            const blockText = script.substring(startOfNarration, nextIndex).trim();
            
            let narrationText = "";
            const voiceoverMatch = blockText.match(/Voiceover:\s*([\s\S]*)/i);
            if (voiceoverMatch) {
              narrationText = voiceoverMatch[1].trim();
            } else {
              narrationText = blockText.trim();
            }

            let cleanPrompt = current.visualPrompt;
            for (const style of VISUAL_STYLES) {
              if (style.promptSnippet && cleanPrompt.startsWith(style.promptSnippet + ", ")) {
                cleanPrompt = cleanPrompt.substring(style.promptSnippet.length + 2);
                break;
              }
            }

            const currentStyle = VISUAL_STYLES.find(s => s.id === state.selectedStyle);
            const finalPrompt = currentStyle && currentStyle.promptSnippet
              ? `${currentStyle.promptSnippet}, ${cleanPrompt}`
              : cleanPrompt;

            storyboard.push({
              sceneNumber: current.sceneNumber,
              visualPrompt: finalPrompt,
              narrationText,
            });
          }

          return {
            script,
            storyboard,
          };
        });
      },
      setOutline: (outline) => set({ outline }),
      setStoryboard: (storyboard) => set({ storyboard }),
      setThumbnailConcepts: (thumbnailConcepts) => set({ thumbnailConcepts }),
      updateThumbnailConceptGrade: (id, ctrScore, feedback) =>
        set((state) => ({
          thumbnailConcepts: state.thumbnailConcepts.map((concept) =>
            concept.id === id ? { ...concept, ctrScore, feedback } : concept
          ),
        })),
      setSelectedStyle: (styleId) => {
        set((state) => {
          const newStyle = VISUAL_STYLES.find(s => s.id === styleId);
          const newPrefix = newStyle && newStyle.promptSnippet ? `${newStyle.promptSnippet}, ` : "";

          // Rewrite storyboard state (do NOT mutate narration script text)
          const updatedStoryboard = state.storyboard.map((scene) => {
            let cleanPrompt = scene.visualPrompt;
            for (const style of VISUAL_STYLES) {
              if (style.promptSnippet && cleanPrompt.startsWith(style.promptSnippet + ", ")) {
                cleanPrompt = cleanPrompt.substring(style.promptSnippet.length + 2);
                break;
              }
            }
            const newPrompt = newPrefix + cleanPrompt;
            return {
              ...scene,
              visualPrompt: newPrompt
            };
          });

          return {
            selectedStyle: styleId,
            storyboard: updatedStoryboard
          };
        });
      },
      clearScripting: () =>
        set({
          script: "",
          outline: [],
          storyboard: [],
          thumbnailConcepts: [],
          selectedStyle: "default",
        }),
    }),
    {
      name: "studio-scripting-store",
    }
  )
);
