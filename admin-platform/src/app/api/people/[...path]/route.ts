import { forwardResponse } from "@/lib/server/response";
import { djangoRequest } from "@/lib/server/session";
import { isAllowedPeopleProxyRequest } from "@/lib/server/people-proxy-policy";

async function handle(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const resourcePath = path.join("/");
  if (!isAllowedPeopleProxyRequest(request.method, resourcePath)) {
    return Response.json({ detail: "Unsupported people route." }, { status: 404 });
  }
  const body = ["GET", "HEAD"].includes(request.method) ? undefined : await request.text();
  return forwardResponse(await djangoRequest(`${resourcePath}/`, { method: request.method, body }));
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
