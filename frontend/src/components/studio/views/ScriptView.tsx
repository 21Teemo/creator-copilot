"use client";

import React, { useRef, useEffect, useState } from "react";
import { useScriptingStore, VISUAL_STYLES, type StoryboardScene } from "@/stores/useScriptingStore";
import { useStudioStore } from "@/stores/useStudioStore";
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
} from "lucide-react";

interface ScriptViewProps {
  onPush?: (prompt: string, action: string) => void;
}

function formatStoryboardForCopy(storyboard: StoryboardScene[]): string {
  return storyboard
    .map(
      (scene) =>
        `Scene ${scene.sceneNumber}\nVisual: ${scene.visualPrompt}\nVoiceover: ${scene.narrationText || ""}`
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
    onPush?.(
      "Re-generate the voiceover script and storyboard outline based on the research brief.",
      "write_script"
    );
  };

  if (!script) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-center py-12">
        <FileText size={40} className="text-studio-text-secondary mb-4" />
        <p className="text-sm text-studio-text-primary font-bold mb-1">No script generated yet</p>
        <p className="text-xs text-studio-text-secondary max-w-sm">
          Click the "Write Script" control below or type in the prompt bar to draft script narration and
          storyboard outlines.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 h-full select-none">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h3 className="text-base font-bold text-studio-text-primary flex items-center gap-1.5">
            Voiceover Script & Storyboard
            <span className="text-[10px] bg-studio-border px-2 py-0.5 rounded-full font-normal text-studio-text-secondary">
              Inline Editable
            </span>
          </h3>
          <p className="text-xs text-studio-text-secondary">
            Manually edit the text below. Changes save instantly.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-studio-text-secondary font-medium">
          <span>{wordCount} words</span>
          <span className="text-studio-border">|</span>
          <span>{charCount} chars</span>
        </div>
      </div>

      {/* Visual Style Presets Panel */}
      <div className="mb-4 shrink-0 bg-studio-surface border border-studio-border/60 p-3.5 rounded-2xl">
        <h4 className="text-[10px] font-bold text-studio-text-secondary uppercase tracking-wider mb-2.5 flex items-center gap-1">
          <Sparkles size={11} className="text-accent" />
          Aesthetic Visual Presets (Hover for Style Guide details)
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
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 rounded-2xl bg-[#131317]/95 backdrop-blur-xl border border-accent/25 shadow-2xl p-4 opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 origin-top z-50 text-left select-none">
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

      <div className="flex-1 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 h-full">
          {/* Main Script Editor Column */}
          <div className="lg:col-span-2 flex flex-col bg-studio-surface border border-studio-border/60 rounded-2xl overflow-hidden h-full">
            <div className="px-4 py-3 bg-studio-border/20 border-b border-studio-border/40 flex items-center gap-2">
              <FileText size={14} className="text-accent" />
              <span className="text-xs font-bold text-studio-text-primary uppercase tracking-wider">
                Narration Script
              </span>
            </div>
            <div className="p-6 flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto max-w-2xl w-full mx-auto mb-4 select-text">
                <textarea
                  ref={textareaRef}
                  value={script}
                  onChange={(e) => updateScript(e.target.value)}
                  className="w-full bg-transparent text-studio-text-primary text-sm leading-relaxed focus:outline-none resize-none placeholder-studio-text-secondary/50 font-sans"
                  placeholder="Start writing or let the generator write for you..."
                  rows={15}
                />
              </div>
              {onPush && (
                <div className="pt-4 border-t border-studio-border/30 flex justify-end shrink-0 max-w-2xl w-full mx-auto">
                  <button
                    onClick={() =>
                      onPush("Generate storyboard keyframe scene pictures for the script.", "scene_pictures")
                    }
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent hover:bg-accent/90 text-xs font-bold text-white transition-all cursor-pointer shadow-md"
                  >
                    Confirm & Source Pictures &rarr;
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Storyboard Outline Column */}
          <div className="flex flex-col bg-studio-surface border border-studio-border/60 rounded-2xl overflow-hidden h-full">
            <div className="px-4 py-3 bg-studio-border/20 border-b border-studio-border/40 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Eye size={14} className="text-accent shrink-0" />
                <span className="text-xs font-bold text-studio-text-primary uppercase tracking-wider truncate">
                  Storyboard Outline ({storyboard.length})
                </span>
              </div>
              {storyboard.length > 0 && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsEditingStoryboard((v) => !v)}
                    aria-label={isEditingStoryboard ? "Preview storyboard" : "Edit storyboard"}
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
                      aria-label="Regenerate storyboard"
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-studio-text-secondary hover:text-accent hover:bg-accent/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                    >
                      {loading ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                      Regenerate
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleCopyStoryboard}
                    aria-label="Copy storyboard to clipboard"
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-studio-text-secondary hover:text-accent hover:bg-accent/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                  >
                    {copiedStoryboard ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
                    {copiedStoryboard ? "Copied" : "Copy all"}
                  </button>
                </div>
              )}
            </div>
            <div className="p-4 flex-1 overflow-y-auto space-y-3 select-text">
              {storyboard.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-studio-text-secondary gap-2">
                  <AlertCircle size={20} className="text-studio-text-secondary/50" />
                  <p className="text-xs">No visual scenes generated.</p>
                  {onPush && (
                    <button
                      type="button"
                      onClick={handleRegenerateStoryboard}
                      disabled={loading}
                      className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-accent bg-accent/10 hover:bg-accent/20 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                      Generate storyboard
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
                        Visual Concept
                      </label>
                      <textarea
                        value={scene.visualPrompt}
                        onChange={(e) =>
                          updateStoryboardScene(scene.sceneNumber, { visualPrompt: e.target.value })
                        }
                        rows={4}
                        className="w-full text-[11px] text-studio-text-primary leading-relaxed bg-studio-surface/50 border border-studio-border/50 rounded-lg p-2 focus:outline-none focus:border-accent/40 resize-y min-h-[72px]"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-semibold text-studio-text-secondary uppercase block mb-1">
                        Voiceover
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
                        Visual Concept
                      </span>
                      <p className="text-[11px] text-studio-text-primary leading-[1.6]">
                        {scene.visualPrompt}
                      </p>
                    </div>
                    {scene.narrationText && (
                      <div>
                        <span className="text-[9px] font-semibold text-studio-text-secondary uppercase block mb-0.5">
                          Voiceover
                        </span>
                        <p className="text-[11px] text-studio-text-secondary leading-relaxed">
                          {scene.narrationText}
                        </p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
