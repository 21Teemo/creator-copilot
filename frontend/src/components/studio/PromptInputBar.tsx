"use client";

import React, { useState, useEffect, useRef } from "react";
import { useProjectStore } from "@/stores/useProjectStore";
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
  const contentFormat = useProjectStore((state) => state.contentFormat);
  const menuRef = useRef<HTMLDivElement>(null);

  const getPlaceholderText = () => {
    if (activeCategory !== "all") {
      const cat = CATEGORIES.find((c) => c.id === activeCategory);
      return cat ? cat.placeholder : "";
    }
    return contentFormat === "short"
      ? "Ask to design a viral hook, write a script, generate Short scenes..."
      : "Ask to search niche trends, write an outline, compile horizontal videos...";
  };

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!prompt.trim() || disabled) return;
    
    let finalPrompt = prompt.trim();
    if (activeCategory !== "all") {
      finalPrompt = `[Category: ${activeCategory}] ${finalPrompt}`;
    }
    onSubmit(finalPrompt);
    setPrompt("");
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
                      setActiveCategory(cat.id);
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
