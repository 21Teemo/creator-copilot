"use client";

import React, { useState } from "react";
import { useMediaStore } from "@/stores/useMediaStore";
import { useProjectStore } from "@/stores/useProjectStore";
import { Film, Camera, RefreshCw } from "lucide-react";

interface SceneVideosViewProps {
  onPush?: (prompt: string, action: string) => void;
}

const REGEN_VIDEO_POOL = [
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4"
];

export default function SceneVideosView({ onPush }: SceneVideosViewProps) {
  const { sceneVideos, setSceneVideos } = useMediaStore();
  const contentFormat = useProjectStore((state) => state.contentFormat);
  const [regeneratingScenes, setRegeneratingScenes] = useState<number[]>([]);

  const handleRegenerateVideo = (sceneNumber: number) => {
    if (regeneratingScenes.includes(sceneNumber)) return;
    setRegeneratingScenes((prev) => [...prev, sceneNumber]);

    setTimeout(() => {
      const currentVideo = sceneVideos.find((vid) => vid.sceneNumber === sceneNumber)?.videoUrl;
      const candidates = REGEN_VIDEO_POOL.filter((url) => url !== currentVideo);
      const randomVideo = candidates[Math.floor(Math.random() * candidates.length)];

      const updatedVideos = sceneVideos.map((vid) =>
        vid.sceneNumber === sceneNumber ? { ...vid, videoUrl: randomVideo } : vid
      );

      setSceneVideos(updatedVideos);
      setRegeneratingScenes((prev) => prev.filter((num) => num !== sceneNumber));
    }, 850);
  };

  if (sceneVideos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-center py-12">
        <Film size={40} className="text-studio-text-secondary animate-pulse mb-4" />
        <p className="text-sm text-studio-text-secondary">No scene videos generated yet. Run Scene Videos first.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 h-full select-none min-h-0">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h3 className="text-base font-bold text-studio-text-primary flex items-center gap-2">
            Generated Storyboard Video Clips
          </h3>
          <p className="text-xs text-studio-text-secondary">
            Aspect ratio adapted to {contentFormat === "short" ? "9:16 (Shorts)" : "16:9 (Long-form)"}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 mb-4 min-h-0">
        <div
          className={`grid gap-4 ${
            contentFormat === "short"
              ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
              : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3"
          }`}
        >
          {sceneVideos.map((scene) => {
            const isRegenerating = regeneratingScenes.includes(scene.sceneNumber);
            return (
              <div
                key={scene.sceneNumber}
                className="flex flex-col rounded-2xl bg-studio-surface border border-studio-border/60 overflow-hidden hover:border-accent/40 transition-all duration-200 group relative animate-fade-in"
              >
                {/* Video Frame with Aspect Ratio */}
                <div
                  className={`relative bg-studio-bg overflow-hidden ${
                    contentFormat === "short" ? "aspect-[9/16]" : "aspect-[16/9]"
                  }`}
                >
                  {/* HTML5 Video loop player */}
                  {!isRegenerating && (
                    <video
                      src={scene.videoUrl}
                      loop
                      muted
                      playsInline
                      autoPlay
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  )}
                  
                  {/* Ambient Shading Layer */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  {/* Top Controls Overlay */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 z-20">
                    <span className="text-[9px] font-bold text-studio-text-primary px-2 py-0.5 rounded-full bg-studio-surface/80 border border-studio-border/60 uppercase tracking-wider">
                      Scene {scene.sceneNumber}
                    </span>
                  </div>

                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20">
                    <button
                      onClick={() => handleRegenerateVideo(scene.sceneNumber)}
                      title="Regenerate scene video"
                      className="p-1.5 rounded-lg bg-black/60 border border-white/10 hover:border-accent/40 text-studio-text-secondary hover:text-accent cursor-pointer transition-colors"
                      disabled={isRegenerating}
                    >
                      <RefreshCw size={12} className={isRegenerating ? "animate-spin text-accent" : ""} />
                    </button>
                  </div>

                  {/* Prompt Caption overlay */}
                  <div className="absolute bottom-3 left-3 right-3 z-20">
                    <div className="flex items-start gap-1.5 text-white">
                      <Camera size={11} className="shrink-0 text-accent mt-0.5" />
                      <p className="text-[10px] leading-normal font-medium line-clamp-2">
                        {scene.visualPrompt}
                      </p>
                    </div>
                  </div>

                  {/* Regeneration Loading Spinner Overlay */}
                  {isRegenerating && (
                    <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-2 z-10 backdrop-blur-sm">
                      <RefreshCw size={20} className="text-accent animate-spin" />
                      <span className="text-[9px] font-bold text-studio-text-secondary uppercase tracking-wider">
                        Generating Clip...
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {onPush && (
        <div className="pt-4 border-t border-studio-border/30 flex justify-end shrink-0">
          <button
            onClick={() => onPush("Render final video compilation using FFmpeg render CLI.", "ffmpeg_render")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent hover:bg-accent/90 text-xs font-bold text-white transition-all cursor-pointer shadow-md"
          >
            Confirm & Render Video &rarr;
          </button>
        </div>
      )}
    </div>
  );
}
