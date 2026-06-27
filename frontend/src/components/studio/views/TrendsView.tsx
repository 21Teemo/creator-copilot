"use client";

import React, { useState } from "react";
import { useResearchStore } from "@/stores/useResearchStore";
import { useProjectStore } from "@/stores/useProjectStore";
import { apiRequest } from "@/lib/api";
import {
  Eye,
  Clock,
  User,
  Compass,
  Play,
  Sparkles,
  MessageSquare,
  Flame,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Loader2,
  Activity,
} from "lucide-react";

interface TrendsViewProps {
  projectId: string;
  onPush?: (prompt: string, action: string) => void;
}

export default function TrendsView({ projectId, onPush }: TrendsViewProps) {
  const trends = useResearchStore((state) => state.trends);
  const setActiveTrend = useResearchStore((state) => state.setActiveTrend);
  const updateTrendExplanation = useResearchStore((state) => state.updateTrendExplanation);
  const updateTrendEngagement = useResearchStore((state) => state.updateTrendEngagement);
  const contentFormat = useProjectStore((state) => state.contentFormat);
  const [expandedInsight, setExpandedInsight] = useState<Record<number, boolean>>({});
  const [loadingInsight, setLoadingInsight] = useState<Record<number, boolean>>({});
  const [insightErrors, setInsightErrors] = useState<Record<number, string>>({});

  const toggleInsight = async (index: number) => {
    const item = trends[index];
    const willExpand = !expandedInsight[index];

    setExpandedInsight((prev) => ({
      ...prev,
      [index]: willExpand,
    }));

    if (!willExpand || !item.videoUrl) return;

    const needsExplanation = !item.trendExplanation;
    const needsEngagement = !item.engagementSegments?.length;
    if (!needsExplanation && !needsEngagement) return;

    setLoadingInsight((prev) => ({ ...prev, [index]: true }));
    setInsightErrors((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });

    try {
      const tasks: Promise<void>[] = [];

      if (needsExplanation) {
        tasks.push(
          apiRequest(projectId, "/research/trends/explain", "POST", {
            title: item.title,
            description: item.description,
            channelName: item.channelName,
            videoUrl: item.videoUrl,
          }).then((res) => {
            updateTrendExplanation(item.videoUrl!, res.explanation);
          })
        );
      }

      if (needsEngagement) {
        tasks.push(
          apiRequest(projectId, "/research/trends/engagement", "POST", {
            videoUrl: item.videoUrl,
            durationSeconds: item.durationSeconds,
            contentFormat,
            rawViews: item.rawViews,
            likes: item.likes,
            comments: item.comments,
          }).then((res) => {
            updateTrendEngagement(
              item.videoUrl!,
              res.segments,
              res.heatmapAvailable,
              res.source
            );
          })
        );
      }

      await Promise.all(tasks);
    } catch (err) {
      console.error("Failed to load trend insights:", err);
      setInsightErrors((prev) => ({
        ...prev,
        [index]: "Could not load trend insights. Try again.",
      }));
    } finally {
      setLoadingInsight((prev) => ({ ...prev, [index]: false }));
    }
  };

  if (trends.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-center py-12">
        <Compass size={40} className="text-studio-text-secondary mb-4" />
        <p className="text-sm text-studio-text-primary font-bold mb-1">No trends data available</p>
        <p className="text-xs text-studio-text-secondary max-w-sm">
          Enter a niche topic in the prompt bar below to scan{" "}
          {contentFormat === "short" ? "TikTok" : "YouTube long-form"} trends.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 h-full select-none">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h3 className="text-base font-bold text-studio-text-primary">
            Niche Trend Scan Results
          </h3>
          <p className="text-xs text-studio-text-secondary">
            Displaying {trends.length} matching content signals
          </p>
        </div>
        <div className="px-2.5 py-1 rounded-full bg-accent/15 border border-accent/30 text-[10px] font-bold text-accent uppercase tracking-wider">
          {contentFormat === "short" ? "TikTok · 9:16" : "16:9 Horizontal Presets"}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        <div
          className={`grid gap-4 ${
            contentFormat === "short"
              ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
              : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
          }`}
        >
          {trends.map((item, index) => (
            <div
              key={item.videoUrl || `${item.title}-${index}`}
              className="flex flex-col rounded-2xl bg-studio-surface border border-studio-border/60 overflow-hidden hover:border-accent/40 hover:shadow-studio transition-all duration-200"
            >
              <a
                href={item.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`relative block bg-studio-bg overflow-hidden group/thumb cursor-pointer ${
                  contentFormat === "short" ? "aspect-[9/16]" : "aspect-[16/9]"
                }`}
              >
                {item.thumbnailUrl ? (
                  <img
                    src={item.thumbnailUrl}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover/thumb:opacity-100 transition-opacity duration-200"
                    onError={(e) => {
                      const el = e.target as HTMLImageElement;
                      el.style.display = "none";
                      const fallback = el.parentElement?.querySelector("[data-fallback]") as HTMLElement;
                      if (fallback) fallback.style.display = "flex";
                    }}
                  />
                ) : null}

                <div
                  data-fallback
                  className={`absolute inset-0 bg-gradient-to-br from-indigo-900/80 via-purple-900/60 to-zinc-900/90 items-center justify-center ${
                    item.thumbnailUrl ? "hidden" : "flex"
                  }`}
                >
                  <Play size={24} className="text-white/30" />
                </div>

                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

                <div className="absolute inset-0 flex items-center justify-center opacity-40 group-hover/thumb:opacity-100 bg-black/0 group-hover/thumb:bg-black/40 transition-all duration-200 pointer-events-none">
                  <div className="w-11 h-11 rounded-full bg-accent text-white flex items-center justify-center shadow-lg group-hover/thumb:scale-110 transition-transform">
                    <Play size={18} fill="currentColor" className="ml-0.5" />
                  </div>
                </div>

                <div className="absolute bottom-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/75 text-[10px] font-semibold text-studio-text-primary">
                  <Clock size={10} />
                  {item.duration}
                </div>

                <div className="absolute top-2 left-2 w-5 h-5 flex items-center justify-center rounded-full bg-studio-surface/80 border border-studio-border/50 text-[10px] font-bold text-accent">
                  {index + 1}
                </div>
              </a>

              <div className="p-3.5 flex flex-col flex-1">
                {item.videoUrl ? (
                  <a
                    href={item.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-studio-text-primary line-clamp-2 mb-1.5 leading-tight hover:text-accent transition-colors cursor-pointer"
                  >
                    {item.title}
                  </a>
                ) : (
                  <h4 className="text-xs font-bold text-studio-text-primary line-clamp-2 mb-1.5 leading-tight">
                    {item.title}
                  </h4>
                )}

                <div className="flex items-center gap-1.5 text-[10px] text-studio-text-secondary mb-2 truncate">
                  <User size={10} className="shrink-0" />
                  <span className="truncate">{item.channelName}</span>
                  <span className="shrink-0 font-extrabold">&middot;</span>
                  <span className="shrink-0">{item.publishedAt}</span>
                </div>

                <p className="text-[11px] text-studio-text-secondary line-clamp-3 leading-relaxed flex-1 mb-2.5">
                  {item.description}
                </p>

                <div className="grid grid-cols-3 gap-1.5 mb-3 bg-studio-bg/60 p-2 rounded-xl border border-studio-border/30 text-[10px] shrink-0">
                  <div className="flex flex-col items-center justify-center p-1 text-center">
                    <span className="text-studio-text-secondary font-medium mb-0.5 flex items-center gap-0.5">
                      <Flame size={10} className="text-amber-500 shrink-0" /> Virality
                    </span>
                    <span className="font-bold text-studio-text-primary text-[11px]">
                      {item.viralityScore !== undefined && item.viralityScore !== null ? `${item.viralityScore}%` : "N/A"}
                    </span>
                  </div>
                  <div className="flex flex-col items-center justify-center p-1 text-center border-x border-studio-border/30">
                    <span className="text-studio-text-secondary font-medium mb-0.5 flex items-center gap-0.5">
                      <MessageSquare size={10} className="text-accent shrink-0" /> Velocity
                    </span>
                    <span className="font-bold text-studio-text-primary text-[11px]">
                      {item.commentVelocity !== undefined && item.commentVelocity !== null ? `${item.commentVelocity}/hr` : "N/A"}
                    </span>
                  </div>
                  <div className="flex flex-col items-center justify-center p-1 text-center">
                    <span className="text-studio-text-secondary font-medium mb-0.5 flex items-center gap-0.5">
                      <TrendingUp size={10} className="text-emerald-500 shrink-0" /> Sub Gap
                    </span>
                    <span className="font-bold text-studio-text-primary text-[11px]">
                      {item.subscriberGap !== undefined && item.subscriberGap !== null ? `x${item.subscriberGap}` : "N/A"}
                    </span>
                  </div>
                </div>

                {item.videoUrl && (
                  <div className="mb-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => void toggleInsight(index)}
                      disabled={loadingInsight[index]}
                      className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg bg-accent/5 hover:bg-accent/10 border border-accent/20 text-[10px] text-accent font-bold transition-all cursor-pointer disabled:opacity-70"
                    >
                      <span className="flex items-center gap-1">
                        {loadingInsight[index] ? (
                          <Loader2 size={11} className="animate-spin shrink-0" />
                        ) : (
                          <Sparkles size={11} className="text-amber-500 shrink-0" />
                        )}
                        Why It&apos;s Trending
                      </span>
                      {expandedInsight[index] ? (
                        <ChevronUp size={12} className="shrink-0" />
                      ) : (
                        <ChevronDown size={12} className="shrink-0" />
                      )}
                    </button>
                    {expandedInsight[index] && (
                      <div className="mt-1.5 p-2.5 rounded-lg bg-studio-bg border border-studio-border/50 text-[10px] text-studio-text-secondary leading-relaxed space-y-2 shadow-inner">
                        {loadingInsight[index] && (
                          <p className="text-studio-text-secondary italic">Loading engagement + AI analysis...</p>
                        )}
                        {insightErrors[index] && (
                          <p className="text-red-400">{insightErrors[index]}</p>
                        )}

                        {!loadingInsight[index] && item.engagementSegments && item.engagementSegments.length > 0 && (
                          <div className="space-y-1.5 pb-2 border-b border-studio-border/40">
                            <div className="flex items-center justify-between gap-2">
                              <span className="flex items-center gap-1 text-accent font-bold">
                                <Activity size={11} className="shrink-0" />
                                Peak engagement
                              </span>
                              <span className="text-[9px] text-studio-text-secondary uppercase tracking-wide">
                                {item.videoUrl?.includes("tiktok.com")
                                  ? item.engagementSource === "tiktok_metrics"
                                    ? "TikTok metrics"
                                    : "Estimated"
                                  : item.heatmapAvailable
                                    ? "YouTube heatmap"
                                    : "Estimated"}
                              </span>
                            </div>
                            {item.engagementSegments.map((segment, segIdx) => (
                              <div
                                key={segIdx}
                                className="flex items-center justify-between gap-2 rounded-md bg-studio-surface/60 px-2 py-1"
                              >
                                <span className="font-mono text-studio-text-primary">
                                  {segment.startLabel}–{segment.endLabel}
                                </span>
                                <span className="font-bold text-amber-500">{segment.score}%</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {!loadingInsight[index] &&
                          item.trendExplanation &&
                          item.trendExplanation
                            .split("\n")
                            .filter((line) => line.trim())
                            .map((bullet, idx) => (
                              <div key={idx} className="flex gap-1.5">
                                <span className="text-accent select-none shrink-0">•</span>
                                <span>{bullet.replace(/^[•\-\*\s]+/, "")}</span>
                              </div>
                            ))}
                      </div>
                    )}
                  </div>
                )}

                {!item.videoUrl && item.trendExplanation && (
                  <div className="mb-3 p-2.5 rounded-lg bg-studio-bg border border-studio-border/50 text-[10px] text-studio-text-secondary leading-relaxed space-y-1.5 shadow-inner shrink-0">
                    {item.trendExplanation.split("\n").filter((line) => line.trim()).map((bullet, idx) => (
                      <div key={idx} className="flex gap-1.5">
                        <span className="text-accent select-none shrink-0">•</span>
                        <span>{bullet.replace(/^[•\-\*\s]+/, "")}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-auto pt-2.5 border-t border-studio-border/40 flex items-center justify-between text-[10px] font-medium text-studio-text-secondary shrink-0">
                  <span className="flex items-center gap-1">
                    <Eye size={11} className="text-accent shrink-0" />
                    {item.views} views
                  </span>
                  {onPush && item.videoUrl && (
                    <button
                      onClick={() => {
                        setActiveTrend(item);
                        onPush(`Research and fact check trend: "${item.title}"`, "fact_finder");
                      }}
                      className="text-accent hover:text-accent-hover font-bold flex items-center gap-0.5 cursor-pointer bg-accent/10 hover:bg-accent/20 px-2.5 py-1 rounded-lg border border-accent/25 transition-all text-[10px]"
                    >
                      Use Trend &rarr;
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
