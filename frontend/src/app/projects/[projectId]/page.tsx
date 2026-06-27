"use client";

import React, { use, useState, useEffect } from "react";
import { redirect } from "next/navigation";
import StudioShell from "@/components/layout/StudioShell";
import ProjectHeader from "@/components/layout/ProjectHeader";
import ContentFormatToggle from "@/components/layout/ContentFormatToggle";
import OutputFrame from "@/components/studio/OutputFrame";
import QuickControls from "@/components/studio/QuickControls";
import PromptInputBar from "@/components/studio/PromptInputBar";

import { useStudioStore } from "@/stores/useStudioStore";
import { useResearchStore } from "@/stores/useResearchStore";
import { useScriptingStore } from "@/stores/useScriptingStore";
import { useMediaStore } from "@/stores/useMediaStore";
import { useSeoStore } from "@/stores/useSeoStore";
import { classifyIntent, dispatchStudioAction, ActionChipType } from "@/lib/intentRouter";
import { apiRequest } from "@/lib/api";

interface ProjectPageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export default function ProjectPage({ params }: ProjectPageProps) {
  // Unwrap Next.js dynamic path parameters
  const { projectId } = use(params);

  if (projectId === "demo-project") {
    redirect("/projects/creator-copilot");
  }

  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    const legacyKeys = [
      "studio-project-store",
      "studio-shell-store",
      "studio-research-store",
      "studio-scripting-store",
      "studio-media-store",
      "studio-seo-store",
    ];
    legacyKeys.forEach((key) => localStorage.removeItem(key));
    setMounted(true);
  }, []);

  const activeView = useStudioStore((state) => state.activeView);
  const loading = useStudioStore((state) => state.loading);

  const { setPublishStatus, setPublishedUrl } = useSeoStore();

  // 1. Handle submission from Chat Input Bar
  const handlePromptSubmit = async (promptText: string) => {
    const action = classifyIntent(promptText, activeView);
    await dispatchStudioAction(projectId, action, { prompt: promptText });
  };

  // 2. Handle click from floating Quick Control Action Chips
  const handleQuickActionClick = async (action: ActionChipType) => {
    // Interactive research steps: switch view immediately and let user input query/search
    if (action === "explore_trends") {
      useStudioStore.getState().setActiveView("trends");
      return;
    }
    if (action === "fact_finder") {
      useStudioStore.getState().setActiveView("facts");
      return;
    }

    // Check if data already exists in the stores for this action.
    // If it does, we just switch the view, rather than triggering a re-generation.
    let hasData = false;
    
    if (action === "write_script") {
      hasData = !!useScriptingStore.getState().script;
      if (hasData) useStudioStore.getState().setActiveView("script");
    } else if (action === "scene_pictures") {
      hasData = useMediaStore.getState().sceneImages.length > 0;
      if (hasData) useStudioStore.getState().setActiveView("scenes");
    } else if (action === "scene_videos") {
      hasData = useMediaStore.getState().sceneVideos.length > 0;
      if (hasData) useStudioStore.getState().setActiveView("video");
    } else if (action === "ffmpeg_render") {
      hasData = !!useMediaStore.getState().videoUrl;
      if (hasData) useStudioStore.getState().setActiveView("ffmpeg");
    } else if (action === "seo_publish") {
      hasData = useSeoStore.getState().titles.length > 0;
      if (hasData) useStudioStore.getState().setActiveView("seo");
    }

    if (hasData) return;

    // Generate context descriptions for natural flows
    const initialPrompts: Record<ActionChipType, string> = {
      explore_trends: "Scanning for trending topics in my niche...",
      fact_finder: "Performing fact-checking and compiling article briefs...",
      write_script: "Drafting script narration and storyboard outlines...",
      scene_pictures: "Sourcing stock assets and generating thumbnails...",
      scene_videos: "Generating custom video clips for each scene...",
      ffmpeg_render: "Rendering final video compilation using FFmpeg render CLI...",
      seo_publish: "Optimizing metadata titles and chapter timestamps...",
    };

    await dispatchStudioAction(projectId, action, { prompt: initialPrompts[action] });
  };

  // 3. Handle selection of suggested welcome chips or stale banners
  const handleSuggestedPromptSelect = async (promptText: string, action: string) => {
    await dispatchStudioAction(projectId, action as any, { prompt: promptText });
  };

  // 4. Handle YouTube draft uploads
  const handlePublishToYouTube = async () => {
    setPublishStatus("publishing");
    try {
      const res = await apiRequest(projectId, "/publish", "POST");
      setPublishStatus("published");
      setPublishedUrl(res.publishedUrl);
    } catch (e) {
      console.error("YouTube publish failed:", e);
      setPublishStatus("failed");
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#0F0F12] flex flex-col p-6 items-center justify-center">
        {/* Sleek skeleton loader representing the studio shell */}
        <div className="w-full max-w-7xl flex flex-col gap-4 animate-pulse flex-1">
          <div className="h-14 flex items-center justify-between px-2 border-b border-[#27272A]/20">
            <div className="h-4 bg-[#27272A] rounded w-32" />
            <div className="h-8 bg-[#27272A] rounded-full w-40" />
          </div>
          <div className="flex-1 bg-[#1A1A1F] rounded-[1.5rem] border border-[#27272A] flex items-center justify-center">
            <div className="w-12 h-12 rounded-2xl bg-[#27272A]" />
          </div>
          <div className="h-12 bg-[#27272A] rounded-2xl w-full max-w-3xl mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <StudioShell>
      {/* 1. Thin header containing Content Format Switch */}
      <ProjectHeader projectId={projectId} />

      {/* 2. Main Hero Output Canvas */}
      <div className="flex-1 flex flex-col min-h-0">
        <OutputFrame
          projectId={projectId}
          onSelectPrompt={handleSuggestedPromptSelect}
          onPublish={handlePublishToYouTube}
        />
      </div>

      {/* Content Format Toggle moved above QuickControls */}
      <div className="flex justify-center shrink-0 py-1.5 z-20">
        <ContentFormatToggle />
      </div>

      {/* 3. Floating Quick Control pill (shows context-driven actions) */}
      <QuickControls onActionClick={handleQuickActionClick} />

      {/* 4. Conversational Chat Prompt Input */}
      <PromptInputBar projectId={projectId} onSubmit={handlePromptSubmit} disabled={loading} />
    </StudioShell>
  );
}
