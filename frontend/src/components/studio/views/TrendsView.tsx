"use client";

import React from "react";
import { useResearchStore } from "@/stores/useResearchStore";
import { useProjectStore } from "@/stores/useProjectStore";
import { Eye, Clock, User, Compass, Play } from "lucide-react";

export default function TrendsView() {
  const trends = useResearchStore((state) => state.trends);
  const contentFormat = useProjectStore((state) => state.contentFormat);

  if (trends.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-center py-12">
        <Compass size={40} className="text-studio-text-secondary animate-spin mb-4" />
        <p className="text-sm text-studio-text-secondary">No trends data available. Run Explore Trends first.</p>
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
            Displaying the top {trends.length} matching content signals
          </p>
        </div>
        <div className="px-2.5 py-1 rounded-full bg-accent/15 border border-accent/30 text-[10px] font-bold text-accent uppercase tracking-wider">
          {contentFormat === "short" ? "9:16 Vertical Presets" : "16:9 Horizontal Presets"}
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
              key={index}
              className="flex flex-col rounded-2xl bg-studio-surface border border-studio-border/60 overflow-hidden hover:border-accent/40 hover:shadow-studio transition-all duration-200"
            >
              {/* Thumbnail Container */}
              <div
                className={`relative bg-studio-bg overflow-hidden ${
                  contentFormat === "short" ? "aspect-[9/16]" : "aspect-[16/9]"
                }`}
              >
                {/* Simulated Thumbnail Gradient */}
                <div
                  className={`absolute inset-0 bg-gradient-to-tr opacity-25 ${
                    contentFormat === "short"
                      ? "from-purple-900 via-indigo-900 to-zinc-900"
                      : "from-indigo-900 via-zinc-900 to-zinc-800"
                  }`}
                />
                
                {/* Play Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-black/40 transition-opacity duration-200">
                  <div className="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center shadow-lg">
                    <Play size={16} fill="currentColor" className="ml-0.5" />
                  </div>
                </div>

                {/* Duration Badge */}
                <div className="absolute bottom-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/75 text-[10px] font-semibold text-studio-text-primary">
                  <Clock size={10} />
                  {item.duration}
                </div>

                {/* Rank Badge */}
                <div className="absolute top-2 left-2 w-5 h-5 flex items-center justify-center rounded-full bg-studio-surface/80 border border-studio-border/50 text-[10px] font-bold text-accent">
                  {index + 1}
                </div>
              </div>

              {/* Card Details */}
              <div className="p-3.5 flex flex-col flex-1">
                <h4 className="text-xs font-bold text-studio-text-primary line-clamp-2 mb-1.5 leading-tight hover:text-accent">
                  {item.title}
                </h4>

                <div className="flex items-center gap-1.5 text-[10px] text-studio-text-secondary mb-2 truncate">
                  <User size={10} className="shrink-0" />
                  <span className="truncate">{item.channelName}</span>
                  <span className="shrink-0 font-extrabold">&middot;</span>
                  <span className="shrink-0">{item.publishedAt}</span>
                </div>

                <p className="text-[11px] text-studio-text-secondary line-clamp-3 leading-relaxed flex-1">
                  {item.description}
                </p>

                <div className="mt-3 pt-2.5 border-t border-studio-border/40 flex items-center justify-between text-[10px] font-medium text-studio-text-secondary">
                  <span className="flex items-center gap-1">
                    <Eye size={11} className="text-accent" />
                    {item.views} views
                  </span>
                  <span className="hover:text-accent cursor-pointer font-bold">
                    View &rarr;
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
