"use client";

import React, { useState, useRef } from "react";
import { useProjectStore } from "@/stores/useProjectStore";
import { useScriptingStore } from "@/stores/useScriptingStore";
import { useSeoStore } from "@/stores/useSeoStore";
import { useMediaStore } from "@/stores/useMediaStore";
import { ArrowUp, Upload } from "lucide-react";

interface PromptInputBarProps {
  onSubmit: (prompt: string) => void;
  disabled?: boolean;
}

export default function PromptInputBar({ onSubmit, disabled }: PromptInputBarProps) {
  const [prompt, setPrompt] = useState("");
  const [attachedFile, setAttachedFile] = useState<{ name: string; dataUrl: string; type: string } | null>(null);
  
  const contentFormat = useProjectStore((state) => state.contentFormat);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const placeholderText =
    contentFormat === "short"
      ? "Ask to design a viral hook, write a script, generate Short scenes..."
      : "Ask to search niche trends, write an outline, compile horizontal videos...";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setAttachedFile({
        name: file.name,
        type: file.type,
        dataUrl: reader.result as string,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!prompt.trim() || disabled) return;
    
    let finalPrompt = prompt.trim();

    if (attachedFile) {
      // Set appropriate category prefix behind the scenes based on file type
      let category = "uploads";
      if (attachedFile.type.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp)$/i.test(attachedFile.name)) {
        category = "images";
        // Update SEO thumbnail and first scene image
        useSeoStore.getState().setThumbnailUrl(attachedFile.dataUrl);
        const currentScenes = [...useMediaStore.getState().sceneImages];
        if (currentScenes.length > 0) {
          currentScenes[0] = { ...currentScenes[0], imageUrl: attachedFile.dataUrl };
          useMediaStore.getState().setSceneImages(currentScenes);
        }
      } else if (attachedFile.type.startsWith("video/") || /\.(mp4|webm|mov|ogg)$/i.test(attachedFile.name)) {
        category = "videos";
        // Update compiled video URL
        useMediaStore.getState().setVideoUrl(attachedFile.dataUrl);
      } else if (attachedFile.type.startsWith("text/") || /\.(txt|json|md|rtf)$/i.test(attachedFile.name)) {
        category = "voices";
        try {
          const base64Content = attachedFile.dataUrl.split(",")[1];
          const binaryString = atob(base64Content);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const decodedText = new TextDecoder().decode(bytes);

          if (attachedFile.name.endsWith(".json")) {
            const parsed = JSON.parse(decodedText);
            if (parsed.script) useScriptingStore.getState().setScript(parsed.script);
            if (parsed.storyboard) useScriptingStore.getState().setStoryboard(parsed.storyboard);
          } else {
            useScriptingStore.getState().setScript(decodedText);
          }
        } catch (err) {
          console.error("Failed to decode uploaded text file:", err);
        }
      }

      finalPrompt = `[Category: ${category}] ${finalPrompt} [Uploaded File: ${attachedFile.name}]`;
    }
    
    onSubmit(finalPrompt);
    setPrompt("");
    setAttachedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSend();
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto mb-6 shrink-0 relative px-2">
      <form
        onSubmit={handleSend}
        className="flex items-center gap-3 bg-studio-surface border border-studio-border rounded-2xl px-4 py-3 shadow-studio focus-within:ring-2 focus-within:ring-accent/50 focus-within:ring-offset-2 focus-within:ring-offset-studio-bg transition-all duration-300"
      >
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Direct Upload Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-8 h-8 rounded-xl flex items-center justify-center bg-studio-bg hover:bg-studio-border text-studio-text-secondary hover:text-studio-text-primary border border-studio-border/60 transition-all cursor-pointer hover:border-accent/40"
          title="Upload file"
        >
          <Upload size={15} />
        </button>

        {/* Attached File Badge */}
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

        {/* Text Area Input */}
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholderText}
          className="flex-1 bg-transparent text-sm text-studio-text-primary placeholder-studio-text-secondary/50 focus:outline-none"
        />

        {/* Send Button */}
        <button
          type="submit"
          disabled={!prompt.trim() || disabled}
          className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
            prompt.trim() && !disabled
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
