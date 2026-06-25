"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { useProjectStore } from "@/stores/useProjectStore";
import { useStudioStore } from "@/stores/useStudioStore";
import { useScriptingStore } from "@/stores/useScriptingStore";
import { useSeoStore } from "@/stores/useSeoStore";
import { useMediaStore } from "@/stores/useMediaStore";
import {
  FileCategory,
  resolveFileCategory,
  uploadMediaAsset,
} from "@/lib/api";
import { ArrowUp, Upload } from "lucide-react";

interface PromptInputBarProps {
  projectId: string;
  onSubmit: (prompt: string) => void | Promise<void>;
  disabled?: boolean;
}

type TextAttachment = {
  kind: "text";
  name: string;
  type: string;
  category: FileCategory;
  textContent: string;
};

type BinaryAttachment = {
  kind: "binary";
  name: string;
  type: string;
  category: FileCategory;
  file: File;
};

type AttachedFile = TextAttachment | BinaryAttachment;

const SHORT_PLACEHOLDER_EXAMPLES = [
  "e.g. Funny cat fails that went viral",
  "e.g. Satisfying cooking ASMR recipes",
  "e.g. Fast-paced parkour stunts",
];

const LONG_PLACEHOLDER_EXAMPLES = [
  "e.g. Deep documentary about ancient Rome",
  "e.g. Indie game development devlogs",
  "e.g. Long-form true crime analysis",
];

const SHORT_TREND_CHIPS = [
  { label: "Breakout Hits", query: "underrated viral" },
  { label: "Viral Hooks", query: "viral hook storytime" },
  { label: "Trending Audio", query: "trending short form audio" },
  { label: "POV Storytime", query: "POV storytime drama" },
  { label: "Satisfying ASMR", query: "satisfying ASMR cooking" },
  { label: "Gym Motivation", query: "gym motivation transformation" },
];

const LONG_TREND_CHIPS = [
  { label: "Breakout Hits", query: "underrated viral documentary" },
  { label: "Documentary", query: "deep documentary explainer" },
  { label: "True Crime", query: "true crime case analysis" },
  { label: "Devlog", query: "indie game devlog" },
  { label: "Tutorial", query: "step by step tutorial" },
  { label: "Podcast", query: "long form podcast interview" },
];

function applyTextAttachment(name: string, textContent: string) {
  if (name.endsWith(".json")) {
    const parsed = JSON.parse(textContent);
    if (parsed.script) useScriptingStore.getState().setScript(parsed.script);
    if (parsed.storyboard) useScriptingStore.getState().setStoryboard(parsed.storyboard);
    return;
  }

  useScriptingStore.getState().setScript(textContent);
}

function applyBinaryAttachment(category: FileCategory, publicUrl: string) {
  if (category === "images") {
    useSeoStore.getState().setThumbnailUrl(publicUrl);
    return;
  }

  if (category === "videos") {
    useMediaStore.getState().setVideoUrl(publicUrl);
  }
}

export default function PromptInputBar({ projectId, onSubmit, disabled }: PromptInputBarProps) {
  const [prompt, setPrompt] = useState("");
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  const contentFormat = useProjectStore((state) => state.contentFormat);
  const activeView = useStudioStore((state) => state.activeView);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const placeholderExamples = useMemo(
    () => (contentFormat === "short" ? SHORT_PLACEHOLDER_EXAMPLES : LONG_PLACEHOLDER_EXAMPLES),
    [contentFormat]
  );

  const trendChips = useMemo(
    () => (contentFormat === "short" ? SHORT_TREND_CHIPS : LONG_TREND_CHIPS),
    [contentFormat]
  );

  const showTrendHints = activeView === "welcome" || activeView === "trends";

  useEffect(() => {
    setPlaceholderIndex(0);
  }, [contentFormat]);

  useEffect(() => {
    if (!showTrendHints || prompt.trim()) return;

    const intervalId = window.setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholderExamples.length);
    }, 4000);

    return () => window.clearInterval(intervalId);
  }, [showTrendHints, prompt, placeholderExamples.length]);

  const placeholderText = showTrendHints
    ? placeholderExamples[placeholderIndex]
    : contentFormat === "short"
      ? "Ask to design a viral hook, write a script, generate Short scenes..."
      : "Ask to search niche trends, write an outline, compile horizontal videos...";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const category = resolveFileCategory(file.type, file.name);

    if (category === "voices") {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachedFile({
          kind: "text",
          name: file.name,
          type: file.type,
          category,
          textContent: reader.result as string,
        });
      };
      reader.onerror = () => {
        console.error("Failed to read text file:", file.name);
      };
      reader.readAsText(file);
      return;
    }

    setAttachedFile({
      kind: "binary",
      name: file.name,
      type: file.type,
      category,
      file,
    });
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!prompt.trim() || disabled || isUploading) return;

    let finalPrompt = prompt.trim();

    if (attachedFile) {
      try {
        if (attachedFile.kind === "text") {
          applyTextAttachment(attachedFile.name, attachedFile.textContent);
          finalPrompt = `[Category: ${attachedFile.category}] ${finalPrompt} [Uploaded File: ${attachedFile.name}]`;
        } else {
          setIsUploading(true);
          const publicUrl = await uploadMediaAsset(projectId, attachedFile.file);
          applyBinaryAttachment(attachedFile.category, publicUrl);
          finalPrompt = `[Category: ${attachedFile.category}] ${finalPrompt} [Uploaded File: ${attachedFile.name}] [Uploaded URL: ${publicUrl}]`;
        }
      } catch (err) {
        console.error("Failed to process uploaded file:", err);
        return;
      } finally {
        setIsUploading(false);
      }
    }

    await onSubmit(finalPrompt);
    setPrompt("");
    setAttachedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      void handleSend();
    }
  };

  const isSubmitDisabled = !prompt.trim() || disabled || isUploading;

  return (
    <div className="w-full max-w-3xl mx-auto mb-6 shrink-0 relative px-2">
      <form
        onSubmit={(e) => void handleSend(e)}
        className="flex items-center gap-3 bg-studio-surface border border-studio-border rounded-2xl px-4 py-3 shadow-studio focus-within:ring-2 focus-within:ring-accent/50 focus-within:ring-offset-2 focus-within:ring-offset-studio-bg transition-all duration-300"
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading}
          className="w-8 h-8 rounded-xl flex items-center justify-center bg-studio-bg hover:bg-studio-border text-studio-text-secondary hover:text-studio-text-primary border border-studio-border/60 transition-all cursor-pointer hover:border-accent/40 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Upload file"
        >
          <Upload size={15} />
        </button>

        {attachedFile && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-accent/10 border border-accent/25 text-studio-text-primary text-[10px] shrink-0 animate-fade-in">
            <span className="truncate max-w-[120px] font-semibold">{attachedFile.name}</span>
            <button
              type="button"
              onClick={() => {
                setAttachedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="text-studio-text-secondary hover:text-red-400 font-bold ml-1 cursor-pointer transition-colors text-xs"
            >
              ×
            </button>
          </div>
        )}

        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isUploading}
          placeholder={isUploading ? "Uploading attachment..." : placeholderText}
          className="flex-1 bg-transparent text-sm text-studio-text-primary placeholder-studio-text-secondary/50 focus:outline-none"
        />

        <button
          type="submit"
          disabled={isSubmitDisabled}
          className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
            !isSubmitDisabled
              ? "bg-accent text-white shadow-md cursor-pointer hover:bg-accent/80 scale-100"
              : "bg-studio-bg text-studio-text-secondary/35 border border-studio-border/30 cursor-not-allowed scale-95"
          }`}
        >
          <ArrowUp size={16} />
        </button>
      </form>

      {showTrendHints && (
        <div className="flex flex-wrap gap-2 mt-2 px-1">
          {trendChips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => setPrompt(chip.query)}
              disabled={disabled || isUploading}
              className="text-xs px-3 py-1 rounded-full bg-studio-border/30 text-studio-text-secondary hover:bg-accent/20 hover:text-studio-text-primary border border-studio-border/40 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
