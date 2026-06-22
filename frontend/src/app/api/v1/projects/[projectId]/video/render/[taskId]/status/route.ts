import { NextRequest, NextResponse } from "next/server";
import { renderTasks } from "@/lib/renderTasks";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; taskId: string }> }
) {
  const { projectId, taskId } = await context.params;

  const task = renderTasks.get(taskId);
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  // Increment progress simulated on each poll
  let nextProgress = task.progress + 25;
  let nextStatus = "in_progress";

  if (nextProgress >= 100) {
    nextProgress = 100;
    nextStatus = "complete";
  }

  // Update in-memory db
  renderTasks.set(taskId, {
    ...task,
    progress: nextProgress,
    status: nextStatus,
  });

  const isShort = task.format === "short";
  
  // Public sample MP4 URLs from Google CDN
  const videoUrl = nextStatus === "complete"
    ? (isShort 
       ? "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4"
       : "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4")
    : null;

  return NextResponse.json({
    status: nextStatus,
    progress: nextProgress,
    videoUrl,
  });
}
