"use client";

import React from "react";
import { useMediaStore } from "@/stores/useMediaStore";
import { useProjectStore } from "@/stores/useProjectStore";
import { Image as ImageIcon, Camera, RefreshCw } from "lucide-react";

export default function SceneGalleryView() {
  const sceneImages = useMediaStore((state) => state.sceneImages);
  const contentFormat = useProjectStore((state) => state.contentFormat);

  if (sceneImages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-center py-12">
        <ImageIcon size={40} className="text-studio-text-secondary animate-pulse mb-4" />
        <p className="text-sm text-studio-text-secondary">No storyboard scenes generated yet. Run Scene Pictures first.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 h-full select-none">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h3 className="text-base font-bold text-studio-text-primary flex items-center gap-2">
            Generated Storyboard Frames
          </h3>
          <p className="text-xs text-studio-text-secondary">
            Aspect ratio adapted to {contentFormat === "short" ? "9:16 (Shorts)" : "16:9 (Long-form)"}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        <div
          className={`grid gap-4 ${
            contentFormat === "short"
              ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
              : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3"
          }`}
        >
          {sceneImages.map((scene) => (
            <div
              key={scene.sceneNumber}
              className="flex flex-col rounded-2xl bg-studio-surface border border-studio-border/60 overflow-hidden hover:border-accent/40 transition-all duration-200 group"
            >
              {/* Image Frame with Aspect Ratio */}
              <div
                className={`relative bg-studio-bg overflow-hidden ${
                  contentFormat === "short" ? "aspect-[9/16]" : "aspect-[16/9]"
                }`}
              >
                {/* Visual Placeholder Graphic/Mock Photo */}
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
                  style={{ backgroundImage: `url(${scene.imageUrl})` }}
                />
                
                {/* Ambient Shading Layer */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                {/* Top Controls Overlay */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5">
                  <span className="text-[9px] font-bold text-studio-text-primary px-2 py-0.5 rounded-full bg-studio-surface/80 border border-studio-border/60 uppercase tracking-wider">
                    Scene {scene.sceneNumber}
                  </span>
                </div>

                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <button
                    title="Regenerate scene"
                    className="p-1.5 rounded-lg bg-black/60 border border-white/10 hover:border-accent/40 text-studio-text-secondary hover:text-accent cursor-pointer"
                  >
                    <RefreshCw size={12} />
                  </button>
                </div>

                {/* Prompt Caption overlay */}
                <div className="absolute bottom-3 left-3 right-3">
                  <div className="flex items-start gap-1.5 text-white">
                    <Camera size={11} className="shrink-0 text-accent mt-0.5" />
                    <p className="text-[10px] leading-normal font-medium line-clamp-2">
                      {scene.visualPrompt}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
