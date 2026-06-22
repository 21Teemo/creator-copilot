"use client";

import React from "react";
import { useMediaStore } from "@/stores/useMediaStore";
import { useProjectStore } from "@/stores/useProjectStore";
import { Play, Film, AlertCircle, RefreshCw, Layers } from "lucide-react";

interface VideoViewProps {
  onPush?: (prompt: string, action: string) => void;
}

export default function VideoView({ onPush }: VideoViewProps) {
  const { videoUrl, renderStatus, renderProgress } = useMediaStore();
  const contentFormat = useProjectStore((state) => state.contentFormat);

  const isRendering = renderStatus === "pending" || renderStatus === "in_progress";

  if (renderStatus === "idle" && !videoUrl) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-center py-12">
        <Film size={40} className="text-studio-text-secondary mb-4" />
        <p className="text-sm text-studio-text-secondary">No video rendered yet. Run FFmpeg Render to assemble.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center flex-1 w-full h-full select-none">
      <div className="w-full max-w-4xl flex flex-col items-center justify-center h-full">
        {isRendering ? (
          /* Rendering Progress Shimmer */
          <div
            className={`w-full max-w-md bg-studio-surface border border-studio-border/60 rounded-3xl p-6 flex flex-col items-center gap-6 shadow-studio`}
          >
            <div className="relative w-16 h-16 flex items-center justify-center rounded-2xl bg-accent/10 border border-accent/20 text-accent">
              <Layers size={28} className="animate-bounce" />
            </div>
            
            <div className="text-center space-y-1">
              <h4 className="text-sm font-bold text-studio-text-primary">
                Assembling Media Pipelines
              </h4>
              <p className="text-xs text-studio-text-secondary">
                Stitching voiceover, background music, and keyframes...
              </p>
            </div>

            <div className="w-full space-y-2">
              <div className="flex items-center justify-between text-[10px] font-bold text-studio-text-secondary uppercase">
                <span>Rendering FFmpeg CLI</span>
                <span className="text-accent">{renderProgress}%</span>
              </div>
              <div className="h-2 w-full bg-studio-bg rounded-full overflow-hidden border border-studio-border/60">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${renderProgress}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 text-[10px] text-studio-text-secondary">
              <span className="w-1.5 h-1.5 rounded-full bg-studio-success animate-ping" />
              <span>Status: {renderStatus}</span>
            </div>
          </div>
        ) : renderStatus === "failed" ? (
          /* Render Failed State */
          <div className="text-center max-w-sm p-6 bg-studio-surface border border-studio-border/60 rounded-3xl space-y-4">
            <AlertCircle size={36} className="text-red-500 mx-auto" />
            <h4 className="text-sm font-bold text-studio-text-primary">Rendering Failed</h4>
            <p className="text-xs text-studio-text-secondary leading-relaxed">
              There was an issue compiling assets using FFmpeg. Check your voiceover script limits and try again.
            </p>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent hover:bg-accent/80 text-xs font-semibold text-white mx-auto cursor-pointer">
              <RefreshCw size={12} />
              Re-submit Render
            </button>
          </div>
        ) : (
          /* Rendered Video Player */
          <div className="w-full h-full flex flex-col items-center justify-between min-h-0">
            <div className="w-full flex items-center justify-between mb-3 shrink-0">
              <h3 className="text-xs font-bold text-studio-text-secondary uppercase tracking-wider">
                Active Project Preview ({contentFormat === "short" ? "Vertical 9:16" : "Horizontal 16:9"})
              </h3>
            </div>
            
            <div
              className={`relative bg-black rounded-2xl overflow-hidden border border-studio-border/80 shadow-studio flex items-center justify-center flex-1 min-h-0 ${
                contentFormat === "short"
                  ? "h-[50vh] aspect-[9/16]"
                  : "w-full aspect-video max-h-[50vh]"
              }`}
            >
              <video
                src={videoUrl || ""}
                controls
                className="w-full h-full object-contain"
                poster="/next.svg" /* Fallback thumbnail */
              />
            </div>

            {onPush && (
              <div className="w-full mt-4 pt-3.5 border-t border-studio-border/30 flex justify-end shrink-0">
                <button
                  onClick={() => onPush("Generate SEO descriptors and metadata.", "seo_publish")}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent hover:bg-accent/90 text-xs font-bold text-white transition-all cursor-pointer shadow-md"
                >
                  Confirm & Generate SEO &rarr;
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
