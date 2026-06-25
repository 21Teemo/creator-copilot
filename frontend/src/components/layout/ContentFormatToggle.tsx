"use client";

import React from "react";
import { useProjectStore, ContentFormat } from "@/stores/useProjectStore";
import { useResearchStore } from "@/stores/useResearchStore";
import { Film, Smartphone } from "lucide-react";

export default function ContentFormatToggle() {
  const { contentFormat, setContentFormat } = useProjectStore();
  const clearResearch = useResearchStore((state) => state.clearResearch);

  const switchFormat = (format: ContentFormat) => {
    if (format === contentFormat) return;
    clearResearch();
    setContentFormat(format);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-studio-text-secondary tracking-wider uppercase mr-1">
        Content Format
      </span>
      <div className="relative flex items-center bg-studio-surface p-1 rounded-full border border-studio-border/60">
        {/* Sliding Indicator Background */}
        <div
          className={`absolute h-7 w-[84px] rounded-full transition-transform duration-300 ease-out bg-accent left-[4px] ${
            contentFormat === "short" ? "translate-x-[84px]" : "translate-x-0"
          }`}
        />

        {/* Long Button */}
        <button
          onClick={() => switchFormat("long")}
          className={`relative z-10 flex items-center justify-center gap-1.5 w-[84px] h-7 text-xs font-semibold rounded-full transition-colors duration-200 cursor-pointer ${
            contentFormat === "long"
              ? "text-studio-text-primary"
              : "text-studio-text-secondary hover:text-studio-text-primary"
          }`}
        >
          <Film size={13} className="shrink-0" />
          Long
        </button>

        {/* Short Button */}
        <button
          onClick={() => switchFormat("short")}
          className={`relative z-10 flex items-center justify-center gap-1.5 w-[84px] h-7 text-xs font-semibold rounded-full transition-colors duration-200 cursor-pointer ${
            contentFormat === "short"
              ? "text-studio-text-primary"
              : "text-studio-text-secondary hover:text-studio-text-primary"
          }`}
        >
          <Smartphone size={13} className="shrink-0" />
          Short
        </button>
      </div>
    </div>
  );
}
