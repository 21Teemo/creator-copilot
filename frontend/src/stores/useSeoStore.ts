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
  setTitles: (titles: string[]) => void;
  setDescription: (description: string) => void;
  setTags: (tags: string[]) => void;
  setChapters: (chapters: ChapterItem[]) => void;
  setPublishedUrl: (url: string | null) => void;
  setPublishStatus: (status: PublishStatus) => void;
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
      setTitles: (titles) => set({ titles }),
      setDescription: (description) => set({ description }),
      setTags: (tags) => set({ tags }),
      setChapters: (chapters) => set({ chapters }),
      setPublishedUrl: (publishedUrl) => set({ publishedUrl }),
      setPublishStatus: (publishStatus) => set({ publishStatus }),
      clearSeo: () =>
        set({
          titles: [],
          description: "",
          tags: [],
          chapters: [],
          publishedUrl: null,
          publishStatus: "idle",
        }),
    }),
    {
      name: "studio-seo-store",
    }
  )
);
