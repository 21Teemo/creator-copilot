"use client";

import React, { useRef, useEffect } from "react";
import { useScriptingStore, VISUAL_STYLES } from "@/stores/useScriptingStore";
import { FileText, Eye, AlertCircle, Sparkles, Info, Check } from "lucide-react";

export default function ScriptView() {
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

  const currentStyle = VISUAL_STYLES.find((s) => s.id === selectedStyle);

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
          Aesthetic Visual Presets (Lavish Gothic Guide)
        </h4>
        <div className="flex flex-wrap gap-2">
          {VISUAL_STYLES.map((style) => {
            const isSelected = selectedStyle === style.id;
            return (
              <button
                key={style.id}
                onClick={() => setSelectedStyle(style.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer border ${
                  isSelected
                    ? "bg-accent/15 border-accent text-accent shadow-[0_0_12px_rgba(99,102,241,0.15)]"
                    : "bg-studio-bg border-studio-border/60 text-studio-text-secondary hover:text-studio-text-primary hover:border-studio-border/80"
                }`}
              >
                <span>{style.name}</span>
                {isSelected && <Check size={11} className="shrink-0" />}
                {style.id !== "default" && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedStyle(style.id);
                    }}
                    className="p-0.5 rounded-full hover:bg-studio-border/40 text-studio-text-secondary/60 hover:text-accent transition-colors"
                    title="View style details"
                  >
                    <Info size={11} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Style Detail Card */}
      {currentStyle && currentStyle.id !== "default" && (
        <div className="mb-4 p-4 rounded-2xl bg-studio-surface border border-accent/25 shadow-lg animate-fade-in space-y-3.5 shrink-0 select-text">
          <div className="flex items-center justify-between border-b border-studio-border/50 pb-2">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-accent" />
              <h4 className="text-xs font-bold text-studio-text-primary">
                Active Style Details: {currentStyle.name}
              </h4>
            </div>
            <button
              onClick={() => setSelectedStyle("default")}
              className="text-[10px] text-studio-text-secondary hover:text-studio-text-primary underline cursor-pointer"
            >
              Reset to Default
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[11px] leading-relaxed">
            <div className="space-y-1">
              <span className="font-bold uppercase text-studio-text-secondary text-[9px] tracking-wider block">Core Aesthetic</span>
              <p className="text-studio-text-primary">{currentStyle.aesthetic}</p>
            </div>
            <div className="space-y-2">
              <div>
                <span className="font-bold uppercase text-studio-text-secondary text-[9px] tracking-wider block mb-0.5">Lighting & Atmosphere</span>
                <p className="text-studio-text-primary">{currentStyle.lighting}</p>
              </div>
              <div>
                <span className="font-bold uppercase text-studio-text-secondary text-[9px] tracking-wider block mb-0.5">Composition</span>
                <p className="text-studio-text-primary">{currentStyle.composition}</p>
              </div>
            </div>
            <div className="space-y-2">
              <div>
                <span className="font-bold uppercase text-studio-text-secondary text-[9px] tracking-wider block mb-0.5">Best For / Pairings</span>
                <p className="text-studio-text-primary">
                  <strong>Best:</strong> {currentStyle.bestFor}<br />
                  <strong>Pairings:</strong> {currentStyle.pairings}
                </p>
              </div>
              <div>
                <span className="font-bold uppercase text-studio-text-secondary text-[9px] tracking-wider block mb-1">Color Palette</span>
                <div className="flex items-center gap-1.5">
                  {currentStyle.colors.map((color) => (
                    <div
                      key={color}
                      className="w-5 h-5 rounded-full border border-studio-border/60 relative group"
                      style={{ backgroundColor: color }}
                      title={color}
                    >
                      <span className="absolute -top-6 left-1/2 -translate-x-1/2 scale-0 group-hover:scale-100 bg-studio-surface border border-studio-border/80 text-[8px] font-mono text-studio-text-primary px-1.5 py-0.5 rounded shadow-lg transition-all whitespace-nowrap z-50">
                        {color}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
            <div className="p-6 flex-1 overflow-y-auto">
              <div className="max-w-2xl mx-auto">
                <textarea
                  ref={textareaRef}
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  className="w-full bg-transparent text-studio-text-primary text-sm leading-relaxed focus:outline-none resize-none placeholder-studio-text-secondary/50 font-sans"
                  placeholder="Start writing or let the generator write for you..."
                  rows={15}
                />
              </div>
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
