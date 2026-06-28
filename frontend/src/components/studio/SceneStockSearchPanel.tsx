"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useMediaStore } from "@/stores/useMediaStore";
import {
  buildStockSearchRequest,
  buildStockVideoSearchRequest,
  searchStockForScenes,
  visualPromptForStockSearch,
  type SceneSearchSource,
  type SceneStockBucket,
  type SceneStockItem,
} from "@/lib/intentRouter";
import { apiRequest } from "@/lib/api";
import { Plus, RefreshCw, Search } from "lucide-react";

type StockKind = "photo" | "video";

interface SceneStockSearchPanelProps {
  projectId: string;
  scenes: SceneSearchSource[];
  kind: StockKind;
  onAssign: (sceneNumber: number, url: string) => void;
  assignLabel?: string;
}

function scenesFingerprint(scenes: SceneSearchSource[]): string {
  return scenes.map((scene) => `${scene.sceneNumber}:${scene.visualPrompt}`).join("|");
}

export default function SceneStockSearchPanel({
  projectId,
  scenes,
  kind,
  onAssign,
  assignLabel = "Use",
}: SceneStockSearchPanelProps) {
  const visualReferences = useMediaStore((state) => state.visualReferences);
  const refsFingerprint = visualReferences
    .map((ref) => `${ref.category}:${ref.label}:${ref.imageUrl || ""}`)
    .join("|");

  const [buckets, setBuckets] = useState<SceneStockBucket[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [customQuery, setCustomQuery] = useState("");
  const [customResults, setCustomResults] = useState<SceneStockItem[]>([]);
  const [customLoading, setCustomLoading] = useState(false);
  const [customScenePicker, setCustomScenePicker] = useState<number | null>(null);

  const scenesKey = useMemo(() => scenesFingerprint(scenes), [scenes]);

  const loadSceneStock = async () => {
    if (!projectId || scenes.length === 0) {
      setBuckets([]);
      return;
    }

    setIsRefreshing(true);
    setBuckets(
      scenes.map((scene) => ({
        sceneNumber: scene.sceneNumber,
        query: visualPromptForStockSearch(scene.visualPrompt),
        visualPrompt: scene.visualPrompt,
        items: [],
        loading: true,
      }))
    );

    try {
      const results = await searchStockForScenes(projectId, scenes, kind);
      setBuckets(results);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadSceneStock();
  }, [projectId, scenesKey, refsFingerprint, kind]);

  const handleCustomSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    const query = customQuery.trim();
    if (!query) {
      setCustomResults([]);
      return;
    }

    setCustomLoading(true);
    try {
      const endpoint = kind === "photo" ? "/stock/search" : "/stock/videos";
      const body =
        kind === "photo"
          ? buildStockSearchRequest(query)
          : buildStockVideoSearchRequest(query);
      const res = await apiRequest(projectId, endpoint, "POST", body);
      if (!Array.isArray(res)) {
        setCustomResults([]);
        return;
      }

      const mapped =
        kind === "photo"
          ? res.map((item: { visualPrompt?: string; imageUrl?: string }) => ({
              title: item.visualPrompt || "Stock Photo",
              url: item.imageUrl || "",
            }))
          : res.map((item: { visualPrompt?: string; videoUrl?: string }) => ({
              title: item.visualPrompt || "Stock Video",
              url: item.videoUrl || "",
            }));

      setCustomResults(mapped.filter((item) => item.url));
    } catch (err) {
      console.error("Custom stock search failed:", err);
      setCustomResults([]);
    } finally {
      setCustomLoading(false);
    }
  };

  const renderMediaPreview = (url: string) =>
    kind === "photo" ? (
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
        style={{ backgroundImage: `url(${url})` }}
      />
    ) : (
      <video
        src={url}
        loop
        muted
        playsInline
        autoPlay
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
      />
    );

  const renderResultCard = (
    item: SceneStockItem,
    idx: number,
    sceneNumber?: number
  ) => (
    <div
      key={`${sceneNumber ?? "custom"}-${idx}-${item.url}`}
      className="w-56 shrink-0 aspect-[16/9] relative rounded-xl overflow-hidden border border-studio-border/60 hover:border-accent/40 transition-colors group"
    >
      {renderMediaPreview(item.url)}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
      <div className="absolute bottom-2 left-2 right-2 flex flex-col gap-1.5 z-20">
        <span className="text-[10px] font-bold text-white truncate drop-shadow-sm">{item.title}</span>
        {sceneNumber != null ? (
          <button
            type="button"
            onClick={() => onAssign(sceneNumber, item.url)}
            className="flex items-center justify-center gap-1 py-1 px-2.5 rounded bg-accent hover:bg-accent/90 text-[9px] font-bold text-white transition-colors cursor-pointer w-fit shadow"
          >
            <Plus size={10} />
            {assignLabel} Scene {sceneNumber}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setCustomScenePicker(idx)}
            className="flex items-center justify-center gap-1 py-1 px-2.5 rounded bg-accent hover:bg-accent/90 text-[9px] font-bold text-white transition-colors cursor-pointer w-fit shadow"
          >
            <Plus size={10} />
            Add to Scene
          </button>
        )}
      </div>

      {customScenePicker === idx && sceneNumber == null && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-3 z-30 animate-fade-in backdrop-blur-sm">
          <span className="text-[9px] font-bold text-studio-text-secondary uppercase tracking-wider mb-2">
            Select Scene Number
          </span>
          <div className="flex flex-wrap gap-1.5 justify-center">
            {scenes.map((scene) => (
              <button
                key={scene.sceneNumber}
                type="button"
                onClick={() => {
                  onAssign(scene.sceneNumber, item.url);
                  setCustomScenePicker(null);
                }}
                className="px-2.5 py-1.5 rounded bg-accent hover:bg-accent/80 text-[10px] font-bold text-white transition-colors cursor-pointer min-w-16"
              >
                Scene {scene.sceneNumber}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setCustomScenePicker(null)}
            className="mt-3 text-[9px] text-studio-text-secondary hover:text-studio-text-primary"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );

  if (scenes.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-studio-text-secondary bg-studio-bg/40 border border-studio-border/30 rounded-2xl">
        Complete <strong className="text-studio-text-primary">Write Script</strong> to auto-search stock for each scene prompt.
      </div>
    );
  }

  return (
    <div className="pt-6 border-t border-studio-border/60 space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between shrink-0">
        <div>
          <h4 className="text-xs font-bold text-studio-text-primary flex items-center gap-1.5 uppercase tracking-wider">
            <Search size={14} className="text-accent" />
            Stock Libraries
          </h4>
          <p className="text-[10px] text-studio-text-secondary mt-1">
            Auto-searching Pexels from your script scene prompts
            {visualReferences.some((ref) => ref.label.trim()) ? " and visual reference labels" : ""}.
          </p>
        </div>
        <button
          type="button"
          onClick={loadSceneStock}
          disabled={isRefreshing}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold text-accent bg-accent/10 hover:bg-accent/20 border border-accent/20 transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={12} className={isRefreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="space-y-4">
        {buckets.map((bucket) => (
          <div
            key={bucket.sceneNumber}
            className="rounded-2xl border border-studio-border/40 bg-studio-bg/30 p-3 space-y-2"
          >
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="text-[10px] font-bold text-accent uppercase tracking-wider">
                  Scene {bucket.sceneNumber}
                </span>
                <p className="text-[10px] text-studio-text-secondary line-clamp-2 mt-0.5">
                  {bucket.visualPrompt || bucket.query}
                </p>
              </div>
              <span className="text-[9px] text-studio-text-secondary/80 font-mono truncate max-w-full sm:max-w-xs">
                Query: {bucket.query}
              </span>
            </div>

            {bucket.loading ? (
              <div className="py-6 flex items-center justify-center gap-2 text-xs text-studio-text-secondary">
                <RefreshCw size={14} className="animate-spin text-accent" />
                Searching stock...
              </div>
            ) : bucket.error ? (
              <div className="py-4 text-center text-xs text-studio-text-secondary">{bucket.error}</div>
            ) : bucket.items.length === 0 ? (
              <div className="py-4 text-center text-xs text-studio-text-secondary">
                No stock matches for this scene prompt.
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                {bucket.items.map((item, idx) => renderResultCard(item, idx, bucket.sceneNumber))}
              </div>
            )}
          </div>
        ))}
      </div>

      <details className="rounded-2xl border border-studio-border/30 bg-studio-bg/20 p-3">
        <summary className="text-[10px] font-bold text-studio-text-secondary uppercase tracking-wider cursor-pointer">
          Custom keyword search
        </summary>
        <form onSubmit={handleCustomSearch} className="mt-3 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-studio-text-secondary" />
            <input
              type="text"
              value={customQuery}
              onChange={(e) => setCustomQuery(e.target.value)}
              placeholder="Optional override keywords..."
              className="w-full pl-10 pr-4 py-2 bg-studio-bg border border-studio-border rounded-xl text-xs text-studio-text-primary focus:outline-none focus:border-accent placeholder-studio-text-secondary/50 font-sans"
            />
          </div>
          <button
            type="submit"
            className="w-full sm:w-auto px-4 py-2 bg-studio-surface hover:bg-studio-border/40 border border-studio-border rounded-xl text-xs font-bold text-studio-text-primary transition-colors cursor-pointer shrink-0"
          >
            Search
          </button>
        </form>

        {customLoading ? (
          <div className="mt-3 py-6 flex items-center justify-center gap-2 text-xs text-studio-text-secondary">
            <RefreshCw size={14} className="animate-spin text-accent" />
            Searching...
          </div>
        ) : customResults.length > 0 ? (
          <div className="mt-3 flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
            {customResults.map((item, idx) => renderResultCard(item, idx))}
          </div>
        ) : null}
      </details>
    </div>
  );
}
