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
function parseApiErrorBody(errText: string): string | null {
  if (!errText || errText === "Internal Server Error") return null;
  try {
    const json = JSON.parse(errText) as { detail?: string | { msg?: string }[] };
    if (typeof json.detail === "string") return json.detail;
    if (Array.isArray(json.detail)) {
      return json.detail
        .map((item) => (typeof item === "string" ? item : item?.msg))
        .filter(Boolean)
        .join("; ");
    }
  } catch {
    // not JSON
  }
  return errText.trim() || null;
}

function backendUnavailableHint(status: number, path: string, errText: string): string {
  const proxyDead =
    !errText?.trim() ||
    errText === "Internal Server Error" ||
    errText.trimStart().startsWith("<!DOCTYPE") ||
    /ECONNREFUSED|connect ECONNREFUSED/i.test(errText);

  if (!proxyDead && status !== 502 && status !== 503) {
    return "";
  }

  if (path.includes("/video/render")) {
    return `Cannot start render — media service (:8003), Redis, or Celery worker may be down. Run ./dev.sh start and verify redis-cli ping → PONG.`;
  }
  if (path.includes("/generate/")) {
    return `Media service unavailable on port 8003. Run ./dev.sh start from the repo root.`;
  }
  if (path.includes("/scripting/")) {
    return `Scripting service unavailable on port 8002. Run ./dev.sh start from the repo root.`;
  }
  return `Backend unavailable (${status}). Run ./dev.sh start from the repo root — scripting :8002, media :8003.`;
}

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
    const parsed = parseApiErrorBody(errText);
    const proxyHint = backendUnavailableHint(response.status, path, errText);
    const backendUnavailable = Boolean(proxyHint);
    const hint = backendUnavailable
      ? proxyHint
      : parsed || errText || response.statusText;
    throw new Error(`API Error [${response.status}]: ${hint}`);
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
