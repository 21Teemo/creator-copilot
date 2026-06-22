import { useProjectStore } from "../stores/useProjectStore";

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
