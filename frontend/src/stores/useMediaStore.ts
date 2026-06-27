import { create } from "zustand";

export interface SceneImage {
  sceneNumber: number;
  imageUrl: string;
  visualPrompt: string;
}

export interface SceneVideo {
  sceneNumber: number;
  videoUrl: string;
  visualPrompt: string;
}

export type RenderStatus = "idle" | "pending" | "in_progress" | "complete" | "failed";

interface MediaState {
  sceneImages: SceneImage[];
  sceneVideos: SceneVideo[];
  videoUrl: string | null;
  taskId: string | null;
  renderStatus: RenderStatus;
  renderProgress: number;
  setSceneImages: (images: SceneImage[]) => void;
  setSceneVideos: (videos: SceneVideo[]) => void;
  setVideoUrl: (url: string | null) => void;
  setTaskId: (taskId: string | null) => void;
  setRenderStatus: (status: RenderStatus) => void;
  setRenderProgress: (progress: number) => void;
  clearMedia: () => void;
}

export const useMediaStore = create<MediaState>()((set) => ({
  sceneImages: [],
  sceneVideos: [],
  videoUrl: null,
  taskId: null,
  renderStatus: "idle",
  renderProgress: 0,
  setSceneImages: (sceneImages) => set({ sceneImages }),
  setSceneVideos: (sceneVideos) => set({ sceneVideos }),
  setVideoUrl: (videoUrl) => set({ videoUrl }),
  setTaskId: (taskId) => set({ taskId }),
  setRenderStatus: (renderStatus) => set({ renderStatus }),
  setRenderProgress: (renderProgress) => set({ renderProgress }),
  clearMedia: () =>
    set({
      sceneImages: [],
      sceneVideos: [],
      videoUrl: null,
      taskId: null,
      renderStatus: "idle",
      renderProgress: 0,
    }),
}));
