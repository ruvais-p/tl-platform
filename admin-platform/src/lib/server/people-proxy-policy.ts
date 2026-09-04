const UUID = "[0-9a-fA-F-]{36}";

export function isAllowedPeopleProxyRequest(method: string, path: string) {
  const clean = path.replace(/^\/+|\/+$/g, "");
  if (clean === "users") return method === "GET" || method === "POST";
  if (clean === "users/roles") return method === "GET";
  if (new RegExp(`^users/${UUID}$`).test(clean)) return method === "GET" || method === "PATCH";
  if (new RegExp(`^students/${UUID}/analytics$`).test(clean)) return method === "GET";
  return false;
}
