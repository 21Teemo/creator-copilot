import { useResearchStore } from "../stores/useResearchStore";
import { useScriptingStore } from "../stores/useScriptingStore";
import { useMediaStore } from "../stores/useMediaStore";

export type ActionChipType =
  | "explore_trends"
  | "fact_finder"
  | "write_script"
  | "scene_pictures"
  | "scene_videos"
  | "ffmpeg_render"
  | "seo_publish";

export interface QuickControlItem {
  id: ActionChipType;
  label: string;
  recommended: boolean;
}

export function getSuggestedActions(): QuickControlItem[] {
  const hasTrends = useResearchStore.getState().trends.length > 0;
  const hasFacts = useResearchStore.getState().summaries !== null;
  const hasScript = !!useScriptingStore.getState().script;
  const hasScenes = useMediaStore.getState().sceneImages.length > 0;
  const hasSceneVideos = useMediaStore.getState().sceneVideos.length > 0;
  const hasVideo = !!useMediaStore.getState().videoUrl;

  // Define actions with standard labels
  const actions: Record<ActionChipType, { id: ActionChipType; label: string; recommended: boolean }> = {
    explore_trends: { id: "explore_trends", label: "Explore Trends", recommended: false },
    fact_finder: { id: "fact_finder", label: "Fact Finder", recommended: false },
    write_script: { id: "write_script", label: "Write Script", recommended: false },
    scene_pictures: { id: "scene_pictures", label: "Scene Pictures", recommended: false },
    scene_videos: { id: "scene_videos", label: "Scene Videos", recommended: false },
    ffmpeg_render: { id: "ffmpeg_render", label: "FFmpeg Render", recommended: false },
    seo_publish: { id: "seo_publish", label: "SEO & Publish", recommended: false },
  };

  // Always return all 7 pipeline stages in order
  const list = [
    actions.explore_trends,
    actions.fact_finder,
    actions.write_script,
    actions.scene_pictures,
    actions.scene_videos,
    actions.ffmpeg_render,
    actions.seo_publish,
  ];

  // Highlight the next logical incomplete step
  if (!hasTrends) {
    actions.explore_trends.recommended = true;
  } else if (!hasFacts) {
    actions.fact_finder.recommended = true;
  } else if (!hasScript) {
    actions.write_script.recommended = true;
  } else if (!hasScenes) {
    actions.scene_pictures.recommended = true;
  } else if (!hasSceneVideos) {
    actions.scene_videos.recommended = true;
  } else if (!hasVideo) {
    actions.ffmpeg_render.recommended = true;
  } else {
    actions.seo_publish.recommended = true;
  }

  return list;
}

export function showAddAudioToggle(): boolean {
  return useMediaStore.getState().sceneImages.length > 0;
}
