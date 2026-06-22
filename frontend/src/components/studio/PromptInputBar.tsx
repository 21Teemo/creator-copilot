"use client";

import React, { useState, useEffect, useRef } from "react";
import { useProjectStore } from "@/stores/useProjectStore";
import { Plus, ArrowUp, Link, FileUp, SquarePlay } from "lucide-react";

interface PromptInputBarProps {
  onSubmit: (prompt: string) => void;
  disabled?: boolean;
}

export default function PromptInputBar({ onSubmit, disabled }: PromptInputBarProps) {
  const [prompt, setPrompt] = useState("");
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const contentFormat = useProjectStore((state) => state.contentFormat);
  const menuRef = useRef<HTMLDivElement>(null);

  const placeholderText =
    contentFormat === "short"
      ? "Ask to design a viral hook, write a script, generate Short scenes..."
      : "Ask to search niche trends, write an outline, compile horizontal videos...";

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!prompt.trim() || disabled) return;
    onSubmit(prompt.trim());
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

  const handleAttachOption = (option: string) => {
    setPrompt((prev) => `${prev} [Attachment: ${option}]`);
  };

  return (
    <div className="w-full max-w-3xl mx-auto mb-6 shrink-0 relative px-2">
      <form
        onSubmit={handleSend}
        className="flex items-center gap-3 bg-studio-surface border border-studio-border rounded-2xl px-4 py-3 shadow-studio focus-within:ring-2 focus-within:ring-accent/50 focus-within:ring-offset-2 focus-within:ring-offset-studio-bg transition-all duration-300"
      >
        {/* Attachment "+" Menu Button */}
        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowAttachMenu(!showAttachMenu);
            }}
            className={`w-8 h-8 rounded-xl flex items-center justify-center bg-studio-bg hover:bg-studio-border text-studio-text-secondary hover:text-studio-text-primary border border-studio-border/60 transition-all cursor-pointer ${
              showAttachMenu ? "bg-studio-border/50 text-studio-text-primary" : ""
            }`}
          >
            <Plus size={16} className={`transition-transform duration-200 ${showAttachMenu ? "rotate-45" : ""}`} />
          </button>

          {/* Attachment Dropdown */}
          {showAttachMenu && (
            <div className="absolute bottom-11 left-0 w-48 rounded-xl bg-studio-surface border border-studio-border/60 shadow-2xl p-1 z-50 animate-fade-in">
              <button
                type="button"
                onClick={() => handleAttachOption("YouTube Video Link")}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs text-studio-text-secondary hover:text-studio-text-primary hover:bg-studio-bg transition-colors cursor-pointer"
              >
                <SquarePlay size={14} className="text-accent" />
                Paste YouTube Link
              </button>
              <button
                type="button"
                onClick={() => handleAttachOption("Research Document URL")}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs text-studio-text-secondary hover:text-studio-text-primary hover:bg-studio-bg transition-colors cursor-pointer"
              >
                <Link size={14} className="text-accent" />
                Attach Article Link
              </button>
              <button
                type="button"
                onClick={() => handleAttachOption("Local File Script")}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs text-studio-text-secondary hover:text-studio-text-primary hover:bg-studio-bg transition-colors cursor-pointer"
              >
                <FileUp size={14} className="text-accent" />
                Upload Script Asset
              </button>
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
