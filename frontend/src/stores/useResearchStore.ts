import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface TrendItem {
  title: string;
  views: string;
  duration: string;
  description: string;
  channelName: string;
  publishedAt: string;
}

export interface FactSource {
  title: string;
  url: string;
  snippet?: string;
}

export interface ResearchSummary {
  summaryText: string;
  sources: FactSource[];
}

interface ResearchState {
  trends: TrendItem[];
  summaries: ResearchSummary | null;
  setTrends: (trends: TrendItem[]) => void;
  setSummaries: (summaries: ResearchSummary | null) => void;
  clearResearch: () => void;
}

export const useResearchStore = create<ResearchState>()(
  persist(
    (set) => ({
      trends: [],
      summaries: null,
      setTrends: (trends) => set({ trends }),
      setSummaries: (summaries) => set({ summaries }),
      clearResearch: () => set({ trends: [], summaries: null }),
    }),
    {
      name: "studio-research-store",
    }
  )
);
