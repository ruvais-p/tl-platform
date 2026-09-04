import { learnerDjangoRequest } from "@/lib/server/learner-session";
import { forwardResponse } from "@/lib/server/response";

export async function GET() {
  return forwardResponse(await learnerDjangoRequest("auth/me/"));
}
