import { useProjectStore, ContentFormat } from "../stores/useProjectStore";
import { useStudioStore, StudioView } from "../stores/useStudioStore";
import { useResearchStore } from "../stores/useResearchStore";
import { useScriptingStore } from "../stores/useScriptingStore";
import { useMediaStore } from "../stores/useMediaStore";
import { useSeoStore } from "../stores/useSeoStore";
import { apiRequest } from "./api";
import { ActionChipType } from "./quickControls";
export type { ActionChipType };

export type StudioAction = ActionChipType | "refine";

/**
 * Parses user input to classify the intended studio action.
 */
export function classifyIntent(prompt: string, activeView: StudioView): StudioAction {
  const p = prompt.toLowerCase();

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

  if (p.includes("trend") || p.includes("explore") || p.includes("niche") || p.includes("viral")) {
    return "explore_trends";
  }
  if (p.includes("fact") || p.includes("search") || p.includes("find") || p.includes("summar")) {
    return "fact_finder";
  }
  if (p.includes("script") || p.includes("write") || p.includes("draft") || p.includes("storyboard")) {
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
          prompt: `Refine summary brief. Instructions: ${prompt}`,
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
        const res = await apiRequest(projectId, "/stock/search", "POST", {
          prompt: `Refine keyframe scenes: ${prompt}`,
        });
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
        const brief = await apiRequest(projectId, "/research/summarize", "POST", { prompt });
        useResearchStore.getState().setSummaries(brief);
        projectStore.setLastGeneratedFormat(currentFormat);
        break;
      }
      case "write_script": {
        studioStore.setActiveView("script");
        const res = await apiRequest(projectId, "/scripting/storyboard", "POST", { prompt });
        useScriptingStore.getState().setScript(res.script);
        useScriptingStore.getState().setOutline(res.outline || []);
        useScriptingStore.getState().setStoryboard(res.storyboard || []);
        projectStore.setLastGeneratedFormat(currentFormat);
        break;
      }
      case "scene_pictures": {
        studioStore.setActiveView("scenes");
        const res = await apiRequest(projectId, "/stock/search", "POST", { prompt });
        useMediaStore.getState().setSceneImages(res);
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
        
        // Start Render
        const renderRes = await apiRequest(projectId, "/video/render", "POST");
        mediaStore.setTaskId(renderRes.taskId);
        mediaStore.setRenderStatus("pending");
        mediaStore.setRenderProgress(0);
        
        // Spawn Dynamic Polling
        pollVideoRenderStatus(projectId, renderRes.taskId);
        break;
      }
      case "seo_publish": {
        studioStore.setActiveView("seo");
        const titleRes = await apiRequest(projectId, "/seo/titles", "POST");
        const metaRes = await apiRequest(projectId, "/seo/metadata", "POST");
        
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
