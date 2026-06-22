"use client";

import React, { useRef, useEffect } from "react";
import { useScriptingStore } from "@/stores/useScriptingStore";
import { FileText, Eye, AlertCircle, Sparkles } from "lucide-react";

export default function ScriptView() {
  const { script, outline, storyboard, setScript } = useScriptingStore();
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
