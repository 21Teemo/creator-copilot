import { create } from "zustand";
import { ContentFormat } from "./useProjectStore";

export type StudioView = "welcome" | "trends" | "facts" | "script" | "scenes" | "video" | "ffmpeg" | "seo";

export interface PromptHistoryEntry {
  prompt: string;
  action: string;
  contentFormat: ContentFormat;
  timestamp: number;
}

interface StudioState {
  activeView: StudioView;
  promptHistory: PromptHistoryEntry[];
  loading: boolean;
  setActiveView: (view: StudioView) => void;
  addPromptHistory: (prompt: string, action: string, contentFormat: ContentFormat) => void;
  clearPromptHistory: () => void;
  setLoading: (loading: boolean) => void;
}

export const useStudioStore = create<StudioState>()((set) => ({
  activeView: "welcome",
  promptHistory: [],
  loading: false,
  setActiveView: (view) => set({ activeView: view }),
  addPromptHistory: (prompt, action, contentFormat) =>
    set((state) => ({
      promptHistory: [
        ...state.promptHistory,
        { prompt, action, contentFormat, timestamp: Date.now() },
      ],
    })),
  clearPromptHistory: () => set({ promptHistory: [] }),
  setLoading: (loading) => set({ loading }),
}));
