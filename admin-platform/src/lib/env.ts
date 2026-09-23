const DEFAULT_API_URL = "http://127.0.0.1:8000/api/v1";

export type Auth0Config = {
  domain: string;
  clientId: string;
  clientSecret: string;
  secret: string;
  appBaseUrl: string;
  audience: string;
};

export function getApiBaseUrl() {
  const value = process.env.DJANGO_API_URL?.trim();
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error("DJANGO_API_URL is required in production (for example https://api.example.com/api/v1). ");
  }
  return (value || DEFAULT_API_URL).replace(/\/$/, "");
}

export function secureCookies() {
  return process.env.ADMIN_SECURE_COOKIES === "true" || process.env.NODE_ENV === "production";
}

export function auth0Enabled() {
  return process.env.AUTH0_ENABLED?.trim().toLowerCase() === "true";
}

export function getAuth0Config(): Auth0Config | null {
  if (!auth0Enabled()) return null;

  const values = {
    domain: process.env.AUTH0_DOMAIN?.trim() || "",
    clientId: process.env.AUTH0_CLIENT_ID?.trim() || "",
    clientSecret: process.env.AUTH0_CLIENT_SECRET?.trim() || "",
    secret: process.env.AUTH0_SECRET?.trim() || "",
    appBaseUrl: process.env.APP_BASE_URL?.trim().replace(/\/$/, "") || "",
    audience: process.env.AUTH0_AUDIENCE?.trim() || "",
  };
  const missing = Object.entries(values)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length) {
    throw new Error(`Auth0 is enabled but configuration is incomplete: ${missing.join(", ")}.`);
  }
  if (!/^[a-z0-9.-]+(?::\d+)?$/i.test(values.domain)) {
    throw new Error("Auth0 domain must be a hostname without a scheme or path.");
  }
  try {
    const baseUrl = new URL(values.appBaseUrl);
    if (
      !["http:", "https:"].includes(baseUrl.protocol)
      || baseUrl.username
      || baseUrl.password
      || baseUrl.pathname !== "/"
      || baseUrl.search
      || baseUrl.hash
    ) throw new Error();
  } catch {
    throw new Error("Auth0 appBaseUrl must be an absolute HTTP(S) origin.");
  }
  return values;
}
