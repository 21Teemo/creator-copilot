import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ChapterItem {
  timestamp: string;
  title: string;
}

export type PublishStatus = "idle" | "publishing" | "published" | "failed";

interface SeoState {
  titles: string[];
  description: string;
  tags: string[];
  chapters: ChapterItem[];
  publishedUrl: string | null;
  publishStatus: PublishStatus;
  thumbnailUrl: string | null;
  thumbnailPrompt: string;
  setTitles: (titles: string[]) => void;
  setDescription: (description: string) => void;
  setTags: (tags: string[]) => void;
  setChapters: (chapters: ChapterItem[]) => void;
  setPublishedUrl: (url: string | null) => void;
  setPublishStatus: (status: PublishStatus) => void;
  setThumbnailUrl: (url: string | null) => void;
  setThumbnailPrompt: (prompt: string) => void;
  clearSeo: () => void;
}

export const useSeoStore = create<SeoState>()(
  persist(
    (set) => ({
      titles: [],
      description: "",
      tags: [],
      chapters: [],
      publishedUrl: null,
      publishStatus: "idle",
      thumbnailUrl: null,
      thumbnailPrompt: "",
      setTitles: (titles) => set({ titles }),
      setDescription: (description) => set({ description }),
      setTags: (tags) => set({ tags }),
      setChapters: (chapters) => set({ chapters }),
      setPublishedUrl: (publishedUrl) => set({ publishedUrl }),
      setPublishStatus: (publishStatus) => set({ publishStatus }),
      setThumbnailUrl: (thumbnailUrl) => set({ thumbnailUrl }),
      setThumbnailPrompt: (thumbnailPrompt) => set({ thumbnailPrompt }),
      clearSeo: () =>
        set({
          titles: [],
          description: "",
          tags: [],
          chapters: [],
          publishedUrl: null,
          publishStatus: "idle",
          thumbnailUrl: null,
          thumbnailPrompt: "",
        }),
    }),
    {
      name: "studio-seo-store",
    }
  )
);
