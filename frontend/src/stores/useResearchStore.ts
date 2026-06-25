import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface EngagementSegment {
  start: number;
  end: number;
  startLabel: string;
  endLabel: string;
  score: number;
}

export interface TrendItem {
  title: string;
  views: string;
  rawViews?: number;
  duration: string;
  durationSeconds?: number;
  description: string;
  channelName: string;
  publishedAt: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  likes?: number;
  comments?: number;
  subscriberCount?: number;
  commentVelocity?: number;
  subscriberGap?: number;
  viralityScore?: number;
  trendExplanation?: string;
  engagementSegments?: EngagementSegment[];
  heatmapAvailable?: boolean;
  engagementSource?: string;
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
  updateSummaryText: (text: string) => void;
  updateTrendExplanation: (videoUrl: string, explanation: string) => void;
  updateTrendEngagement: (
    videoUrl: string,
    segments: EngagementSegment[],
    heatmapAvailable: boolean,
    engagementSource: string
  ) => void;
  clearResearch: () => void;
}

export const useResearchStore = create<ResearchState>()(
  persist(
    (set) => ({
      trends: [],
      summaries: null,
      setTrends: (trends) => set({ trends }),
      setSummaries: (summaries) => set({ summaries }),
      updateSummaryText: (text) =>
        set((state) => ({
          summaries: state.summaries
            ? { ...state.summaries, summaryText: text }
            : null,
        })),
      updateTrendExplanation: (videoUrl, explanation) =>
        set((state) => ({
          trends: state.trends.map((trend) =>
            trend.videoUrl === videoUrl ? { ...trend, trendExplanation: explanation } : trend
          ),
        })),
      updateTrendEngagement: (videoUrl, segments, heatmapAvailable, engagementSource) =>
        set((state) => ({
          trends: state.trends.map((trend) =>
            trend.videoUrl === videoUrl
              ? {
                  ...trend,
                  engagementSegments: segments,
                  heatmapAvailable,
                  engagementSource,
                }
              : trend
          ),
        })),
      clearResearch: () => set({ trends: [], summaries: null }),
    }),
    {
      name: "studio-research-store",
    }
  )
);
