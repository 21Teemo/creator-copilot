"use client";

import React, { useRef, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useScriptingStore, VISUAL_STYLES, type StoryboardScene } from "@/stores/useScriptingStore";
import { useStudioStore } from "@/stores/useStudioStore";
import {
  useMediaStore,
  type VisualReferenceCategory,
} from "@/stores/useMediaStore";
import { uploadMediaAsset } from "@/lib/api";
import {
  FileText,
  Eye,
  AlertCircle,
  Sparkles,
  Check,
  RefreshCw,
  Copy,
  Pencil,
  Loader2,
  Upload,
  X,
  MapPin,
  User,
  Watch,
} from "lucide-react";

const REF_CATEGORIES: {
  id: VisualReferenceCategory;
  label: string;
  hint: string;
  placeholder: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "environment",
    label: "Environment",
    hint: "Same set in every scene",
    placeholder: "Bright modern gym, orange walls",
    icon: <MapPin size={12} className="text-accent" />,
  },
  {
    id: "character",
    label: "Character",
    hint: "Same look in every scene",
    placeholder: "Woman in red hoodie, curly hair",
    icon: <User size={12} className="text-accent" />,
  },
  {
    id: "gadget",
    label: "Gadget",
    hint: "Same prop in every scene",
    placeholder: "White wireless earbuds",
    icon: <Watch size={12} className="text-accent" />,
  },
];

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Upload reference images + labels — optional; enables FLUX identity lock when images are set */
export function VisualReferencesPanel({
  collapsible = false,
  defaultOpen = true,
}: {
  collapsible?: boolean;
  defaultOpen?: boolean;
} = {}) {
  const projectId = useParams()?.projectId as string;
  const { visualReferences, addVisualReference, updateVisualReference, removeVisualReference } =
    useMediaStore();
  const [uploading, setUploading] = useState<VisualReferenceCategory | null>(null);
  const hasUploadedRefs = visualReferences.some((r) => r.imageUrl?.trim());
  const [isOpen, setIsOpen] = useState(defaultOpen || hasUploadedRefs);

  useEffect(() => {
    if (hasUploadedRefs) setIsOpen(true);
  }, [hasUploadedRefs]);

  const handleUpload = async (category: VisualReferenceCategory, file: File) => {
    if (!projectId) return;
    setUploading(category);
    try {
      let imageUrl: string;
      try {
        imageUrl = await uploadMediaAsset(projectId, file);
      } catch {
        imageUrl = await readFileAsDataUrl(file);
      }
      const defaults: Record<VisualReferenceCategory, string> = {
        environment: "Main environment",
        character: "Lead character",
        gadget: "Key gadget",
      };
      addVisualReference({ category, label: defaults[category], imageUrl });
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="mb-4 shrink-0 bg-studio-surface border border-studio-border/60 p-3.5 rounded-2xl">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h4 className="text-[10px] font-bold text-studio-text-secondary uppercase tracking-wider flex items-center gap-1 flex-wrap">
          <Eye size={11} className="text-accent" />
          Visual References
          <span className="normal-case font-semibold text-studio-text-secondary/80">(optional)</span>
        </h4>
        {collapsible && (
          <button
            type="button"
            onClick={() => setIsOpen((v) => !v)}
            className="text-[10px] font-semibold text-accent hover:text-accent/80 shrink-0 cursor-pointer"
          >
            {isOpen ? "Hide" : hasUploadedRefs ? "Show" : "Add for FLUX lock"}
          </button>
        )}
      </div>
      {(!collapsible || isOpen) && (
        <>
      <p className="text-[10px] text-studio-text-secondary mb-3 leading-relaxed">
        Skip this to use stock search. Upload images only if you want FLUX PuLID/Kontext identity lock across scenes.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {REF_CATEGORIES.map((cat) => {
          const refs = visualReferences.filter((r) => r.category === cat.id);
          return (
            <div
              key={cat.id}
              className="rounded-xl border border-studio-border/50 bg-studio-bg/40 p-2.5 space-y-2"
            >
              <div className="flex items-center gap-1.5">
                {cat.icon}
                <span className="text-[10px] font-bold text-studio-text-primary uppercase tracking-wide">
                  {cat.label}
                </span>
              </div>
              <p className="text-[9px] text-studio-text-secondary">{cat.hint}</p>
              {refs.map((ref) => (
                <div key={ref.id} className="space-y-1.5">
                  <div className="relative aspect-video rounded-lg overflow-hidden border border-studio-border/50 bg-black/30">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ref.imageUrl} alt={ref.label} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeVisualReference(ref.id)}
                      className="absolute top-1 right-1 p-0.5 rounded-md bg-black/60 text-studio-text-secondary hover:text-red-400 cursor-pointer"
                      aria-label={`Remove ${cat.label} reference`}
                    >
                      <X size={10} />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={ref.label}
                    onChange={(e) => updateVisualReference(ref.id, { label: e.target.value })}
                    placeholder={cat.placeholder}
                    className="w-full text-[10px] px-2 py-1 rounded-lg bg-studio-surface border border-studio-border/50 text-studio-text-primary focus:outline-none focus:border-accent/40"
                  />
                </div>
              ))}
              <label className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg border border-dashed border-studio-border/60 text-[10px] font-semibold text-studio-text-secondary hover:text-accent hover:border-accent/40 cursor-pointer transition-colors">
                <Upload size={11} />
                {uploading === cat.id ? "Uploading…" : refs.length ? "Add another" : "Upload image"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading !== null}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleUpload(cat.id, file);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          );
        })}
      </div>
        </>
      )}
    </div>
  );
}

interface ScriptViewProps {
  onPush?: (prompt: string, action: string) => void;
}

function formatStoryboardForCopy(storyboard: StoryboardScene[]): string {
  return storyboard
    .map(
      (scene) =>
        `Scene ${scene.sceneNumber}\nImage prompt: ${scene.visualPrompt}\nVoiceover: ${scene.narrationText || ""}`
    )
    .join("\n\n");
}

export default function ScriptView({ onPush }: ScriptViewProps) {
  const {
    script,
    storyboard,
    updateScript,
    updateStoryboardScene,
    selectedStyle,
    setSelectedStyle,
  } = useScriptingStore();
  const loading = useStudioStore((state) => state.loading);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isEditingStoryboard, setIsEditingStoryboard] = useState(false);
  const [copiedStoryboard, setCopiedStoryboard] = useState(false);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [script]);

  useEffect(() => {
    if (!loading) setIsEditingStoryboard(false);
  }, [loading]);

  const wordCount = script ? script.trim().split(/\s+/).length : 0;
  const charCount = script ? script.length : 0;

  const handleCopyStoryboard = async () => {
    if (storyboard.length === 0) return;
    await navigator.clipboard.writeText(formatStoryboardForCopy(storyboard));
    setCopiedStoryboard(true);
    setTimeout(() => setCopiedStoryboard(false), 2000);
  };

  const handleRegenerateStoryboard = () => {
    onPush?.("Re-generate scene image prompts from the research brief.", "write_script");
  };

  if (storyboard.length === 0 && !script?.trim()) {
    return (
      <div className="flex flex-col flex-1 min-h-0 text-center py-4 px-2">
        <div className="flex flex-col items-center justify-center py-6 shrink-0">
          <FileText size={40} className="text-studio-text-secondary mb-4" />
          <p className="text-sm text-studio-text-primary font-bold mb-1">No scene prompts yet</p>
          <p className="text-xs text-studio-text-secondary max-w-sm mb-4">
            Complete Fact Finder, then run <strong className="text-studio-text-primary">Write Script</strong> to
            generate scene descriptions and voiceover lines.
          </p>
          {onPush && (
            <button
              type="button"
              onClick={handleRegenerateStoryboard}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent hover:bg-accent/90 text-xs font-bold text-white transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              Generate Scene Prompts
            </button>
          )}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain pr-1 -mr-1 text-left">
          <VisualReferencesPanel collapsible defaultOpen={false} />
        </div>
      </div>
    );
  }

  const scenePromptBlock = (
    <div className="flex flex-col bg-studio-surface border border-studio-border/60 rounded-2xl overflow-hidden min-h-[min(42vh,420px)]">
      <div className="px-4 py-3 bg-studio-border/20 border-b border-studio-border/40 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Eye size={14} className="text-accent shrink-0" />
          <span className="text-xs font-bold text-studio-text-primary uppercase tracking-wider truncate">
            Scene Image Prompts ({storyboard.length || "—"})
          </span>
        </div>
        {storyboard.length > 0 && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setIsEditingStoryboard((v) => !v)}
              aria-label={isEditingStoryboard ? "Preview scene prompts" : "Edit scene prompts"}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
                isEditingStoryboard
                  ? "text-accent bg-accent/15 border border-accent/30"
                  : "text-studio-text-secondary hover:text-accent hover:bg-accent/10"
              }`}
            >
              <Pencil size={11} />
              {isEditingStoryboard ? "Preview" : "Edit"}
            </button>
            {onPush && (
              <button
                type="button"
                onClick={handleRegenerateStoryboard}
                disabled={loading}
                aria-label="Regenerate scene prompts"
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-studio-text-secondary hover:text-accent hover:bg-accent/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              >
                {loading ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                Regenerate
              </button>
            )}
            <button
              type="button"
              onClick={handleCopyStoryboard}
              aria-label="Copy scene prompts to clipboard"
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-studio-text-secondary hover:text-accent hover:bg-accent/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              {copiedStoryboard ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
              {copiedStoryboard ? "Copied" : "Copy"}
            </button>
          </div>
        )}
      </div>
      <div className="p-4 flex-1 min-h-[220px] overflow-y-auto overscroll-y-contain space-y-3 select-text">
        {storyboard.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[180px] text-center text-studio-text-secondary gap-2 py-6">
            <AlertCircle size={20} className="text-studio-text-secondary/50" />
            <p className="text-xs">No scene image prompts yet.</p>
            {onPush && (
              <button
                type="button"
                onClick={handleRegenerateStoryboard}
                disabled={loading}
                className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-accent bg-accent/10 hover:bg-accent/20 transition-colors cursor-pointer disabled:opacity-50"
              >
                {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                Generate scene prompts
              </button>
            )}
          </div>
        ) : isEditingStoryboard ? (
          storyboard.map((scene) => (
            <div
              key={scene.sceneNumber}
              className="p-3 rounded-xl bg-studio-bg border border-accent/30 space-y-2.5"
            >
              <span className="text-[10px] font-bold text-accent uppercase tracking-wider">
                Scene {scene.sceneNumber}
              </span>
              <div>
                <label className="text-[9px] font-semibold text-studio-text-secondary uppercase block mb-1">
                  Scene Image Prompt
                </label>
                <textarea
                  value={scene.visualPrompt}
                  onChange={(e) =>
                    updateStoryboardScene(scene.sceneNumber, { visualPrompt: e.target.value })
                  }
                  rows={4}
                  className="w-full text-[11px] text-studio-text-primary leading-relaxed bg-studio-surface/50 border border-studio-border/50 rounded-lg p-2 focus:outline-none focus:border-accent/40 resize-y min-h-[72px]"
                  placeholder="e.g. Two friends entering a bright gym, handheld vertical shot, natural light"
                />
              </div>
              <div>
                <label className="text-[9px] font-semibold text-studio-text-secondary uppercase block mb-1">
                  Voiceover / Narrative
                </label>
                <textarea
                  value={scene.narrationText}
                  onChange={(e) =>
                    updateStoryboardScene(scene.sceneNumber, { narrationText: e.target.value })
                  }
                  rows={2}
                  className="w-full text-[11px] text-studio-text-primary leading-relaxed bg-studio-surface/50 border border-studio-border/50 rounded-lg p-2 focus:outline-none focus:border-accent/40 resize-y min-h-[48px]"
                />
              </div>
            </div>
          ))
        ) : (
          storyboard.map((scene) => (
            <div
              key={scene.sceneNumber}
              className="p-3 rounded-xl bg-studio-bg border border-studio-border/50 space-y-2"
            >
              <span className="text-[10px] font-bold text-accent uppercase tracking-wider">
                Scene {scene.sceneNumber}
              </span>
              <div>
                <span className="text-[9px] font-semibold text-studio-text-secondary uppercase block mb-0.5">
                  Scene Description
                </span>
                <p className="text-[11px] text-studio-text-primary leading-[1.6]">
                  {scene.visualPrompt || (
                    <span className="italic text-studio-text-secondary">No prompt — click Edit to add one</span>
                  )}
                </p>
              </div>
              <div>
                <span className="text-[9px] font-semibold text-studio-text-secondary uppercase block mb-0.5">
                  Voiceover / Narrative
                </span>
                <p className="text-[11px] text-studio-text-secondary leading-relaxed">
                  {scene.narrationText || (
                    <span className="italic text-studio-text-secondary/70">No narration for this scene</span>
                  )}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
      {onPush && storyboard.length > 0 && (
        <div className="px-4 pb-4 pt-0 flex justify-end shrink-0">
          <button
            onClick={() => onPush("Generate storyboard keyframe scene pictures for the script.", "scene_pictures")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent hover:bg-accent/90 text-xs font-bold text-white transition-all cursor-pointer shadow-md"
          >
            Confirm &amp; Source Scene Pictures &rarr;
          </button>
        </div>
      )}
    </div>
  );

  const voiceoverBlock = (
    <div className="flex flex-col bg-studio-surface border border-studio-border/60 rounded-2xl overflow-hidden min-h-[min(32vh,320px)]">
      <div className="px-4 py-3 bg-studio-border/20 border-b border-studio-border/40 flex items-center gap-2 shrink-0">
        <FileText size={14} className="text-accent" />
        <span className="text-xs font-bold text-studio-text-primary uppercase tracking-wider">
          Full Voiceover Script
        </span>
      </div>
      <div className="p-4 flex flex-col gap-3 flex-1 min-h-0">
        <div className="flex-1 min-h-[160px] overflow-y-auto overscroll-y-contain select-text rounded-xl bg-studio-bg/30 border border-studio-border/40 p-4">
          <textarea
            ref={textareaRef}
            value={script}
            onChange={(e) => updateScript(e.target.value)}
            className="w-full h-full min-h-[140px] bg-transparent text-studio-text-primary text-sm leading-relaxed focus:outline-none resize-none placeholder-studio-text-secondary/50 font-sans"
            placeholder="Combined voiceover lines appear here after Write Script runs..."
          />
        </div>
        <p className="text-[10px] text-studio-text-secondary px-1 shrink-0">
          {wordCount} words · {charCount} chars
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 select-none">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-3 sm:mb-4 shrink-0">
        <div className="min-w-0">
          <h3 className="text-sm sm:text-base font-bold text-studio-text-primary flex flex-wrap items-center gap-1.5">
            Write Script
            <span className="text-[10px] bg-studio-border px-2 py-0.5 rounded-full font-normal text-studio-text-secondary">
              Scenes + Voiceover
            </span>
          </h3>
          <p className="text-xs text-studio-text-secondary">
            Scene descriptions and narration below. Visual references and presets are optional setup.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-studio-text-secondary font-medium shrink-0">
          <span>{storyboard.length} scenes</span>
          <span className="text-studio-border">|</span>
          <span>{wordCount} words</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain pr-1 -mr-1 space-y-4 pb-2">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">
          <div className="lg:col-span-2 order-1">{scenePromptBlock}</div>
          <div className="order-2">{voiceoverBlock}</div>
        </div>

        <VisualReferencesPanel collapsible defaultOpen={false} />

        {/* Visual Style Presets Panel */}
        <div className="shrink-0 bg-studio-surface border border-studio-border/60 p-3.5 rounded-2xl">
        <h4 className="text-[10px] font-bold text-studio-text-secondary uppercase tracking-wider mb-2.5 flex items-center gap-1">
          <Sparkles size={11} className="text-accent" />
          Aesthetic Visual Presets <span className="hidden sm:inline">(Hover for Style Guide details)</span>
        </h4>
        <div className="flex flex-wrap gap-2">
          {VISUAL_STYLES.map((style) => {
            const isSelected = selectedStyle === style.id;
            return (
              <div key={style.id} className="relative group">
                <button
                  onClick={() => setSelectedStyle(style.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer border ${
                    isSelected
                      ? "bg-accent/15 border-accent text-accent shadow-[0_0_12px_rgba(99,102,241,0.15)]"
                      : "bg-studio-bg border-studio-border/60 text-studio-text-secondary hover:text-studio-text-primary hover:border-studio-border/80"
                  }`}
                >
                  <span>{style.name}</span>
                  {isSelected && <Check size={11} className="shrink-0" />}
                </button>

                {style.id !== "default" && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 sm:w-72 rounded-2xl bg-[#131317]/95 backdrop-blur-xl border border-accent/25 shadow-2xl p-4 opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-focus-within:opacity-100 group-focus-within:scale-100 group-focus-within:pointer-events-auto transition-all duration-200 origin-top z-50 text-left select-none hidden sm:block">
                    <div className="flex items-center gap-1.5 border-b border-studio-border/50 pb-1.5 mb-2">
                      <Sparkles size={12} className="text-accent shrink-0" />
                      <h5 className="text-[11px] font-bold text-studio-text-primary truncate">
                        {style.name} Style Preset
                      </h5>
                    </div>
                    <div className="space-y-2.5 text-[10px] leading-relaxed">
                      <div>
                        <span className="font-bold uppercase text-studio-text-secondary text-[8px] tracking-wider block mb-0.5">
                          Core Aesthetic
                        </span>
                        <p className="text-studio-text-primary">{style.aesthetic}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="font-bold uppercase text-studio-text-secondary text-[8px] tracking-wider block mb-0.5">
                            Lighting
                          </span>
                          <p className="text-studio-text-primary line-clamp-3">{style.lighting}</p>
                        </div>
                        <div>
                          <span className="font-bold uppercase text-studio-text-secondary text-[8px] tracking-wider block mb-0.5">
                            Composition
                          </span>
                          <p className="text-studio-text-primary line-clamp-3">{style.composition}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      </div>
    </div>
  );
}
