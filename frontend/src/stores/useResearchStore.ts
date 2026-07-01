import { create } from "zustand";

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
  visualAnalysis?: string;
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
  visualAnalysis?: string;
  thumbnailUrl?: string;
}

export function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*\*(.+?)\*\*\*/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/^[-*_]{3,}\s*$/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface ResearchState {
  trends: TrendItem[];
  summaries: ResearchSummary | null;
  activeTrend: TrendItem | null;
  setTrends: (trends: TrendItem[]) => void;
  setSummaries: (summaries: ResearchSummary | null) => void;
  setActiveTrend: (trend: TrendItem | null) => void;
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

export const useResearchStore = create<ResearchState>()((set) => ({
  trends: [],
  summaries: null,
  activeTrend: null,
  setTrends: (trends) => {
    const seen = new Set<string>();
    const deduped = trends.filter((trend, index) => {
      const key =
        trend.videoUrl?.trim() ||
        `${trend.title.trim()}::${trend.channelName.trim()}::${index}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    set({ trends: deduped });
  },
  setSummaries: (summaries) =>
    set({
      summaries: summaries
        ? { ...summaries, summaryText: stripMarkdown(summaries.summaryText) }
        : null,
    }),
  setActiveTrend: (trend) => set({ activeTrend: trend }),
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
  clearResearch: () => set({ trends: [], summaries: null, activeTrend: null }),
}));
