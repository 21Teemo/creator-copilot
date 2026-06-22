"use client";

import React, { useState, useEffect } from "react";
import { getSuggestedActions, showAddAudioToggle, ActionChipType } from "@/lib/quickControls";
import { useProjectStore } from "@/stores/useProjectStore";
import { useResearchStore } from "@/stores/useResearchStore";
import { useScriptingStore } from "@/stores/useScriptingStore";
import { useMediaStore } from "@/stores/useMediaStore";
import { useStudioStore } from "@/stores/useStudioStore";
import {
  Compass,
  Search,
  FileText,
  Image as ImageIcon,
  Film,
  Sparkles,
  Volume2,
  MoreHorizontal,
  Check,
  Video,
} from "lucide-react";

interface QuickControlsProps {
  onActionClick: (action: ActionChipType) => void;
}

export default function QuickControls({ onActionClick }: QuickControlsProps) {
  const { addAudioEnabled, setAddAudioEnabled } = useProjectStore();
  // Subscribe to domain stores to trigger re-renders when data changes
  const trendsCount = useResearchStore((state) => state.trends.length);
  const hasBrief = useResearchStore((state) => state.summaries !== null);
  const hasScript = useScriptingStore((state) => !!state.script);
  const scenesCount = useMediaStore((state) => state.sceneImages.length);
  const hasVideo = useMediaStore((state) => !!state.videoUrl);

  const suggestedActions = getSuggestedActions();
  const displayAudioToggle = showAddAudioToggle();

  // Map action IDs to icons
  const iconMap: Record<ActionChipType, React.ReactNode> = {
    explore_trends: <Compass size={13} />,
    fact_finder: <Search size={13} />,
    write_script: <FileText size={13} />,
    scene_pictures: <ImageIcon size={13} />,
    scene_videos: <Video size={13} />,
    ffmpeg_render: <Film size={13} />,
    seo_publish: <Sparkles size={13} />,
  };

  const activeView = useStudioStore((state) => state.activeView);

  // Map view to action
  const viewToActionMap: Record<string, ActionChipType> = {
    trends: "explore_trends",
    facts: "fact_finder",
    script: "write_script",
    scenes: "scene_pictures",
    video: "scene_videos",
    ffmpeg: "ffmpeg_render",
    seo: "seo_publish",
  };

  const currentActiveAction = viewToActionMap[activeView];

  // Dropdown menu state removed

  return (
    <div className="relative flex items-center justify-center shrink-0 py-2">
      {/* Floating Glass Pill */}
      <div className="flex items-center gap-2 p-1.5 rounded-full bg-[#1A1A1F]/80 backdrop-blur-xl border border-studio-border/50 shadow-2xl z-30 select-none">
        {/* Suggested Action Chips */}
        {suggestedActions.map((action) => {
          const isActive = currentActiveAction === action.id;
          const isRecommended = action.recommended && !isActive;

          return (
            <button
              key={action.id}
              onClick={() => onActionClick(action.id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer ${
                isActive
                  ? "bg-accent-muted border border-accent/40 text-studio-text-primary ring-1 ring-accent/15"
                  : isRecommended
                  ? "bg-transparent border border-accent/30 border-dashed text-studio-text-secondary hover:text-studio-text-primary hover:bg-studio-border/25"
                  : "bg-transparent border border-studio-border/60 text-studio-text-secondary hover:text-studio-text-primary hover:bg-studio-border/25"
              }`}
            >
              <span className={isActive ? "text-accent" : "text-studio-text-secondary"}>
                {iconMap[action.id]}
              </span>
              {action.label}
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse shrink-0" />
              )}
            </button>
          );
        })}

        {/* Persistent Add Audio Toggle (Shown once scenes exist) */}
        {displayAudioToggle && (
          <button
            onClick={() => setAddAudioEnabled(!addAudioEnabled)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer border ${
              addAudioEnabled
                ? "bg-studio-success/15 border-studio-success/50 text-studio-success"
                : "bg-transparent border-studio-border/60 text-studio-text-secondary hover:text-studio-text-primary hover:bg-studio-border/25"
            }`}
          >
            <Volume2 size={13} />
            <span>Add Audio</span>
            {addAudioEnabled && (
              <span className="w-1.5 h-1.5 rounded-full bg-studio-success" />
            )}
          </button>
        )}

        {/* Overflow dropdown menu removed */}
      </div>
    </div>
  );
}
