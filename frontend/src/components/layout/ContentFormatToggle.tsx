"use client";

import React from "react";
import { useProjectStore, ContentFormat } from "@/stores/useProjectStore";
import { Film, Smartphone } from "lucide-react";

export default function ContentFormatToggle() {
  const { contentFormat, setContentFormat } = useProjectStore();

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
          onClick={() => setContentFormat("long")}
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
          onClick={() => setContentFormat("short")}
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
