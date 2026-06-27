"use client";

import React from "react";
import { useProjectStore } from "@/stores/useProjectStore";
import { Sparkles, Compass, Search, FileText } from "lucide-react";

interface WelcomeViewProps {
  onSelectPrompt: (prompt: string, action: string) => void;
}

export default function WelcomeView({ onSelectPrompt }: WelcomeViewProps) {
  const contentFormat = useProjectStore((state) => state.contentFormat);

  const suggestedPrompts =
    contentFormat === "long"
      ? [
          {
            label: "Explore trends in dark electronic music",
            prompt: "Explore trends in dark electronic music for long-form",
            action: "explore_trends",
            icon: <Compass size={14} className="text-accent" />,
          },
          {
            label: "Find facts about synthesized music history",
            prompt: "Find facts about synthesized music history",
            action: "fact_finder",
            icon: <Search size={14} className="text-accent" />,
          },
          {
            label: "Write a script about cybernetic cities",
            prompt: "Write a script about cybernetic cities in long-form",
            action: "write_script",
            icon: <FileText size={14} className="text-accent" />,
          },
        ]
      : [
          {
            label: "Find viral hooks for dark electronic Shorts",
            prompt: "Find viral hooks for dark electronic Shorts",
            action: "explore_trends",
            icon: <Compass size={14} className="text-accent" />,
          },
          {
            label: "Summarize top 3 electronic music trend facts",
            prompt: "Summarize top 3 electronic music trend facts",
            action: "fact_finder",
            icon: <Search size={14} className="text-accent" />,
          },
          {
            label: "Draft a 30s high-energy cyber synth script",
            prompt: "Draft a 30s high-energy cyber synth script",
            action: "write_script",
            icon: <FileText size={14} className="text-accent" />,
          },
        ];

  return (
    <div className="flex flex-col items-center justify-center flex-1 py-8 sm:py-12 px-3 sm:px-4 max-w-2xl mx-auto text-center h-full select-none">
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-full bg-accent/20 blur-xl scale-150 animate-pulse" />
        <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-studio-surface border border-studio-border text-accent">
          <Sparkles size={32} />
        </div>
      </div>

      <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-2 text-studio-text-primary">
        Welcome to your Creative Studio
      </h2>
      <p className="text-sm text-studio-text-secondary mb-8 leading-relaxed">
        This is a conversational space designed for creators. Toggle the{" "}
        <strong className="text-studio-text-primary">Content Format</strong> at the top to adapt
        the generation style, then click a suggested starting action below or write a custom command in the input bar.
      </p>

      <div className="w-full flex flex-col gap-3">
        <span className="text-xs font-semibold text-studio-text-secondary tracking-wider uppercase">
          Suggested First Actions
        </span>
        <div className="grid grid-cols-1 gap-3.5">
          {suggestedPrompts.map((item, index) => (
            <button
              key={index}
              onClick={() => onSelectPrompt(item.prompt, item.action)}
              className="flex items-center gap-3 p-4 rounded-xl bg-studio-surface hover:bg-studio-surface/60 border border-studio-border/50 hover:border-accent/40 text-left transition-all duration-200 cursor-pointer group text-sm font-medium text-studio-text-primary"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-studio-bg border border-studio-border group-hover:border-accent/30 group-hover:bg-accent/5">
                {item.icon}
              </div>
              <span className="flex-1 truncate">{item.label}</span>
              <span className="text-xs text-studio-text-secondary group-hover:text-accent font-semibold flex items-center gap-0.5">
                Start &rarr;
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
