import { learnerDjangoRequest } from "@/lib/server/learner-session";
import { isAllowedLearnerRequest } from "@/lib/server/learner-proxy-policy";
import { forwardResponse } from "@/lib/server/response";

async function handle(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const resourcePath = path.join("/");
  if (!isAllowedLearnerRequest(request.method, resourcePath)) {
    return Response.json({ detail: "Unsupported learner route." }, { status: 404 });
  }
  const query = new URL(request.url).search;
  const contentType = request.headers.get("content-type");
  const headers = contentType ? { "content-type": contentType } : undefined;
  const body = ["GET", "HEAD"].includes(request.method)
    ? undefined
    : contentType?.startsWith("multipart/form-data")
      ? await request.arrayBuffer()
      : await request.text();
  return forwardResponse(await learnerDjangoRequest(`${resourcePath}/${query}`, {
    method: request.method,
    body,
    headers,
  }));
}

export const GET = handle;
export const POST = handle;
