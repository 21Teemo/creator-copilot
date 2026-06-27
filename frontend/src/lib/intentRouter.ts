import { useProjectStore, ContentFormat } from "../stores/useProjectStore";
import { useStudioStore, StudioView } from "../stores/useStudioStore";
import { useResearchStore, type TrendItem } from "../stores/useResearchStore";
import { useScriptingStore } from "../stores/useScriptingStore";
import { useMediaStore, type VisualReference, type VisualReferenceCategory } from "../stores/useMediaStore";
import { useSeoStore } from "../stores/useSeoStore";
import { apiRequest } from "./api";
import { ActionChipType } from "./quickControls";
export type { ActionChipType };

function formatTrendContext(trend: TrendItem): string {
  const lines = [
    `Title: ${trend.title}`,
    trend.channelName && `Channel: ${trend.channelName}`,
    trend.views && `Views: ${trend.views}`,
    trend.duration && `Duration: ${trend.duration}`,
    trend.description && `Description: ${trend.description}`,
    trend.videoUrl && `Video URL: ${trend.videoUrl}`,
    trend.trendExplanation && `Why it's trending:\n${trend.trendExplanation}`,
    trend.visualAnalysis && `Visual style analysis (from thumbnail):\n${trend.visualAnalysis}`,
  ].filter(Boolean);
  return lines.join("\n");
}

async function ensureTrendVisualAnalysis(
  projectId: string,
  trend: TrendItem
): Promise<TrendItem> {
  if (!trend.thumbnailUrl || trend.visualAnalysis) return trend;
  try {
    const res = await apiRequest(projectId, "/research/trends/visual-analyze", "POST", {
      thumbnailUrl: trend.thumbnailUrl,
      title: trend.title,
      description: trend.description,
    });
    if (res.analysis) {
      const enriched = { ...trend, visualAnalysis: res.analysis };
      useResearchStore.getState().setActiveTrend(enriched);
      return enriched;
    }
  } catch (err) {
    console.warn("Trend thumbnail analysis failed:", err);
  }
  return trend;
}

function buildFactFinderPrompt(userPrompt: string, trendOverride?: TrendItem | null): string {
  const { activeTrend, trends } = useResearchStore.getState();
  const trend =
    trendOverride ??
    activeTrend ??
    trends.find((t) => userPrompt.includes(t.title) || (t.videoUrl && userPrompt.includes(t.videoUrl)));

  if (!trend) return userPrompt;

  const parts = [
    "Research and fact-check this trending video. Build a creator brief grounded in the video and real facts.",
    formatTrendContext(trend),
  ];
  if (userPrompt.trim() && !userPrompt.includes(trend.title) && trend.videoUrl !== userPrompt.trim()) {
    parts.push(`Additional instructions: ${userPrompt}`);
  }
  return parts.join("\n\n");
}

function stripHashtagsAndMentions(text: string): string {
  return text.replace(/#\w+/g, "").replace(/@\w+/g, "").replace(/\s{2,}/g, " ").trim();
}

function extractCreativeAngle(summaryText: string): string {
  const skip =
    /^(title|channel|views|duration|description|video url|creator brief|visual reference|visual style|citations?|this brief)\s*:/i;
  const picks: string[] = [];

  for (const line of summaryText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.includes("===") || /https?:\/\//i.test(trimmed)) continue;
    if (skip.test(trimmed)) continue;
    if (/DEEPSEEK/i.test(trimmed) || /Enable DEEPSEEK/i.test(trimmed)) continue;
    if (trimmed.length > 160) continue;

    if (
      /^(hook focus|pacing|target audience|key takeaway|narrative|tone|visual format)/i.test(trimmed) ||
      picks.length < 4
    ) {
      picks.push(trimmed);
    }
    if (picks.join(" ").length > 350) break;
  }

  return picks.join("\n").slice(0, 400);
}

function isPlaceholderVisualAnalysis(text: string): boolean {
  return !text || /Enable DEEPSEEK/i.test(text) || /Visual reference: thumbnail/i.test(text);
}

function getVisualReferencesPayload(): Pick<VisualReference, "category" | "label" | "imageUrl">[] {
  return useMediaStore.getState().visualReferences.map(({ category, label, imageUrl }) => ({
    category,
    label,
    imageUrl,
  }));
}

function referenceKeywords(): string {
  return useMediaStore
    .getState()
    .visualReferences.map((r) => r.label.trim())
    .filter(Boolean)
    .join(", ");
}

function buildScriptPayload(userPrompt: string, contentFormat: ContentFormat) {
  const { summaries, activeTrend } = useResearchStore.getState();
  const topic =
    stripHashtagsAndMentions(activeTrend?.title || "") ||
    stripHashtagsAndMentions(
      summaries?.summaryText
        ?.split("\n")
        .find((l) => /^hook focus/i.test(l.trim()))?.replace(/^hook focus:\s*/i, "") || ""
    ) ||
    userPrompt.trim().slice(0, 80);

  const creativeAngle = summaries?.summaryText ? extractCreativeAngle(summaries.summaryText) : "";

  const rawVisual = (summaries?.visualAnalysis || activeTrend?.visualAnalysis || "").trim();
  const visualStyleNotes = isPlaceholderVisualAnalysis(rawVisual) ? "" : rawVisual.slice(0, 400);

  const task =
    userPrompt.trim() && !userPrompt.startsWith("Drafting script")
      ? userPrompt
      : "Plan 3-5 scenes. visualPrompt = standalone image search prompt per scene. narrationText = short voiceover line. Do not repeat the research brief.";

  return {
    topic,
    creativeAngle,
    visualStyleNotes,
    visualReferences: getVisualReferencesPayload(),
    contentFormat,
    prompt: task,
  };
}

function sanitizeNarrationText(text: string): string {
  let t = text || "";
  for (const marker of ["TOPIC:", "RESEARCH SUMMARY:", "===", "TASK:", "Creator Brief:"]) {
    const idx = t.indexOf(marker);
    if (idx > 0) t = t.slice(0, idx);
  }
  return t.replace(/https?:\/\/\S+/g, "").replace(/\s{2,}/g, " ").trim();
}

function sanitizeVisualPromptText(text: string): string {
  let t = (text || "").replace(/https?:\/\/\S+/g, "").replace(/#\w+/g, "").trim();
  for (const marker of ["TOPIC:", "RESEARCH SUMMARY", "Creator Brief", "===", "TASK:", "Welcome to this video about"]) {
    const idx = t.indexOf(marker);
    if (idx > 0) t = t.slice(0, idx);
  }
  if (/DEEPSEEK_API|Video URL|Channel:/i.test(t)) return "";
  return t.replace(/\s{2,}/g, " ").trim().slice(0, 220);
}

function sanitizeStoryboardScenes(
  scenes: { sceneNumber: number; visualPrompt: string; narrationText: string }[]
) {
  return scenes.map((scene) => ({
    ...scene,
    visualPrompt: sanitizeVisualPromptText(scene.visualPrompt),
    narrationText: sanitizeNarrationText(scene.narrationText),
  }));
}

export function visualPromptForStockSearch(visualPrompt: string): string {
  const cleaned = visualPrompt
    .replace(/https?:\/\/\S+/g, "")
    .replace(/#\w+/g, "")
    .replace(/@\w+/g, "")
    .trim();
  const firstClause = cleaned.split(/[.!?]/)[0]?.trim() || cleaned;
  const base = firstClause.slice(0, 120) || "cinematic scene";
  const refs = referenceKeywords();
  if (!refs) return base;
  return `${base}, ${refs}`.slice(0, 200);
}

function stockSearchBody(prompt: string) {
  return {
    prompt,
    visualReferences: getVisualReferencesPayload(),
  };
}

export function buildStockSearchRequest(prompt: string) {
  return stockSearchBody(prompt);
}

export function shouldUseAiSceneGeneration(): boolean {
  return useMediaStore
    .getState()
    .visualReferences.some((ref) => Boolean(ref.imageUrl?.trim()));
}

function sceneGenerateBody(prompt: string, sceneNumber?: number) {
  const { contentFormat } = useProjectStore.getState();
  return {
    prompt,
    sceneNumber,
    visualReferences: getVisualReferencesPayload(),
    contentFormat,
  };
}

export function buildSceneGenerateRequest(prompt: string, sceneNumber?: number) {
  return sceneGenerateBody(prompt, sceneNumber);
}

async function fetchSceneImage(
  projectId: string,
  prompt: string,
  sceneNumber: number
): Promise<{ sceneNumber: number; imageUrl: string; visualPrompt: string } | null> {
  const searchPrompt = visualPromptForStockSearch(prompt);

  if (shouldUseAiSceneGeneration()) {
    const res = await apiRequest(projectId, "/generate/scene", "POST", buildSceneGenerateRequest(searchPrompt, sceneNumber));
    if (res?.imageUrl) {
      return {
        sceneNumber,
        imageUrl: res.imageUrl,
        visualPrompt: prompt,
      };
    }
    return null;
  }

  const res = await apiRequest(projectId, "/stock/search", "POST", stockSearchBody(searchPrompt));
  if (res?.[0]?.imageUrl) {
    return {
      sceneNumber,
      imageUrl: res[0].imageUrl,
      visualPrompt: prompt,
    };
  }
  return null;
}

export type StudioAction = ActionChipType | "refine";

/**
 * Parses user input to classify the intended studio action.
 */
export function classifyIntent(prompt: string, activeView: StudioView): StudioAction {
  const p = prompt.toLowerCase();

  // 1. YouTube URL routing helper
  const isYoutubeUrl = p.includes("youtube.com/") || p.includes("youtu.be/");
  if (isYoutubeUrl) {
    if (activeView === "facts") return "fact_finder";
    return "explore_trends";
  }

  // Keywords indicating manual refinement/edits
  const refinementKeywords = [
    "make", "shorter", "darker", "longer", "add", "change", "edit", 
    "rewrite", "replace", "focus", "hook", "regenerate", "more", "refine",
    "modify", "adjust", "improve"
  ];
  
  // If we have content and prompt matches keywords, or if we are on script view and typing naturally
  const isRefine = 
    refinementKeywords.some(keyword => p.includes(keyword)) || 
    (activeView === "script" && p.trim().length > 0 && !p.includes("generate picture") && !p.includes("scene pictures"));

  if (isRefine) return "refine";

  // Category filter routing
  if (p.includes("category: images")) return "scene_pictures";
  if (p.includes("category: videos")) return "scene_videos";
  if (p.includes("category: voices") || p.includes("category: characters") || p.includes("category: avatar")) return "write_script";
  if (p.includes("category: audio")) return "ffmpeg_render";
  if (p.includes("category: uploads")) return "seo_publish";

  // If user is currently on the trends or facts view, keep general queries focused on search.
  // Only transition downstream if they explicitly use high-intent action words.
  if (activeView === "trends") {
    if (p.includes("write script") || p.includes("generate script") || p.includes("draft script")) return "write_script";
    if (p.includes("generate picture") || p.includes("generate image") || p.includes("create scenes")) return "scene_pictures";
    if (p.includes("generate video") || p.includes("create video")) return "scene_videos";
    if (p.includes("render video") || p.includes("compile video") || p.includes("ffmpeg")) return "ffmpeg_render";
    if (p.includes("seo") || p.includes("publish")) return "seo_publish";
    return "explore_trends";
  }

  if (activeView === "facts") {
    if (p.includes("write script") || p.includes("generate script") || p.includes("draft script")) return "write_script";
    if (p.includes("generate picture") || p.includes("generate image") || p.includes("create scenes")) return "scene_pictures";
    if (p.includes("generate video") || p.includes("create video")) return "scene_videos";
    if (p.includes("render video") || p.includes("compile video") || p.includes("ffmpeg")) return "ffmpeg_render";
    if (p.includes("seo") || p.includes("publish")) return "seo_publish";
    return "fact_finder";
  }

  if (p.includes("trend") || p.includes("explore") || p.includes("niche") || p.includes("viral")) {
    return "explore_trends";
  }
  if (p.includes("fact") || p.includes("search") || p.includes("find") || p.includes("summar")) {
    return "fact_finder";
  }
  if (p.includes("script") || p.includes("write") || p.includes("draft") || p.includes("storyboard") || p.includes("voice") || p.includes("character") || p.includes("avatar")) {
    return "write_script";
  }
  if (p.includes("picture") || p.includes("image") || p.includes("photo")) {
    return "scene_pictures";
  }
  if (p.includes("video clip") || p.includes("scene video") || (p.includes("video") && !p.includes("render") && !p.includes("compile"))) {
    return "scene_videos";
  }
  if (p.includes("render") || p.includes("compile") || p.includes("ffmpeg") || p.includes("audio")) {
    return "ffmpeg_render";
  }
  if (p.includes("seo") || p.includes("title") || p.includes("publish") || p.includes("upload")) {
    return "seo_publish";
  }

  // Context-aware mapping: if user is on a content-authoring view, route general prompts to that view's action.
  // ffmpeg and seo are excluded — they are output/status views where freeform text input
  // should be routed by content keywords or the store-based fallback, not kept on the same view.
  const viewToActionMap: Record<string, StudioAction> = {
    trends: "explore_trends",
    facts: "fact_finder",
    script: "write_script",
    scenes: "scene_pictures",
    video: "scene_videos",
  };

  if (activeView && viewToActionMap[activeView]) {
    return viewToActionMap[activeView];
  }

  // Fallback map based on what steps are missing
  const hasTrends = useResearchStore.getState().trends.length > 0;
  const hasScript = !!useScriptingStore.getState().script;
  const hasScenes = useMediaStore.getState().sceneImages.length > 0;
  const hasSceneVideos = useMediaStore.getState().sceneVideos.length > 0;

  if (!hasTrends) return "explore_trends";
  if (!hasScript) return "write_script";
  if (!hasScenes) return "scene_pictures";
  if (!hasSceneVideos) return "scene_videos";
  return "ffmpeg_render";
}

/**
 * Central router dispatcher for studio commands.
 */
export async function dispatchStudioAction(
  projectId: string,
  action: StudioAction,
  payload: { prompt?: string } = {}
) {
  const studioStore = useStudioStore.getState();
  const projectStore = useProjectStore.getState();
  
  const prompt = payload.prompt || "";
  const currentFormat = projectStore.contentFormat;

  // Log prompt in history
  if (prompt) {
    studioStore.addPromptHistory(prompt, action, currentFormat);
  }

  // Handle Refinement Routing
  if (action === "refine") {
    const currentView = studioStore.activeView;
    studioStore.setLoading(true);

    try {
      if (currentView === "script") {
        const scriptingStore = useScriptingStore.getState();
        const res = await apiRequest(projectId, "/scripting/storyboard", "POST", {
          prompt: `Refine current script with instructions: ${prompt}. Current script: ${scriptingStore.script}`,
        });
        scriptingStore.setScript(res.script);
        scriptingStore.setStoryboard(res.storyboard);
        projectStore.setLastGeneratedFormat(currentFormat);
      } else if (currentView === "facts") {
        const researchStore = useResearchStore.getState();
        const res = await apiRequest(projectId, "/research/summarize", "POST", {
          prompt: `Refine this research brief. Instructions: ${prompt}\n\nCurrent brief:\n${researchStore.summaries?.summaryText ?? ""}`,
        });
        researchStore.setSummaries(res);
        projectStore.setLastGeneratedFormat(currentFormat);
      } else if (currentView === "trends") {
        const researchStore = useResearchStore.getState();
        const endpoint = currentFormat === "short" ? "/research/trends/short" : "/research/trends/long";
        const res = await apiRequest(projectId, endpoint, "POST", {
          prompt: `Filter trends: ${prompt}`,
        });
        researchStore.setTrends(res);
        projectStore.setLastGeneratedFormat(currentFormat);
      } else if (currentView === "scenes") {
        const mediaStore = useMediaStore.getState();
        const res = await apiRequest(projectId, "/stock/search", "POST", stockSearchBody(`Refine keyframe scenes: ${prompt}`));
        mediaStore.setSceneImages(res);
        projectStore.setLastGeneratedFormat(currentFormat);
      } else if (currentView === "video") {
        const mediaStore = useMediaStore.getState();
        const res = await apiRequest(projectId, "/stock/videos", "POST", {
          prompt: `Refine scene video clips: ${prompt}`,
        });
        mediaStore.setSceneVideos(res);
        projectStore.setLastGeneratedFormat(currentFormat);
      }
    } catch (err) {
      console.error("Refinement Action Failed:", err);
    } finally {
      studioStore.setLoading(false);
    }
    return;
  }

  // Standard Pipeline Routing
  studioStore.setLoading(true);
  
  try {
    switch (action) {
      case "explore_trends": {
        studioStore.setActiveView("trends");
        const endpoint = currentFormat === "short" ? "/research/trends/short" : "/research/trends/long";
        const res = await apiRequest(projectId, endpoint, "POST", { prompt });
        useResearchStore.getState().setTrends(res);
        projectStore.setLastGeneratedFormat(currentFormat);
        break;
      }
      case "fact_finder": {
        studioStore.setActiveView("facts");
        const researchState = useResearchStore.getState();
        let trend =
          researchState.activeTrend ??
          researchState.trends.find(
            (t) => prompt.includes(t.title) || (t.videoUrl && prompt.includes(t.videoUrl))
          );
        if (trend?.thumbnailUrl) {
          trend = await ensureTrendVisualAnalysis(projectId, trend);
        }
        const factPrompt = buildFactFinderPrompt(prompt, trend);
        const brief = await apiRequest(projectId, "/research/summarize", "POST", {
          prompt: factPrompt,
          thumbnailUrl: trend?.thumbnailUrl,
          videoTitle: trend?.title,
          videoDescription: trend?.description,
          visualAnalysis: trend?.visualAnalysis,
        });
        useResearchStore.getState().setSummaries({
          ...brief,
          thumbnailUrl: trend?.thumbnailUrl,
          visualAnalysis: brief.visualAnalysis || trend?.visualAnalysis,
        });
        projectStore.setLastGeneratedFormat(currentFormat);
        break;
      }
      case "write_script": {
        studioStore.setActiveView("script");
        const activeTrend = useResearchStore.getState().activeTrend;
        if (activeTrend?.thumbnailUrl && !activeTrend.visualAnalysis) {
          await ensureTrendVisualAnalysis(projectId, activeTrend);
        }
        const scriptPayload = buildScriptPayload(prompt, currentFormat);
        const res = await apiRequest(projectId, "/scripting/storyboard", "POST", scriptPayload);
        const storyboard = sanitizeStoryboardScenes(res.storyboard || []);
        const script =
          sanitizeNarrationText(res.script) ||
          storyboard.map((s) => s.narrationText).filter(Boolean).join("\n\n");
        useScriptingStore.getState().setStoryboard(storyboard);
        useScriptingStore.getState().setOutline(res.outline || []);
        useScriptingStore.getState().setScript(script);
        projectStore.setLastGeneratedFormat(currentFormat);
        break;
      }
      case "scene_pictures": {
        studioStore.setActiveView("scenes");
        const scriptingStore = useScriptingStore.getState();
        const storyboard = scriptingStore.storyboard;

        if (storyboard.length > 0) {
          const sceneImages: { sceneNumber: number; imageUrl: string; visualPrompt: string }[] = [];
          for (const scene of storyboard) {
            const image = await fetchSceneImage(projectId, scene.visualPrompt, scene.sceneNumber);
            if (image) sceneImages.push(image);
          }
          useMediaStore.getState().setSceneImages(sceneImages);
        } else {
          const searchPrompt = visualPromptForStockSearch(prompt);
          if (shouldUseAiSceneGeneration()) {
            const res = await apiRequest(
              projectId,
              "/generate/scene",
              "POST",
              buildSceneGenerateRequest(searchPrompt, 1)
            );
            if (res?.imageUrl) {
              useMediaStore.getState().setSceneImages([
                {
                  sceneNumber: 1,
                  imageUrl: res.imageUrl,
                  visualPrompt: prompt,
                },
              ]);
            }
          } else {
            const res = await apiRequest(projectId, "/stock/search", "POST", stockSearchBody(searchPrompt));
            useMediaStore.getState().setSceneImages(res);
          }
        }
        projectStore.setLastGeneratedFormat(currentFormat);
        break;
      }
      case "scene_videos": {
        studioStore.setActiveView("video");
        const res = await apiRequest(projectId, "/stock/videos", "POST", { prompt });
        useMediaStore.getState().setSceneVideos(res);
        projectStore.setLastGeneratedFormat(currentFormat);
        break;
      }
      case "ffmpeg_render": {
        studioStore.setActiveView("ffmpeg");
        const mediaStore = useMediaStore.getState();
        const scriptingStore = useScriptingStore.getState();
        
        // Start Render
        const renderRes = await apiRequest(projectId, "/video/render", "POST", {
          storyboard: scriptingStore.storyboard,
          sceneImages: mediaStore.sceneImages,
          sceneVideos: mediaStore.sceneVideos,
        });
        mediaStore.setTaskId(renderRes.taskId);
        mediaStore.setRenderStatus("pending");
        mediaStore.setRenderProgress(0);
        
        // Spawn Dynamic Polling
        pollVideoRenderStatus(projectId, renderRes.taskId);
        break;
      }
      case "seo_publish": {
        studioStore.setActiveView("seo");
        const scriptingStore = useScriptingStore.getState();
        const titleRes = await apiRequest(projectId, "/seo/titles", "POST", { script: scriptingStore.script });
        const metaRes = await apiRequest(projectId, "/seo/metadata", "POST", { script: scriptingStore.script });
        
        useSeoStore.getState().setTitles(titleRes.titles);
        useSeoStore.getState().setDescription(metaRes.description);
        useSeoStore.getState().setTags(metaRes.tags);
        useSeoStore.getState().setChapters(metaRes.chapters || []);
        projectStore.setLastGeneratedFormat(currentFormat);
        break;
      }
    }
  } catch (err) {
    console.error("Studio Action Failed:", err);
  } finally {
    // Only turn off loading directly if it is not video rendering (which does its own progress overlay)
    if (action !== "ffmpeg_render") {
      studioStore.setLoading(false);
    }
  }
}

/**
 * Background polling loop for video renders.
 */
function pollVideoRenderStatus(projectId: string, taskId: string) {
  const mediaStore = useMediaStore.getState();
  const studioStore = useStudioStore.getState();
  
  // Ensure visual loader starts
  studioStore.setLoading(false);

  const intervalId = setInterval(async () => {
    try {
      const res = await apiRequest(projectId, `/video/render/${taskId}/status`, "GET");
      
      mediaStore.setRenderStatus(res.status);
      mediaStore.setRenderProgress(res.progress);
      
      if (res.status === "complete" || res.status === "failed") {
        clearInterval(intervalId);
        mediaStore.setVideoUrl(res.videoUrl || null);
        
        if (res.status === "complete") {
          // Sync last generated format on completion
          useProjectStore.getState().setLastGeneratedFormat(useProjectStore.getState().contentFormat);
        }
      }
    } catch (err) {
      console.error("Error polling render status:", err);
      clearInterval(intervalId);
      mediaStore.setRenderStatus("failed");
    }
  }, 2000);
}
