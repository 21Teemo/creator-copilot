"use client";

import React, { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useScriptingStore } from "@/stores/useScriptingStore";
import { useMediaStore, type SceneVideo } from "@/stores/useMediaStore";
import { useProjectStore } from "@/stores/useProjectStore";
import { apiRequest } from "@/lib/api";
import { buildSceneVideoGenerateRequest, visualPromptForStockSearch } from "@/lib/intentRouter";
import SceneStockSearchPanel from "@/components/studio/SceneStockSearchPanel";
import { Film, Camera, RefreshCw, Download, Upload } from "lucide-react";

interface SceneVideosViewProps {
  onPush?: (prompt: string, action: string) => void;
}

type DisplayScene = {
  sceneNumber: number;
  visualPrompt: string;
  videoUrl: string | null;
};

export default function SceneVideosView({ onPush }: SceneVideosViewProps) {
  const params = useParams();
  const projectId = params?.projectId as string;

  const { sceneVideos, setSceneVideos } = useMediaStore();
  const storyboard = useScriptingStore((state) => state.storyboard);
  const contentFormat = useProjectStore((state) => state.contentFormat);
  const [regeneratingScenes, setRegeneratingScenes] = useState<number[]>([]);

  const displayScenes = useMemo((): DisplayScene[] => {
    if (storyboard.length > 0) {
      return storyboard.map((scene) => {
        const assigned = sceneVideos.find((vid) => vid.sceneNumber === scene.sceneNumber);
        return {
          sceneNumber: scene.sceneNumber,
          visualPrompt: assigned?.visualPrompt || scene.visualPrompt,
          videoUrl: assigned?.videoUrl?.trim() ? assigned.videoUrl : null,
        };
      });
    }
    return sceneVideos.map((scene) => ({
      sceneNumber: scene.sceneNumber,
      visualPrompt: scene.visualPrompt,
      videoUrl: scene.videoUrl?.trim() ? scene.videoUrl : null,
    }));
  }, [storyboard, sceneVideos]);

  const stockSearchScenes = useMemo(
    () =>
      displayScenes.map((scene) => ({
        sceneNumber: scene.sceneNumber,
        visualPrompt: scene.visualPrompt,
      })),
    [displayScenes]
  );

  const hasAssignedVideos = displayScenes.some((scene) => scene.videoUrl);

  const upsertSceneVideo = (sceneNumber: number, updates: Partial<SceneVideo>) => {
    const storyScene = storyboard.find((scene) => scene.sceneNumber === sceneNumber);
    const existing = sceneVideos.find((scene) => scene.sceneNumber === sceneNumber);
    const next: SceneVideo = {
      sceneNumber,
      visualPrompt: existing?.visualPrompt || storyScene?.visualPrompt || "",
      videoUrl: existing?.videoUrl || "",
      ...updates,
    };

    if (existing) {
      setSceneVideos(
        sceneVideos.map((scene) => (scene.sceneNumber === sceneNumber ? next : scene))
      );
      return;
    }

    setSceneVideos(
      [...sceneVideos, next].sort((a, b) => a.sceneNumber - b.sceneNumber)
    );
  };

  const assignStockVideo = (sceneNumber: number, url: string) => {
    upsertSceneVideo(sceneNumber, { videoUrl: url });
  };

  const handleDownloadVideo = (url: string, sceneNumber: number) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = `scene-video-${sceneNumber}.mp4`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUploadVideo = (sceneNumber: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      upsertSceneVideo(sceneNumber, { videoUrl: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handlePromptChange = (sceneNumber: number, newPrompt: string) => {
    upsertSceneVideo(sceneNumber, { visualPrompt: newPrompt });
  };

  const handleRegenerateVideo = async (sceneNumber: number) => {
    if (regeneratingScenes.includes(sceneNumber)) return;
    setRegeneratingScenes((prev) => [...prev, sceneNumber]);

    try {
      const currentScene = displayScenes.find((scene) => scene.sceneNumber === sceneNumber);
      if (!currentScene?.visualPrompt) return;

      const searchPrompt = visualPromptForStockSearch(currentScene.visualPrompt);
      const res = await apiRequest(
        projectId,
        "/generate/scene/video",
        "POST",
        buildSceneVideoGenerateRequest(searchPrompt, sceneNumber)
      );

      if (res?.videoUrl) {
        upsertSceneVideo(sceneNumber, {
          videoUrl: res.videoUrl,
          visualPrompt: currentScene.visualPrompt,
        });
      }
    } catch (err) {
      console.error("Regenerate scene video failed:", err);
    } finally {
      setRegeneratingScenes((prev) => prev.filter((num) => num !== sceneNumber));
    }
  };

  if (displayScenes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-center py-12">
        <Film size={40} className="text-studio-text-secondary mb-4" />
        <p className="text-sm text-studio-text-primary font-bold mb-1">No storyboard scenes yet</p>
        <p className="text-xs text-studio-text-secondary max-w-sm">
          Complete Write Script first, then pick stock clips or generate videos per scene.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 h-full select-none min-h-0">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4 shrink-0">
        <div>
          <h3 className="text-base font-bold text-studio-text-primary flex items-center gap-2">
            Storyboard Video Clips
          </h3>
          <p className="text-xs text-studio-text-secondary">
            {displayScenes.length} scene{displayScenes.length === 1 ? "" : "s"} ·{" "}
            {hasAssignedVideos
              ? `${displayScenes.filter((s) => s.videoUrl).length} with clips`
              : "pick stock or generate per scene"}
            {" · "}
            {contentFormat === "short" ? "9:16 (Shorts)" : "16:9 (Long-form)"}
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
          {displayScenes.map((scene) => {
            const isRegenerating = regeneratingScenes.includes(scene.sceneNumber);
            const hasVideo = Boolean(scene.videoUrl);
            return (
              <div
                key={scene.sceneNumber}
                className={`flex flex-col rounded-2xl bg-studio-surface border overflow-hidden transition-all duration-200 group relative animate-fade-in ${
                  hasVideo ? "border-studio-border/60 hover:border-accent/40" : "border-dashed border-studio-border/80"
                }`}
              >
                <div
                  className={`relative bg-studio-bg overflow-hidden ${
                    contentFormat === "short" ? "aspect-[9/16]" : "aspect-[16/9]"
                  }`}
                >
                  {hasVideo && !isRegenerating ? (
                    <video
                      src={scene.videoUrl!}
                      loop
                      muted
                      playsInline
                      autoPlay
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : !isRegenerating ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
                      <Film size={24} className="text-studio-text-secondary/50" />
                      <span className="text-[10px] font-medium text-studio-text-secondary leading-snug">
                        No clip yet — use stock below
                      </span>
                    </div>
                  ) : null}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  <div className="absolute top-3 left-3 flex items-center gap-1.5 z-20">
                    <span className="text-[9px] font-bold text-studio-text-primary px-2 py-0.5 rounded-full bg-studio-surface/80 border border-studio-border/60 uppercase tracking-wider">
                      Scene {scene.sceneNumber}
                    </span>
                  </div>

                  <div className="absolute top-3 right-3 opacity-80 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 z-20 flex items-center gap-1.5">
                    {hasVideo && (
                      <button
                        type="button"
                        onClick={() => handleDownloadVideo(scene.videoUrl!, scene.sceneNumber)}
                        title="Download video"
                        className="p-1.5 rounded-lg bg-black/60 border border-white/10 hover:border-accent/40 text-studio-text-secondary hover:text-accent cursor-pointer transition-colors"
                      >
                        <Download size={12} />
                      </button>
                    )}
                    <label
                      title="Upload custom video"
                      className="p-1.5 rounded-lg bg-black/60 border border-white/10 hover:border-accent/40 text-studio-text-secondary hover:text-accent cursor-pointer transition-colors flex items-center justify-center"
                    >
                      <Upload size={12} />
                      <input
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) => handleUploadVideo(scene.sceneNumber, e)}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => handleRegenerateVideo(scene.sceneNumber)}
                      title="Generate scene video with Gemini Veo"
                      className="p-1.5 rounded-lg bg-black/60 border border-white/10 hover:border-accent/40 text-studio-text-secondary hover:text-accent cursor-pointer transition-colors"
                      disabled={isRegenerating}
                    >
                      <RefreshCw size={12} className={isRegenerating ? "animate-spin text-accent" : ""} />
                    </button>
                  </div>

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

        <SceneStockSearchPanel
          projectId={projectId}
          scenes={stockSearchScenes}
          kind="video"
          onAssign={assignStockVideo}
          assignLabel="Use"
        />
      </div>

      {onPush && hasAssignedVideos && (
        <div className="pt-4 border-t border-studio-border/30 flex justify-end shrink-0">
          <button
            type="button"
            onClick={() => onPush("Render final video compilation using FFmpeg render CLI.", "ffmpeg_render")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent hover:bg-accent/90 text-xs font-bold text-white transition-all cursor-pointer shadow-md"
          >
            Confirm &amp; Render Video &rarr;
          </button>
        </div>
      )}
    </div>
  );
}
