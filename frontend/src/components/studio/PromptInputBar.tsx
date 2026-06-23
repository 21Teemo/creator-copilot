"use client";

import React, { useState, useEffect, useRef } from "react";
import { useProjectStore } from "@/stores/useProjectStore";
import { useScriptingStore } from "@/stores/useScriptingStore";
import { useSeoStore } from "@/stores/useSeoStore";
import { useMediaStore } from "@/stores/useMediaStore";
import { ArrowUp, LayoutGrid, Image as ImageIcon, Video, Volume2, User, Smile, Upload } from "lucide-react";

interface PromptInputBarProps {
  onSubmit: (prompt: string) => void;
  disabled?: boolean;
}

const CATEGORIES = [
  { id: "all", label: "All", icon: LayoutGrid, placeholder: "Ask to search niche trends, write an outline..." },
  { id: "images", label: "Images", icon: ImageIcon, placeholder: "Describe the image or cover art you want to generate..." },
  { id: "videos", label: "Videos", icon: Video, placeholder: "Describe the video clip or storyboard scene to generate..." },
  { id: "voices", label: "Voices", icon: Volume2, placeholder: "Describe the voiceover narration style or enter script lines..." },
  { id: "characters", label: "Characters", icon: User, placeholder: "Describe characters or character visual styling..." },
  { id: "avatar", label: "Avatar", icon: Smile, placeholder: "Customize avatar styling, poses, or expressions..." },
  { id: "uploads", label: "Uploads", icon: Upload, placeholder: "Upload or search your assets and source files..." },
];

export default function PromptInputBar({ onSubmit, disabled }: PromptInputBarProps) {
  const [prompt, setPrompt] = useState("");
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const [attachedFile, setAttachedFile] = useState<{ name: string; dataUrl: string; type: string } | null>(null);
  
  const contentFormat = useProjectStore((state) => state.contentFormat);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getPlaceholderText = () => {
    if (activeCategory !== "all") {
      const cat = CATEGORIES.find((c) => c.id === activeCategory);
      return cat ? cat.placeholder : "";
    }
    return contentFormat === "short"
      ? "Ask to design a viral hook, write a script, generate Short scenes..."
      : "Ask to search niche trends, write an outline, compile horizontal videos...";
  };

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
      setActiveCategory("uploads");
    };
    reader.readAsDataURL(file);
  };

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!prompt.trim() || disabled) return;
    
    let finalPrompt = prompt.trim();
    if (activeCategory !== "all") {
      finalPrompt = `[Category: ${activeCategory}] ${finalPrompt}`;
    }

    if (attachedFile) {
      finalPrompt = `${finalPrompt} [Uploaded File: ${attachedFile.name}]`;
      
      // Client-side file routing to respective stores
      if (attachedFile.type.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp)$/i.test(attachedFile.name)) {
        // Update SEO thumbnail and first scene image
        useSeoStore.getState().setThumbnailUrl(attachedFile.dataUrl);
        const currentScenes = [...useMediaStore.getState().sceneImages];
        if (currentScenes.length > 0) {
          currentScenes[0] = { ...currentScenes[0], imageUrl: attachedFile.dataUrl };
          useMediaStore.getState().setSceneImages(currentScenes);
        }
      } else if (attachedFile.type.startsWith("video/") || /\.(mp4|webm|mov|ogg)$/i.test(attachedFile.name)) {
        // Update compiled video URL
        useMediaStore.getState().setVideoUrl(attachedFile.dataUrl);
      } else if (attachedFile.type.startsWith("text/") || /\.(txt|json|md|rtf)$/i.test(attachedFile.name)) {
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

  // Close attachment menu on outside click
  useEffect(() => {
    if (!showAttachMenu) return;
    const handleClose = () => setShowAttachMenu(false);
    window.addEventListener("click", handleClose);
    return () => window.removeEventListener("click", handleClose);
  }, [showAttachMenu]);

  const ActiveIcon = CATEGORIES.find((c) => c.id === activeCategory)?.icon || LayoutGrid;

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

        {/* Attachment Filter Menu Button */}
        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowAttachMenu(!showAttachMenu);
            }}
            className={`w-8 h-8 rounded-xl flex items-center justify-center bg-studio-bg hover:bg-studio-border text-studio-text-secondary hover:text-studio-text-primary border border-studio-border/60 transition-all cursor-pointer ${
              showAttachMenu ? "bg-studio-border/50 text-studio-text-primary ring-2 ring-accent/35" : ""
            }`}
          >
            <ActiveIcon size={15} />
          </button>

          {/* Attachment Dropdown */}
          {showAttachMenu && (
            <div className="absolute bottom-11 left-0 w-48 rounded-xl bg-studio-surface border border-studio-border/60 shadow-2xl p-1 z-50 animate-fade-in space-y-0.5">
              {CATEGORIES.map((cat) => {
                const IconComponent = cat.icon;
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      if (cat.id === "uploads") {
                        fileInputRef.current?.click();
                      } else {
                        setActiveCategory(cat.id);
                      }
                      setShowAttachMenu(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-xs transition-all cursor-pointer ${
                      isActive
                        ? "bg-studio-border text-studio-text-primary font-semibold"
                        : "text-studio-text-secondary hover:text-studio-text-primary hover:bg-studio-bg"
                    }`}
                  >
                    <IconComponent size={14} className={isActive ? "text-accent" : "text-studio-text-secondary"} />
                    {cat.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Attached File Badge */}
        {attachedFile && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-accent/10 border border-accent/25 text-studio-text-primary text-[10px] shrink-0 animate-fade-in">
            <span className="truncate max-w-[120px] font-semibold">{attachedFile.name}</span>
            <button
              type="button"
              onClick={() => {
                setAttachedFile(null);
                setActiveCategory("all");
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
          placeholder={getPlaceholderText()}
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
