"use client";

import React from "react";
import { useResearchStore } from "@/stores/useResearchStore";
import { Search, Link as LinkIcon, AlertCircle, FileText } from "lucide-react";

interface FactsViewProps {
  onPush?: (prompt: string, action: string) => void;
}

export default function FactsView({ onPush }: FactsViewProps) {
  const { summaries, updateSummaryText } = useResearchStore();

  if (!summaries) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-center py-12">
        <Search size={40} className="text-studio-text-secondary animate-pulse mb-4" />
        <p className="text-sm text-studio-text-secondary">No facts data available. Run Fact Finder first.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 h-full select-none">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h3 className="text-base font-bold text-studio-text-primary">
            Research Brief & Fact Summary
          </h3>
          <p className="text-xs text-studio-text-secondary">
            Synthesized by Gemini based on top web search queries
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 h-full">
          {/* Main Brief Panel */}
          <div className="lg:col-span-2 flex flex-col bg-studio-surface border border-studio-border/60 rounded-2xl overflow-hidden h-full">
            <div className="px-4 py-3 bg-studio-border/20 border-b border-studio-border/40 flex items-center gap-2">
              <FileText size={14} className="text-accent" />
              <span className="text-xs font-bold text-studio-text-primary uppercase tracking-wider">
                Synthesized Brief (Editable)
              </span>
            </div>
            <div className="p-5 flex-1 flex flex-col min-h-0">
              <textarea
                value={summaries.summaryText}
                onChange={(e) => updateSummaryText(e.target.value)}
                className="w-full flex-1 bg-transparent text-studio-text-primary text-xs leading-relaxed focus:outline-none resize-none placeholder-studio-text-secondary/50 font-sans p-3.5 rounded-xl bg-studio-bg/30 border border-studio-border/50 focus:border-accent/40 focus:bg-studio-bg/60 transition-all duration-200"
                placeholder="Review or edit the research brief summary..."
              />
              {onPush && (
                <div className="mt-4 pt-3.5 border-t border-studio-border/30 flex justify-end shrink-0">
                  <button
                    onClick={() => onPush("Write a voiceover script and storyboard outline based on the research brief.", "write_script")}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent hover:bg-accent/90 text-xs font-bold text-white transition-all cursor-pointer shadow-md"
                  >
                    Confirm & Write Script &rarr;
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Sources Citation Panel */}
          <div className="flex flex-col bg-studio-surface border border-studio-border/60 rounded-2xl overflow-hidden h-full">
            <div className="px-4 py-3 bg-studio-border/20 border-b border-studio-border/40 flex items-center gap-2">
              <LinkIcon size={14} className="text-accent" />
              <span className="text-xs font-bold text-studio-text-primary uppercase tracking-wider">
                Web Sources & Citations
              </span>
            </div>
            <div className="p-4 flex-1 overflow-y-auto space-y-3">
              {summaries.sources.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-studio-text-secondary">
                  <AlertCircle size={14} />
                  No sources cited.
                </div>
              ) : (
                summaries.sources.map((source, index) => (
                  <a
                    key={index}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 rounded-xl bg-studio-bg border border-studio-border/50 hover:border-accent/40 transition-colors duration-200"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="text-xs font-bold text-studio-text-primary line-clamp-1 hover:text-accent flex-1">
                        {source.title}
                      </h4>
                      <span className="text-[9px] font-semibold text-accent px-1.5 py-0.5 rounded bg-accent/10 border border-accent/20 shrink-0">
                        [{index + 1}]
                      </span>
                    </div>
                    {source.snippet && (
                      <p className="text-[10px] text-studio-text-secondary line-clamp-2 leading-relaxed">
                        {source.snippet}
                      </p>
                    )}
                    <span className="text-[9px] text-accent mt-2 block truncate">
                      {source.url}
                    </span>
                  </a>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
