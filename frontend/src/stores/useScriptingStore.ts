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

interface ScriptingState {
  script: string;
  outline: OutlineItem[];
  storyboard: StoryboardScene[];
  thumbnailConcepts: ThumbnailConcept[];
  setScript: (script: string) => void;
  setOutline: (outline: OutlineItem[]) => void;
  setStoryboard: (storyboard: StoryboardScene[]) => void;
  setThumbnailConcepts: (concepts: ThumbnailConcept[]) => void;
  updateThumbnailConceptGrade: (id: string, ctrScore: number, feedback: string) => void;
  clearScripting: () => void;
}

export const useScriptingStore = create<ScriptingState>()(
  persist(
    (set) => ({
      script: "",
      outline: [],
      storyboard: [],
      thumbnailConcepts: [],
      setScript: (script) => set({ script }),
      setOutline: (outline) => set({ outline }),
      setStoryboard: (storyboard) => set({ storyboard }),
      setThumbnailConcepts: (thumbnailConcepts) => set({ thumbnailConcepts }),
      updateThumbnailConceptGrade: (id, ctrScore, feedback) =>
        set((state) => ({
          thumbnailConcepts: state.thumbnailConcepts.map((concept) =>
            concept.id === id ? { ...concept, ctrScore, feedback } : concept
          ),
        })),
      clearScripting: () =>
        set({
          script: "",
          outline: [],
          storyboard: [],
          thumbnailConcepts: [],
        }),
    }),
    {
      name: "studio-scripting-store",
    }
  )
);
