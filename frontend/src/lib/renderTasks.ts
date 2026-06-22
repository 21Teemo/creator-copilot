// In-memory store for simulated background video renders shared across API routes
export const renderTasks = new Map<string, { progress: number; status: string; format: string }>();
