"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { useMediaStore } from "@/stores/useMediaStore";
import { useProjectStore } from "@/stores/useProjectStore";
import { apiRequest } from "@/lib/api";
import { buildStockSearchRequest, buildSceneGenerateRequest, shouldUseAiSceneGeneration, visualPromptForStockSearch } from "@/lib/intentRouter";
import { VisualReferencesPanel } from "./ScriptView";
import { Image as ImageIcon, Camera, RefreshCw, Search, Plus, Download, Upload } from "lucide-react";

interface SceneGalleryViewProps {
  onPush?: (prompt: string, action: string) => void;
}


export default function SceneGalleryView({ onPush }: SceneGalleryViewProps) {
  const params = useParams();
  const projectId = params?.projectId as string;

  const { sceneImages, setSceneImages, visualReferences } = useMediaStore();
  const contentFormat = useProjectStore((state) => state.contentFormat);
  const [regeneratingScenes, setRegeneratingScenes] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ title: string; url: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeDropdownIndex, setActiveDropdownIndex] = useState<number | null>(null);

  const handlePromptChange = (sceneNumber: number, newPrompt: string) => {
    const updatedImages = sceneImages.map((img) =>
      img.sceneNumber === sceneNumber ? { ...img, visualPrompt: newPrompt } : img
    );
    setSceneImages(updatedImages);
  };

  const handleRegenerateScene = async (sceneNumber: number) => {
    if (regeneratingScenes.includes(sceneNumber)) return;
    setRegeneratingScenes((prev) => [...prev, sceneNumber]);

    try {
      const currentScene = sceneImages.find((img) => img.sceneNumber === sceneNumber);
      if (!currentScene) return;

      const searchPrompt = visualPromptForStockSearch(currentScene.visualPrompt);
      const useAi = shouldUseAiSceneGeneration();

      const res = useAi
        ? await apiRequest(
            projectId,
            "/generate/scene",
            "POST",
            buildSceneGenerateRequest(searchPrompt, sceneNumber)
          )
        : await apiRequest(projectId, "/stock/search", "POST", buildStockSearchRequest(searchPrompt));

      if (useAi && res?.imageUrl) {
        const updatedImages = sceneImages.map((img) =>
          img.sceneNumber === sceneNumber ? { ...img, imageUrl: res.imageUrl } : img
        );
        setSceneImages(updatedImages);
        return;
      }

      if (res && Array.isArray(res) && res.length > 0) {
        const candidates = res.filter((item: any) => item.imageUrl !== currentScene.imageUrl);
        const newImage = candidates.length > 0 ? candidates[0].imageUrl : res[0].imageUrl;

        const updatedImages = sceneImages.map((img) =>
          img.sceneNumber === sceneNumber ? { ...img, imageUrl: newImage } : img
        );

        setSceneImages(updatedImages);
      }
    } catch (err) {
      console.error("Regenerate scene image failed:", err);
    } finally {
      setRegeneratingScenes((prev) => prev.filter((num) => num !== sceneNumber));
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.toLowerCase().trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await apiRequest(projectId, "/stock/search", "POST", buildStockSearchRequest(q));
      if (res && Array.isArray(res)) {
        const mapped = res.map((item: any) => ({
          title: item.visualPrompt || "Stock Photo",
          url: item.imageUrl,
        }));
        setSearchResults(mapped);
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      console.error("Stock search failed:", err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddToScene = (sceneNumber: number, url: string) => {
    const updatedImages = sceneImages.map((img) =>
      img.sceneNumber === sceneNumber ? { ...img, imageUrl: url } : img
    );
    setSceneImages(updatedImages);
    setActiveDropdownIndex(null);
  };

  const handleDownloadImage = (url: string, sceneNumber: number) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = `scene-picture-${sceneNumber}.jpg`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUploadImage = (sceneNumber: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const updatedImages = sceneImages.map((img) =>
        img.sceneNumber === sceneNumber ? { ...img, imageUrl: dataUrl } : img
      );
      setSceneImages(updatedImages);
    };
    reader.readAsDataURL(file);
  };

  const aiConsistencyEnabled = shouldUseAiSceneGeneration();

  if (sceneImages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-center py-12">
        <ImageIcon size={40} className="text-studio-text-secondary mb-4" />
        <p className="text-sm text-studio-text-primary font-bold mb-1">No storyboard scenes generated yet</p>
          <p className="text-xs text-studio-text-secondary max-w-sm">
            Click the "Scene Pictures" control below or use the prompt bar to generate storyboard frames
            {visualReferences.some((r) => r.imageUrl) ? " with FLUX identity lock from your visual references." : " from stock libraries."}
          </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 h-full select-none min-h-0">
      <VisualReferencesPanel />
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4 shrink-0">
        <div>
          <h3 className="text-base font-bold text-studio-text-primary flex items-center gap-2">
            Generated Storyboard Frames
          </h3>
          <p className="text-xs text-studio-text-secondary">
            Aspect ratio adapted to {contentFormat === "short" ? "9:16 (Shorts)" : "16:9 (Long-form)"}
            {aiConsistencyEnabled ? " · FLUX img2img locked to visual references" : ""}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 mb-4 min-h-0 space-y-6 scrollbar-thin">
        <div
          className={`grid gap-4 ${
            contentFormat === "short"
              ? "grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
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

                  <div className="absolute top-3 right-3 opacity-80 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 z-20 flex items-center gap-1.5">
                    <button
                      onClick={() => handleDownloadImage(scene.imageUrl, scene.sceneNumber)}
                      title="Download image"
                      className="p-1.5 rounded-lg bg-black/60 border border-white/10 hover:border-accent/40 text-studio-text-secondary hover:text-accent cursor-pointer transition-colors"
                    >
                      <Download size={12} />
                    </button>
                    <label
                      title="Upload custom image"
                      className="p-1.5 rounded-lg bg-black/60 border border-white/10 hover:border-accent/40 text-studio-text-secondary hover:text-accent cursor-pointer transition-colors flex items-center justify-center"
                    >
                      <Upload size={12} />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleUploadImage(scene.sceneNumber, e)}
                      />
                    </label>
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

        {/* Stock Library Search Panel */}
        <div className="pt-6 border-t border-studio-border/60 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between shrink-0">
            <h4 className="text-xs font-bold text-studio-text-primary flex items-center gap-1.5 uppercase tracking-wider">
              <Search size={14} className="text-accent" />
              Search Stock Libraries
            </h4>
            <span className="self-start sm:self-auto text-[9px] font-bold text-accent px-2 py-0.5 rounded bg-accent/15 border border-accent/30 uppercase tracking-widest">
              Pexels & Pixabay Integrated
            </span>
          </div>

          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-studio-text-secondary" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search stock photos (e.g. space wormhole, coding setup, network lights)..."
                className="w-full pl-10 pr-4 py-2 bg-studio-bg border border-studio-border rounded-xl text-xs text-studio-text-primary focus:outline-none focus:border-accent placeholder-studio-text-secondary/50 font-sans"
              />
            </div>
            <button
              type="submit"
              className="w-full sm:w-auto px-4 py-2 bg-accent hover:bg-accent/90 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer shadow-md shrink-0"
            >
              Search
            </button>
          </form>

          {isSearching ? (
            <div className="p-8 flex items-center justify-center gap-2 text-xs text-studio-text-secondary bg-studio-bg/40 border border-studio-border/30 rounded-2xl">
              <RefreshCw size={14} className="animate-spin text-accent" />
              Searching stock libraries...
            </div>
          ) : searchResults.length === 0 ? (
            <div className="p-8 text-center text-xs text-studio-text-secondary bg-studio-bg/40 border border-studio-border/30 rounded-2xl">
              No matching stock photos found. Try different keywords.
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-3 pt-1 shrink-0 scrollbar-thin">
              {searchResults.map((item, idx) => (
                <div
                  key={idx}
                  className="w-64 shrink-0 aspect-[16/9] relative rounded-xl overflow-hidden border border-studio-border/60 hover:border-accent/40 transition-colors group"
                >
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
                    style={{ backgroundImage: `url(${item.url})` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                  
                  <div className="absolute bottom-2 left-2 right-2 flex flex-col gap-1.5 z-20">
                    <span className="text-[10px] font-bold text-white truncate drop-shadow-sm">
                      {item.title}
                    </span>
                    <button
                      onClick={() => setActiveDropdownIndex(idx)}
                      className="flex items-center justify-center gap-1 py-1 px-2.5 rounded bg-accent hover:bg-accent/90 text-[9px] font-bold text-white transition-colors cursor-pointer w-fit shadow"
                    >
                      <Plus size={10} />
                      Add to Scene
                    </button>
                  </div>

                  {/* Add to Scene Dropdown Overlay */}
                  {activeDropdownIndex === idx && (
                    <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-3 z-30 animate-fade-in backdrop-blur-sm">
                      <span className="text-[9px] font-bold text-studio-text-secondary uppercase tracking-wider mb-2">
                        Select Scene Number
                      </span>
                      <div className="flex flex-wrap gap-1.5 justify-center">
                        {sceneImages.map((scene) => (
                          <button
                            key={scene.sceneNumber}
                            onClick={() => handleAddToScene(scene.sceneNumber, item.url)}
                            className="px-2.5 py-1.5 rounded bg-accent hover:bg-accent/80 text-[10px] font-bold text-white transition-colors cursor-pointer min-w-16"
                          >
                            Scene {scene.sceneNumber}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => setActiveDropdownIndex(null)}
                        className="mt-3 text-[9px] text-studio-text-secondary hover:text-studio-text-primary"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
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
