/**
 * POST /api/v1/render-jobs
 * Creates a new render job for a project.
 *
 * GET /api/v1/render-jobs
 * Lists render jobs for the authenticated user.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { authenticate, badRequest, validationError } from "@/lib/engagementHttp";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const createRenderJobSchema = z.object({
  projectId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const authed = await authenticate(request);
  if (authed instanceof Response) return authed;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  const parsed = createRenderJobSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues);
  }

  const { projectId } = parsed.data;

  // Verify project exists and belongs to user
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, userId: true },
  });

  if (!project) {
    return Response.json(
      { error: "Project not found", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  if (project.userId !== authed.id) {
    return Response.json(
      { error: "Forbidden", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  // Create the render job
  const renderJob = await prisma.renderJob.create({
    data: {
      projectId,
      status: "QUEUED",
      progress: 0,
    },
  });

  logger.info({ renderJobId: renderJob.id, projectId }, "Render job created");

  // In production, you would enqueue this job to a worker queue
  // For now, we just return the job
  return Response.json({
    id: renderJob.id,
    projectId: renderJob.projectId,
    status: renderJob.status,
    progress: renderJob.progress,
    createdAt: renderJob.createdAt,
  });
}

export async function GET(request: NextRequest) {
  const authed = await authenticate(request);
  if (authed instanceof Response) return authed;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  let whereClause: { projectId?: string; project: { userId: string } } = {
    project: { userId: authed.id },
  };

  if (projectId) {
    whereClause = {
      projectId,
      project: { userId: authed.id },
    };
  }

  const jobs = await prisma.renderJob.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      projectId: true,
      status: true,
      progress: true,
      outputUrl: true,
      errorMsg: true,
      startedAt: true,
      finishedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return Response.json({ jobs });
}
