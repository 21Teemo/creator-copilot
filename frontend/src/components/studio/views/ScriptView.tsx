"use client";

import React, { useRef, useEffect } from "react";
import { useScriptingStore, VISUAL_STYLES } from "@/stores/useScriptingStore";
import { FileText, Eye, AlertCircle, Sparkles, Info, Check } from "lucide-react";

interface ScriptViewProps {
  onPush?: (prompt: string, action: string) => void;
}

export default function ScriptView({ onPush }: ScriptViewProps) {
  const { script, outline, storyboard, setScript, selectedStyle, setSelectedStyle } = useScriptingStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea to fit content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [script]);

  const wordCount = script ? script.trim().split(/\s+/).length : 0;
  const charCount = script ? script.length : 0;

  if (!script) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-center py-12">
        <FileText size={40} className="text-studio-text-secondary animate-pulse mb-4" />
        <p className="text-sm text-studio-text-secondary">No script has been generated yet. Run Write Script first.</p>
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

                {/* Hover Tooltip Style Guide */}
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
                        <span className="font-bold uppercase text-studio-text-secondary text-[8px] tracking-wider block mb-0.5">Core Aesthetic</span>
                        <p className="text-studio-text-primary">{style.aesthetic}</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="font-bold uppercase text-studio-text-secondary text-[8px] tracking-wider block mb-0.5">Lighting</span>
                          <p className="text-studio-text-primary line-clamp-3">{style.lighting}</p>
                        </div>
                        <div>
                          <span className="font-bold uppercase text-studio-text-secondary text-[8px] tracking-wider block mb-0.5">Composition</span>
                          <p className="text-studio-text-primary line-clamp-3">{style.composition}</p>
                        </div>
                      </div>

                      <div className="flex justify-between items-end gap-2 pt-1 border-t border-studio-border/30">
                        <div className="flex-1">
                          <span className="font-bold uppercase text-studio-text-secondary text-[8px] tracking-wider block mb-0.5">Best For</span>
                          <p className="text-studio-text-primary line-clamp-2 leading-tight">{style.bestFor}</p>
                        </div>
                        <div className="shrink-0">
                          <span className="font-bold uppercase text-studio-text-secondary text-[8px] tracking-wider block mb-1">Colors</span>
                          <div className="flex items-center gap-1">
                            {style.colors.slice(0, 4).map((color) => (
                              <div
                                key={color}
                                className="w-3.5 h-3.5 rounded-full border border-studio-border/40"
                                style={{ backgroundColor: color }}
                                title={color}
                              />
                            ))}
                          </div>
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
              <div className="flex-1 overflow-y-auto max-w-2xl w-full mx-auto mb-4">
                <textarea
                  ref={textareaRef}
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  className="w-full bg-transparent text-studio-text-primary text-sm leading-relaxed focus:outline-none resize-none placeholder-studio-text-secondary/50 font-sans"
                  placeholder="Start writing or let the generator write for you..."
                  rows={15}
                />
              </div>
              {onPush && (
                <div className="pt-4 border-t border-studio-border/30 flex justify-end shrink-0 max-w-2xl w-full mx-auto">
                  <button
                    onClick={() => onPush("Generate storyboard keyframe scene pictures for the script.", "scene_pictures")}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent hover:bg-accent/90 text-xs font-bold text-white transition-all cursor-pointer shadow-md"
                  >
                    Confirm & Source Pictures &rarr;
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Storyboard / Outline Sidebar Column */}
          <div className="flex flex-col bg-studio-surface border border-studio-border/60 rounded-2xl overflow-hidden h-full">
            <div className="px-4 py-3 bg-studio-border/20 border-b border-studio-border/40 flex items-center gap-2">
              <Eye size={14} className="text-accent" />
              <span className="text-xs font-bold text-studio-text-primary uppercase tracking-wider">
                Storyboard Outline
              </span>
            </div>
            <div className="p-4 flex-1 overflow-y-auto space-y-3">
              {storyboard.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-studio-text-secondary gap-2">
                  <AlertCircle size={20} className="text-studio-text-secondary/50" />
                  <p className="text-xs">No visual scenes generated.</p>
                </div>
              ) : (
                storyboard.map((scene) => (
                  <div
                    key={scene.sceneNumber}
                    className="p-3 rounded-xl bg-studio-bg border border-studio-border/50 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-accent uppercase tracking-wider">
                        Scene {scene.sceneNumber}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-semibold text-studio-text-secondary uppercase block mb-0.5">
                        Visual Concept:
                      </span>
                      <p className="text-[11px] text-studio-text-primary leading-normal italic">
                        "{scene.visualPrompt}"
                      </p>
                    </div>
                    {scene.narrationText && (
                      <div>
                        <span className="text-[9px] font-semibold text-studio-text-secondary uppercase block mb-0.5">
                          Voiceover:
                        </span>
                        <p className="text-[11px] text-studio-text-secondary line-clamp-2 leading-relaxed">
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
