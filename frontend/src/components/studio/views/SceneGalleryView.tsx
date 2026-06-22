"use client";

import React, { useState } from "react";
import { useMediaStore } from "@/stores/useMediaStore";
import { useProjectStore } from "@/stores/useProjectStore";
import { Image as ImageIcon, Camera, RefreshCw } from "lucide-react";

interface SceneGalleryViewProps {
  onPush?: (prompt: string, action: string) => void;
}

// A pool of high-quality alternative coding/technology Unsplash images
const REGEN_POOL = [
  "https://images.unsplash.com/photo-1542831371-29b0f74f9713?q=80&w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1531403009284-440f080d1e12?q=80&w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1607799279861-4dd421887fb3?q=80&w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=600&auto=format&fit=crop"
];

export default function SceneGalleryView({ onPush }: SceneGalleryViewProps) {
  const { sceneImages, setSceneImages } = useMediaStore();
  const contentFormat = useProjectStore((state) => state.contentFormat);
  const [regeneratingScenes, setRegeneratingScenes] = useState<number[]>([]);

  const handlePromptChange = (sceneNumber: number, newPrompt: string) => {
    const updatedImages = sceneImages.map((img) =>
      img.sceneNumber === sceneNumber ? { ...img, visualPrompt: newPrompt } : img
    );
    setSceneImages(updatedImages);
  };

  const handleRegenerateScene = (sceneNumber: number) => {
    if (regeneratingScenes.includes(sceneNumber)) return;
    setRegeneratingScenes((prev) => [...prev, sceneNumber]);

    setTimeout(() => {
      const currentImage = sceneImages.find((img) => img.sceneNumber === sceneNumber)?.imageUrl;
      const candidates = REGEN_POOL.filter((url) => url !== currentImage);
      const randomImage = candidates[Math.floor(Math.random() * candidates.length)];

      const updatedImages = sceneImages.map((img) =>
        img.sceneNumber === sceneNumber ? { ...img, imageUrl: randomImage } : img
      );

      setSceneImages(updatedImages);
      setRegeneratingScenes((prev) => prev.filter((num) => num !== sceneNumber));
    }, 850);
  };

  if (sceneImages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-center py-12">
        <ImageIcon size={40} className="text-studio-text-secondary animate-pulse mb-4" />
        <p className="text-sm text-studio-text-secondary">No storyboard scenes generated yet. Run Scene Pictures first.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 h-full select-none min-h-0">
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

      <div className="flex-1 overflow-y-auto pr-1 mb-4 min-h-0">
        <div
          className={`grid gap-4 ${
            contentFormat === "short"
              ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
              : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3"
          }`}
        >
          {sceneImages.map((scene) => {
            const isRegenerating = regeneratingScenes.includes(scene.sceneNumber);
            return (
              <div
                key={scene.sceneNumber}
                className="flex flex-col rounded-2xl bg-studio-surface border border-studio-border/60 overflow-hidden hover:border-accent/40 transition-all duration-200 group relative animate-fade-in"
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
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 z-20">
                    <span className="text-[9px] font-bold text-studio-text-primary px-2 py-0.5 rounded-full bg-studio-surface/80 border border-studio-border/60 uppercase tracking-wider">
                      Scene {scene.sceneNumber}
                    </span>
                  </div>

                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20">
                    <button
                      onClick={() => handleRegenerateScene(scene.sceneNumber)}
                      title="Regenerate scene"
                      className="p-1.5 rounded-lg bg-black/60 border border-white/10 hover:border-accent/40 text-studio-text-secondary hover:text-accent cursor-pointer transition-colors"
                      disabled={isRegenerating}
                    >
                      <RefreshCw size={12} className={isRegenerating ? "animate-spin text-accent" : ""} />
                    </button>
                  </div>

                  {/* Prompt Caption overlay */}
                  <div className="absolute bottom-3 left-3 right-3 z-20">
                    <div className="flex items-start gap-1.5 text-white bg-black/45 backdrop-blur-sm p-1.5 rounded-lg border border-white/5">
                      <Camera size={12} className="shrink-0 text-accent mt-1" />
                      <textarea
                        value={scene.visualPrompt}
                        onChange={(e) => handlePromptChange(scene.sceneNumber, e.target.value)}
                        className="w-full bg-transparent text-[10px] leading-normal font-medium text-white focus:outline-none resize-none h-11 placeholder-white/40 focus:bg-black/20 px-1 rounded transition-colors"
                        placeholder="Edit visual prompt..."
                      />
                    </div>
                  </div>

                  {/* Regeneration Loading Spinner Overlay */}
                  {isRegenerating && (
                    <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-2 z-10 backdrop-blur-sm animate-fade-in">
                      <RefreshCw size={20} className="text-accent animate-spin" />
                      <span className="text-[9px] font-bold text-studio-text-secondary uppercase tracking-wider">
                        Regenerating...
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
            onClick={() => onPush("Generate custom video clips for each storyboard scene.", "scene_videos")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent hover:bg-accent/90 text-xs font-bold text-white transition-all cursor-pointer shadow-md"
          >
            Confirm & Generate Videos &rarr;
          </button>
        </div>
      )}
    </div>
  );
}
