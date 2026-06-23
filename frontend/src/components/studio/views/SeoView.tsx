"use client";

import React, { useState } from "react";
import { useSeoStore, PublishStatus } from "@/stores/useSeoStore";
import { useProjectStore } from "@/stores/useProjectStore";
import { useMediaStore } from "@/stores/useMediaStore";
import { FileSearch, Sparkles, SquarePlay, CheckCircle, AlertCircle, RefreshCw, Download, Upload, Camera } from "lucide-react";

const MOCK_THUMBNAILS = [
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1542831371-29b0f74f9713?q=80&w=600&auto=format&fit=crop"
];

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
    thumbnailUrl,
    setThumbnailUrl,
    thumbnailPrompt,
    setThumbnailPrompt,
  } = useSeoStore();
  const contentFormat = useProjectStore((state) => state.contentFormat);
  const { sceneImages } = useMediaStore();

  const [selectedTitle, setSelectedTitle] = useState<string>("");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [copiedTagIndex, setCopiedTagIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedTitle, setCopiedTitle] = useState(false);

  const handleCopySelectedTitle = () => {
    if (!selectedTitle) return;
    navigator.clipboard.writeText(selectedTitle);
    setCopiedTitle(true);
    setTimeout(() => setCopiedTitle(false), 1500);
  };

  const handleCopyTag = (tag: string, index: number) => {
    navigator.clipboard.writeText(`#${tag}`);
    setCopiedTagIndex(index);
    setTimeout(() => setCopiedTagIndex(null), 1500);
  };

  const handleCopyAllTags = () => {
    const tagsString = tags.map((t) => `#${t}`).join(", ");
    navigator.clipboard.writeText(tagsString);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 1500);
  };

  const activeThumbnail = thumbnailUrl || sceneImages[0]?.imageUrl || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop";
  const activePrompt = thumbnailPrompt || sceneImages[0]?.visualPrompt || "Cyberpunk neon music cover art, high-CTR, dark styling";

  const handleDownloadThumbnail = () => {
    const link = document.createElement("a");
    link.href = activeThumbnail;
    link.download = `project-thumbnail.jpg`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUploadThumbnail = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setThumbnailUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRegenerateThumbnail = () => {
    if (isRegenerating) return;
    setIsRegenerating(true);

    setTimeout(() => {
      const candidates = MOCK_THUMBNAILS.filter((url) => url !== activeThumbnail);
      const randomThumbnail = candidates[Math.floor(Math.random() * candidates.length)];
      setThumbnailUrl(randomThumbnail);
      setIsRegenerating(false);
    }, 850);
  };

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
              {/* Video Thumbnail Section */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-studio-text-secondary uppercase tracking-wider">
                  Video Thumbnail
                </span>
                <div
                  className={`relative bg-studio-bg rounded-xl overflow-hidden border border-studio-border/60 group ${
                    contentFormat === "short" ? "aspect-[9/16] w-36 mx-auto" : "w-full aspect-[16/9]"
                  }`}
                >
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
                    style={{ backgroundImage: `url(${activeThumbnail})` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

                  {/* Top Badge */}
                  <div className="absolute top-2 left-2 z-20">
                    <span className="text-[9px] font-bold text-studio-text-primary px-2 py-0.5 rounded-full bg-studio-surface/85 border border-studio-border/60 uppercase tracking-wider">
                      Preview Thumbnail
                    </span>
                  </div>

                  {/* Hover actions inside card */}
                  <div className="absolute top-2 right-2 opacity-80 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 z-20 flex items-center gap-1.5">
                    <button
                      onClick={handleDownloadThumbnail}
                      title="Download thumbnail"
                      className="p-1.5 rounded-lg bg-black/60 border border-white/10 hover:border-accent/40 text-studio-text-secondary hover:text-accent cursor-pointer transition-colors"
                    >
                      <Download size={12} />
                    </button>
                    <label
                      title="Upload custom thumbnail"
                      className="p-1.5 rounded-lg bg-black/60 border border-white/10 hover:border-accent/40 text-studio-text-secondary hover:text-accent cursor-pointer transition-colors flex items-center justify-center"
                    >
                      <Upload size={12} />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleUploadThumbnail}
                      />
                    </label>
                    <button
                      onClick={handleRegenerateThumbnail}
                      title="Regenerate thumbnail"
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
                        value={activePrompt}
                        onChange={(e) => setThumbnailPrompt(e.target.value)}
                        className="w-full bg-transparent text-[10px] leading-normal font-medium text-white focus:outline-none resize-none h-11 placeholder-white/40 focus:bg-black/20 px-1 rounded transition-colors"
                        placeholder="Edit thumbnail prompt..."
                      />
                    </div>
                  </div>

                  {/* Loading spinner */}
                  {isRegenerating && (
                    <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-2 z-10 backdrop-blur-sm animate-fade-in">
                      <RefreshCw size={16} className="text-accent animate-spin" />
                      <span className="text-[9px] font-bold text-studio-text-secondary uppercase tracking-wider">
                        Generating...
                      </span>
                    </div>
                  )}
                </div>
              </div>

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
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-studio-text-secondary uppercase tracking-wider">
                      Metadata Tags
                    </span>
                    <button
                      onClick={handleCopyAllTags}
                      className="text-[9px] font-bold text-accent hover:text-accent/80 transition-colors uppercase cursor-pointer"
                    >
                      {copiedAll ? "Copied All!" : "Copy All"}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 p-3 bg-studio-bg border border-studio-border rounded-xl">
                    {tags.map((tag, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleCopyTag(tag, idx)}
                        title="Click to copy tag"
                        className="relative px-2 py-0.5 rounded bg-studio-surface border border-studio-border text-[10px] text-studio-text-secondary hover:text-accent hover:border-accent/40 cursor-pointer transition-all duration-200"
                      >
                        {copiedTagIndex === idx ? "Copied!" : `#${tag}`}
                      </button>
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
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate">
                          Selected Title: <strong className="text-studio-text-primary">"{selectedTitle}"</strong>
                        </p>
                        <button
                          onClick={handleCopySelectedTitle}
                          className="text-[9px] font-bold text-accent hover:text-accent/80 transition-colors uppercase cursor-pointer shrink-0"
                        >
                          {copiedTitle ? "Copied!" : "Copy"}
                        </button>
                      </div>
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
