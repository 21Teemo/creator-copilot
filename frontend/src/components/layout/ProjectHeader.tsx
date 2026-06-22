"use client";

import React from "react";
import { Sparkles } from "lucide-react";

interface ProjectHeaderProps {
  projectId: string;
}

export default function ProjectHeader({ projectId }: ProjectHeaderProps) {
  // Format projectId to nice display name (e.g. demo-project -> Demo Project)
  const displayName = projectId
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return (
    <header className="h-14 flex items-center justify-between px-2 bg-studio-bg/80 backdrop-blur-sm border-b border-studio-border/20 z-40">
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 text-accent">
          <Sparkles size={16} />
        </div>
        <div>
          <h1 className="text-sm font-bold text-studio-text-primary tracking-tight truncate max-w-[200px] sm:max-w-md">
            {displayName}
          </h1>
          <p className="text-[10px] text-studio-text-secondary leading-none">
            Conversational Creative Studio
          </p>
        </div>
      </div>
    </header>
  );
}
