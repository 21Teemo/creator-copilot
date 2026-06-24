"use client";

import React, { useState, useRef } from "react";
import { useProjectStore } from "@/stores/useProjectStore";
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

  const contentFormat = useProjectStore((state) => state.contentFormat);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const placeholderText =
    contentFormat === "short"
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
    </div>
  );
}
