import { useProjectStore } from "../stores/useProjectStore";

export type FileCategory = "images" | "videos" | "audio" | "voices" | "uploads";

export interface FileCategoryRule {
  category: FileCategory;
  mimePrefixes: string[];
  extensions: string[];
}

export const FILE_CATEGORY_RULES: FileCategoryRule[] = [
  {
    category: "images",
    mimePrefixes: ["image/"],
    extensions: ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "avif"],
  },
  {
    category: "videos",
    mimePrefixes: ["video/"],
    extensions: ["mp4", "webm", "mov", "mkv", "m4v"],
  },
  {
    category: "audio",
    mimePrefixes: ["audio/"],
    extensions: ["mp3", "wav", "m4a", "aac", "flac", "opus"],
  },
  {
    category: "voices",
    mimePrefixes: ["text/", "application/json"],
    extensions: ["txt", "json", "md", "rtf", "csv"],
  },
];

export function resolveFileCategory(mimeType: string, fileName: string): FileCategory {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  const mime = mimeType.toLowerCase();

  for (const rule of FILE_CATEGORY_RULES) {
    if (rule.mimePrefixes.some((prefix) => mime.startsWith(prefix))) {
      return rule.category;
    }
    if (extension && rule.extensions.includes(extension)) {
      return rule.category;
    }
  }

  return "uploads";
}

/**
 * Custom API client that maps requests to Next.js route handlers
 * and automatically injects project settings.
 */
export async function apiRequest(projectId: string, path: string, method = "POST", body: any = {}) {
  const { contentFormat, addAudioEnabled } = useProjectStore.getState();

  const payload = {
    ...body,
    contentFormat,
    includeAudio: addAudioEnabled,
  };

  const response = await fetch(`/api/v1/projects/${projectId}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: method === "GET" || method === "DELETE" ? undefined : JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API Error [${response.status}]: ${errText || response.statusText}`);
  }

  return response.json();
}

export async function uploadMediaAsset(projectId: string, file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`/api/v1/projects/${projectId}/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Upload failed [${response.status}]: ${errText || response.statusText}`);
  }

  const data = (await response.json()) as { url: string };
  return data.url;
}
