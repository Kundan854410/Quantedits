/**
 * GET /api/v1/render-jobs/:jobId
 *
 * Returns the current status of a render job so that clients can poll for
 * progress after calling the enqueue endpoint.
 *
 * Authentication: Quantmail JWT (enforced by proxy).
 */

import type { NextRequest } from "next/server";
import { extractAndVerifyJwt } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const log = logger.child({ route: "render-jobs/[jobId]" });

  const jwtPayload = extractAndVerifyJwt(request);
  if (!jwtPayload) {
    return Response.json(
      { error: "Unauthorized", code: "UNAUTHENTICATED" },
      { status: 401 },
    );
  }

  const { jobId } = await params;

  // Single query: fetch job + project userId and the current user in parallel
  const [job, user] = await Promise.all([
    prisma.renderJob.findUnique({
      where: { id: jobId },
      include: { project: { select: { userId: true } } },
    }),
    prisma.user.findUnique({
      where: { quantmailId: jwtPayload.sub },
      select: { id: true },
    }),
  ]);

  if (!job) {
    return Response.json(
      { error: "Render job not found", code: "NOT_FOUND" },
      { status: 404 },
    );
  }

  if (!user || job.project.userId !== user.id) {
    return Response.json(
      { error: "Forbidden", code: "FORBIDDEN" },
      { status: 403 },
    );
  }

  log.info({ jobId, status: job.status }, "Render job status requested");

  return Response.json({
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    outputUrl: job.outputUrl ?? null,
    errorMsg: job.errorMsg ?? null,
    startedAt: job.startedAt?.toISOString() ?? null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(),
  });
}
