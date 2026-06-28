import { create } from "zustand";

export type VisualReferenceCategory = "environment" | "character" | "gadget";

export interface VisualReference {
  id: string;
  category: VisualReferenceCategory;
  label: string;
  imageUrl: string;
}

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
  visualReferences: VisualReference[];
  videoUrl: string | null;
  taskId: string | null;
  renderStatus: RenderStatus;
  renderProgress: number;
  renderStep: string | null;
  renderElapsedSec: number | null;
  setSceneImages: (images: SceneImage[]) => void;
  setSceneVideos: (videos: SceneVideo[]) => void;
  addVisualReference: (ref: Omit<VisualReference, "id">) => void;
  updateVisualReference: (id: string, updates: Partial<Pick<VisualReference, "label" | "imageUrl">>) => void;
  removeVisualReference: (id: string) => void;
  setVideoUrl: (url: string | null) => void;
  setTaskId: (taskId: string | null) => void;
  setRenderStatus: (status: RenderStatus) => void;
  setRenderProgress: (progress: number) => void;
  setRenderStep: (step: string | null) => void;
  setRenderElapsedSec: (seconds: number | null) => void;
  clearMedia: () => void;
}

export const useMediaStore = create<MediaState>()((set) => ({
  sceneImages: [],
  sceneVideos: [],
  visualReferences: [],
  videoUrl: null,
  taskId: null,
  renderStatus: "idle",
  renderProgress: 0,
  renderStep: null,
  renderElapsedSec: null,
  setSceneImages: (sceneImages) => set({ sceneImages }),
  setSceneVideos: (sceneVideos) => set({ sceneVideos }),
  addVisualReference: (ref) =>
    set((state) => ({
      visualReferences: [
        ...state.visualReferences,
        { ...ref, id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` },
      ],
    })),
  updateVisualReference: (id, updates) =>
    set((state) => ({
      visualReferences: state.visualReferences.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    })),
  removeVisualReference: (id) =>
    set((state) => ({
      visualReferences: state.visualReferences.filter((r) => r.id !== id),
    })),
  setVideoUrl: (videoUrl) => set({ videoUrl }),
  setTaskId: (taskId) => set({ taskId }),
  setRenderStatus: (renderStatus) => set({ renderStatus }),
  setRenderProgress: (renderProgress) => set({ renderProgress }),
  setRenderStep: (renderStep) => set({ renderStep }),
  setRenderElapsedSec: (renderElapsedSec) => set({ renderElapsedSec }),
  clearMedia: () =>
    set({
      sceneImages: [],
      sceneVideos: [],
      videoUrl: null,
      taskId: null,
      renderStatus: "idle",
      renderProgress: 0,
      renderStep: null,
      renderElapsedSec: null,
    }),
}));
