import { NextRequest, NextResponse } from "next/server";
import { renderTasks } from "@/lib/renderTasks";

export async function POST(request: NextRequest) {
  let body: any = {};
  try {
    body = await request.json();
  } catch (e) {}

  const format = body.contentFormat || "long";

  const taskId = "task_" + Math.random().toString(36).substring(2, 9);
  renderTasks.set(taskId, { progress: 0, status: "pending", format });

  await new Promise((resolve) => setTimeout(resolve, 600));

  return NextResponse.json({ taskId });
}
