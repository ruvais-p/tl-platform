import { forwardResponse } from "@/lib/server/response";
import { djangoRequest } from "@/lib/server/session";
import { isAllowedStaffProxyRequest } from "@/lib/server/staff-proxy-policy";

async function handle(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const resourcePath = path.join("/");
  if (!isAllowedStaffProxyRequest(request.method, resourcePath)) {
    return Response.json(
      { detail: "Unsupported staff route." },
      { status: 404 },
    );
  }

  const query = new URL(request.url).search;
  const hasBody = !["GET", "HEAD"].includes(request.method);
  const contentType = request.headers.get("content-type");
  const headers = contentType ? { "content-type": contentType } : undefined;
  const body = hasBody
    ? contentType?.startsWith("multipart/form-data")
      ? await request.arrayBuffer()
      : await request.text()
    : undefined;

  return forwardResponse(
    await djangoRequest(`${resourcePath}/${query}`, {
      method: request.method,
      body,
      headers,
    }),
  );
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
