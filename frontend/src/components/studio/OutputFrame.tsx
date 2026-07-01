"use client";

import React, { useState, useEffect } from "react";
import { useStudioStore, StudioView } from "@/stores/useStudioStore";
import { useProjectStore } from "@/stores/useProjectStore";
import { X, RefreshCw, AlertCircle } from "lucide-react";

// Views
import WelcomeView from "./views/WelcomeView";
import TrendsView from "./views/TrendsView";
import FactsView from "./views/FactsView";
import ScriptView from "./views/ScriptView";
import SceneGalleryView from "./views/SceneGalleryView";
import SceneVideosView from "./views/SceneVideosView";
import VideoView from "./views/VideoView";
import SeoView from "./views/SeoView";

interface OutputFrameProps {
  projectId: string;
  onSelectPrompt: (prompt: string, action: string) => void;
  onPublish: () => void;
}

export default function OutputFrame({ projectId, onSelectPrompt, onPublish }: OutputFrameProps) {
  const activeView = useStudioStore((state) => state.activeView);
  const loading = useStudioStore((state) => state.loading);
  const { contentFormat, lastGeneratedFormat } = useProjectStore();

  const [bannerDismissedFor, setBannerDismissedFor] = useState<string | null>(null);

  // Reset banner dismissal state when lastGeneratedFormat or contentFormat changes
  useEffect(() => {
    setBannerDismissedFor(null);
  }, [contentFormat, lastGeneratedFormat]);

  const showStaleBanner =
    lastGeneratedFormat !== null &&
    lastGeneratedFormat !== contentFormat &&
    bannerDismissedFor !== `${lastGeneratedFormat}-${contentFormat}` &&
    activeView !== "welcome";

  // Map activeView to dynamic regenerate prompt
  const getRegeneratePrompt = () => {
    switch (activeView) {
      case "trends":
        return { prompt: "Re-run trend scan", action: "explore_trends" };
      case "facts":
        return { prompt: "Re-run fact finding", action: "fact_finder" };
      case "script":
        return { prompt: "Re-generate script", action: "write_script" };
      case "scenes":
        return { prompt: "Re-generate scene pictures", action: "scene_pictures" };
      case "video":
        return { prompt: "Re-generate scene videos", action: "scene_videos" };
      case "ffmpeg":
        return { prompt: "Re-render final video", action: "ffmpeg_render" };
      case "seo":
        return { prompt: "Re-generate SEO descriptors", action: "seo_publish" };
      default:
        return null;
    }
  };

  const regenDetails = getRegeneratePrompt();

  return (
    <main className="flex-1 flex flex-col bg-studio-surface rounded-studio border border-studio-border shadow-studio overflow-hidden relative min-h-0 transition-all duration-300">
      {/* Dynamic Stale Data Banner */}
      {showStaleBanner && (
        <div className="absolute top-0 inset-x-0 bg-accent-muted/95 border-b border-accent/30 px-3 sm:px-4 py-2.5 sm:py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between z-30 animate-fade-in backdrop-blur-md">
          <div className="flex items-start sm:items-center gap-2 text-xs text-studio-text-primary font-medium min-w-0">
            <AlertCircle size={14} className="text-accent shrink-0" />
            <span>
              Switched to <strong className="capitalize">{contentFormat}</strong> mode. Previews updated. Re-run current step for best results.
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
            {regenDetails && (
              <button
                onClick={() => onSelectPrompt(regenDetails.prompt, regenDetails.action)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-white bg-accent rounded-full hover:bg-accent/80 transition-colors cursor-pointer"
              >
                <RefreshCw size={10} />
                Re-generate
              </button>
            )}
            <button
              onClick={() => setBannerDismissedFor(`${lastGeneratedFormat}-${contentFormat}`)}
              className="text-studio-text-secondary hover:text-studio-text-primary transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Render Canvas */}
      <div className="flex-1 p-3 sm:p-4 md:p-6 flex flex-col min-h-0 overflow-y-auto overscroll-y-contain">
        {loading && activeView !== "ffmpeg" ? (
          <SkeletonLoader view={activeView} contentFormat={contentFormat} />
        ) : (
          renderView(activeView, projectId, onSelectPrompt, onPublish)
        )}
      </div>
    </main>
  );
}

// Switches sub-components based on view
function renderView(
  view: StudioView,
  projectId: string,
  onSelectPrompt: (prompt: string, action: string) => void,
  onPublish: () => void
) {
  switch (view) {
    case "welcome":
      return <WelcomeView onSelectPrompt={onSelectPrompt} />;
    case "trends":
      return <TrendsView projectId={projectId} onPush={onSelectPrompt} />;
    case "facts":
      return <FactsView onPush={onSelectPrompt} />;
    case "script":
      return (
        <div className="flex flex-col flex-1 min-h-0">
          <ScriptView onPush={onSelectPrompt} />
        </div>
      );
    case "scenes":
      return <SceneGalleryView onPush={onSelectPrompt} />;
    case "video":
      return <SceneVideosView onPush={onSelectPrompt} />;
    case "ffmpeg":
      return <VideoView onPush={onSelectPrompt} />;
    case "seo":
      return <SeoView onPublish={onPublish} />;
    default:
      return <WelcomeView onSelectPrompt={onSelectPrompt} />;
  }
}

// Renders context-aware loading shimmers
function SkeletonLoader({ view, contentFormat }: { view: StudioView; contentFormat: string }) {
  const isShort = contentFormat === "short";

  return (
    <div className="flex flex-col flex-1 w-full h-full space-y-4 animate-pulse">
      {/* Skeleton Header */}
      <div className="flex justify-between items-center mb-2 shrink-0">
        <div className="h-4 bg-studio-border rounded w-1/4" />
        <div className="h-6 bg-studio-border rounded-full w-20" />
      </div>

      <div className="flex-1 flex flex-col justify-center">
        {view === "trends" && (
          <div
            className={`grid gap-4 flex-1 ${
              isShort
                ? "grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
                : "grid-cols-1 md:grid-cols-3"
            }`}
          >
            {Array.from({ length: isShort ? 5 : 3 }).map((_, idx) => (
              <div key={idx} className="bg-studio-surface border border-studio-border rounded-2xl p-3 space-y-3">
                <div className={`bg-studio-border rounded-xl w-full ${isShort ? "aspect-[9/16]" : "aspect-[16/9]"}`} />
                <div className="h-3 bg-studio-border rounded w-5/6" />
                <div className="h-2.5 bg-studio-border rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {view === "facts" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 flex-1">
            <div className="lg:col-span-2 bg-studio-surface border border-studio-border rounded-2xl p-5 space-y-4">
              <div className="h-3 bg-studio-border rounded w-1/4 mb-4" />
              <div className="h-2 bg-studio-border rounded w-full" />
              <div className="h-2 bg-studio-border rounded w-11/12" />
              <div className="h-2 bg-studio-border rounded w-5/6" />
              <div className="h-2 bg-studio-border rounded w-full" />
            </div>
            <div className="bg-studio-surface border border-studio-border rounded-2xl p-4 space-y-3">
              <div className="h-3 bg-studio-border rounded w-1/3 mb-2" />
              <div className="h-10 bg-studio-border rounded-xl w-full" />
              <div className="h-10 bg-studio-border rounded-xl w-full" />
            </div>
          </div>
        )}

        {view === "script" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 flex-1">
            <div className="lg:col-span-2 bg-studio-surface border border-studio-border rounded-2xl p-6 space-y-4">
              <div className="h-3.5 bg-studio-border rounded w-3/4" />
              <div className="h-3.5 bg-studio-border rounded w-5/6" />
              <div className="h-3.5 bg-studio-border rounded w-full" />
            </div>
            <div className="bg-studio-surface border border-studio-border rounded-2xl p-4 space-y-3">
              <div className="h-12 bg-studio-border rounded-xl" />
              <div className="h-12 bg-studio-border rounded-xl" />
            </div>
          </div>
        )}

        {(view === "scenes" || view === "video") && (
          <div
            className={`grid gap-4 flex-1 ${
              isShort
                ? "grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
                : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3"
            }`}
          >
            {Array.from({ length: isShort ? 5 : 3 }).map((_, idx) => (
              <div key={idx} className="bg-studio-surface border border-studio-border rounded-2xl p-3">
                <div className={`bg-studio-border rounded-xl w-full ${isShort ? "aspect-[9/16]" : "aspect-[16/9]"}`} />
              </div>
            ))}
          </div>
        )}

        {(view === "ffmpeg" || view === "welcome") && (
          <div className="flex flex-col items-center justify-center p-8 bg-studio-surface border border-studio-border rounded-3xl max-w-md mx-auto w-full space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-studio-border" />
            <div className="h-3 bg-studio-border rounded w-1/2" />
            <div className="h-2 bg-studio-border rounded w-5/6" />
            <div className="h-2.5 bg-accent/20 rounded w-full mt-4" />
          </div>
        )}

        {view === "seo" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 flex-1">
            <div className="bg-studio-surface border border-studio-border rounded-2xl p-4 space-y-3">
              <div className="h-8 bg-studio-border rounded-xl" />
              <div className="h-8 bg-studio-border rounded-xl" />
            </div>
            <div className="bg-studio-surface border border-studio-border rounded-2xl p-4 space-y-4">
              <div className="h-16 bg-studio-border rounded-xl" />
              <div className="h-24 bg-studio-border rounded-xl" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
