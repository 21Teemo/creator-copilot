import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ContentFormat = "long" | "short";

interface ProjectState {
  contentFormat: ContentFormat;
  addAudioEnabled: boolean;
  lastGeneratedFormat: ContentFormat | null;
  setContentFormat: (format: ContentFormat) => void;
  setAddAudioEnabled: (enabled: boolean) => void;
  setLastGeneratedFormat: (format: ContentFormat | null) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      contentFormat: "long",
      addAudioEnabled: false,
      lastGeneratedFormat: null,
      setContentFormat: (format) => set({ contentFormat: format }),
      setAddAudioEnabled: (enabled) => set({ addAudioEnabled: enabled }),
      setLastGeneratedFormat: (format) => set({ lastGeneratedFormat: format }),
    }),
    {
      name: "studio-project-store",
    }
  )
);
