"use client";

import React, { useState } from "react";
import { useSeoStore, PublishStatus } from "@/stores/useSeoStore";
import { useProjectStore } from "@/stores/useProjectStore";
import { FileSearch, Sparkles, SquarePlay, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";

interface SeoViewProps {
  onPublish: () => void;
}

export default function SeoView({ onPublish }: SeoViewProps) {
  const {
    titles,
    description,
    tags,
    chapters,
    publishStatus,
    publishedUrl,
    setDescription,
  } = useSeoStore();
  const contentFormat = useProjectStore((state) => state.contentFormat);

  const [selectedTitle, setSelectedTitle] = useState<string>("");

  // Select first title as default once generated
  React.useEffect(() => {
    if (titles.length > 0 && !selectedTitle) {
      setSelectedTitle(titles[0]);
    }
  }, [titles, selectedTitle]);

  if (titles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-center py-12">
        <FileSearch size={40} className="text-studio-text-secondary animate-pulse mb-4" />
        <p className="text-sm text-studio-text-secondary">No SEO metadata generated yet. Run SEO & Publish first.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 h-full select-none">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h3 className="text-base font-bold text-studio-text-primary">
            SEO Optimization & Upload Studio
          </h3>
          <p className="text-xs text-studio-text-secondary">
            Refine your titles, descriptions, and publish directly as a YouTube draft
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 h-full">
          {/* Left Column: Title selection & Description editor */}
          <div className="flex flex-col bg-studio-surface border border-studio-border/60 rounded-2xl overflow-hidden h-full">
            <div className="px-4 py-3 bg-studio-border/20 border-b border-studio-border/40 flex items-center gap-2">
              <Sparkles size={14} className="text-accent" />
              <span className="text-xs font-bold text-studio-text-primary uppercase tracking-wider">
                High-CTR Title Candidates
              </span>
            </div>
            <div className="p-4 flex-1 overflow-y-auto space-y-4">
              <div className="space-y-2">
                {titles.map((title, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedTitle(title)}
                    className={`w-full text-left p-3 rounded-xl border transition-all duration-200 cursor-pointer text-xs font-medium ${
                      selectedTitle === title
                        ? "bg-accent/10 border-accent text-studio-text-primary shadow-sm"
                        : "bg-studio-bg border-studio-border/60 text-studio-text-secondary hover:border-accent/40"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-0.5 w-3 h-3 rounded-full flex items-center justify-center shrink-0 border ${
                          selectedTitle === title ? "border-accent bg-accent" : "border-studio-border"
                        }`}
                      >
                        {selectedTitle === title && (
                          <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </span>
                      <span>{title}</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Description Panel */}
              <div className="space-y-2 pt-2">
                <span className="text-[10px] font-bold text-studio-text-secondary uppercase tracking-wider">
                  YouTube Description
                </span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                  className="w-full bg-studio-bg border border-studio-border rounded-xl p-3 text-xs text-studio-text-primary focus:outline-none focus:ring-1 focus:ring-accent leading-relaxed"
                />
              </div>
            </div>
          </div>

          {/* Right Column: Chapters, tags & publishing */}
          <div className="flex flex-col bg-studio-surface border border-studio-border/60 rounded-2xl overflow-hidden h-full">
            <div className="px-4 py-3 bg-studio-border/20 border-b border-studio-border/40 flex items-center gap-2">
              <SquarePlay size={14} className="text-accent" />
              <span className="text-xs font-bold text-studio-text-primary uppercase tracking-wider">
                Video Timeline & Publish
              </span>
            </div>
            
            <div className="p-4 flex-1 overflow-y-auto space-y-4">
              {/* Chapters list */}
              {chapters.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-studio-text-secondary uppercase tracking-wider">
                    Auto-Chapters ({contentFormat === "short" ? "N/A" : `${chapters.length} segments`})
                  </span>
                  <div className="p-3 bg-studio-bg border border-studio-border rounded-xl space-y-2 max-h-36 overflow-y-auto">
                    {chapters.map((chap, idx) => (
                      <div key={idx} className="flex items-center gap-2.5 text-xs text-studio-text-secondary">
                        <span className="font-mono text-accent font-semibold">{chap.timestamp}</span>
                        <span className="text-studio-text-primary truncate">{chap.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags panel */}
              {tags.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-studio-text-secondary uppercase tracking-wider">
                    Metadata Tags
                  </span>
                  <div className="flex flex-wrap gap-1.5 p-3 bg-studio-bg border border-studio-border rounded-xl">
                    {tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded bg-studio-surface border border-studio-border text-[10px] text-studio-text-secondary"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Publishing Status Panel */}
              <div className="pt-2 border-t border-studio-border/50">
                {publishStatus === "publishing" ? (
                  <div className="p-4 bg-studio-bg border border-studio-border rounded-xl flex flex-col items-center gap-2 text-center text-xs">
                    <span className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                    <span className="font-bold text-studio-text-primary">Uploading YouTube Draft...</span>
                    <span className="text-[10px] text-studio-text-secondary">Sending title, summary description, and video streams</span>
                  </div>
                ) : publishStatus === "published" ? (
                  <div className="p-4 bg-studio-success/10 border border-studio-success/30 rounded-xl flex flex-col items-center gap-2 text-center text-xs">
                    <CheckCircle size={28} className="text-studio-success" />
                    <span className="font-bold text-studio-success">Draft Successfully Uploaded!</span>
                    <p className="text-[10px] text-studio-text-secondary leading-normal">
                      The video and metadata have been synchronized as a draft.
                    </p>
                    <a
                      href={publishedUrl || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 px-3 py-1 bg-studio-success hover:bg-studio-success/80 text-[10px] font-bold text-white rounded-lg transition-colors cursor-pointer"
                    >
                      View on YouTube Studio
                    </a>
                  </div>
                ) : publishStatus === "failed" ? (
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex flex-col items-center gap-2 text-center text-xs space-y-1">
                    <AlertCircle size={24} className="text-red-500" />
                    <span className="font-bold text-red-500">Publish Failed</span>
                    <p className="text-[10px] text-studio-text-secondary leading-normal">
                      Failed to authenticate with your Google account. Please authenticate again.
                    </p>
                    <button
                      onClick={onPublish}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-accent hover:bg-accent/80 text-[10px] font-bold text-white rounded-lg transition-colors cursor-pointer"
                    >
                      <RefreshCw size={10} />
                      Retry Upload
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 bg-studio-bg border border-studio-border rounded-xl space-y-1.5 text-[11px] text-studio-text-secondary leading-normal">
                      <p>
                        Selected Title: <strong className="text-studio-text-primary">"{selectedTitle}"</strong>
                      </p>
                      <p>Aspect: {contentFormat === "short" ? "9:16 Shorts Preset" : "16:9 1080p Stream"}</p>
                    </div>
                    <button
                      onClick={onPublish}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-accent hover:bg-accent/90 text-xs font-bold text-white transition-all cursor-pointer shadow-md"
                    >
                      <SquarePlay size={16} />
                      Publish to YouTube as Draft
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
