import { afterEach, describe, expect, it, vi } from "vitest";
import { auth0Enabled, getApiBaseUrl, getAuth0Config, secureCookies } from "./env";

afterEach(() => vi.unstubAllEnvs());

describe("admin environment", () => {
  it("uses an explicit API root without a trailing slash", () => {
    vi.stubEnv("DJANGO_API_URL", "https://api.example.test/api/v1/");
    expect(getApiBaseUrl()).toBe("https://api.example.test/api/v1");
  });

  it("fails clearly when production API configuration is absent", () => {
    vi.stubEnv("DJANGO_API_URL", ""); vi.stubEnv("NODE_ENV", "production");
    expect(() => getApiBaseUrl()).toThrow(/DJANGO_API_URL is required/);
  });

  it("requires secure cookies in production", () => {
    vi.stubEnv("ADMIN_SECURE_COOKIES", ""); vi.stubEnv("NODE_ENV", "production");
    expect(secureCookies()).toBe(true);
  });

  it("keeps Auth0 optional for local password-only development", () => {
    vi.stubEnv("AUTH0_ENABLED", "");
    expect(auth0Enabled()).toBe(false);
    expect(getAuth0Config()).toBeNull();
  });

  it("returns complete server-only Auth0 configuration", () => {
    vi.stubEnv("AUTH0_ENABLED", "true");
    vi.stubEnv("AUTH0_DOMAIN", "tenant.example.auth0.com");
    vi.stubEnv("AUTH0_CLIENT_ID", "client-id");
    vi.stubEnv("AUTH0_CLIENT_SECRET", "client-secret");
    vi.stubEnv("AUTH0_SECRET", "session-secret");
    vi.stubEnv("APP_BASE_URL", "https://learn.example.org/");
    vi.stubEnv("AUTH0_AUDIENCE", "https://api.example.org");

    expect(getAuth0Config()).toEqual({
      domain: "tenant.example.auth0.com",
      clientId: "client-id",
      clientSecret: "client-secret",
      secret: "session-secret",
      appBaseUrl: "https://learn.example.org",
      audience: "https://api.example.org",
    });
  });

  it("fails closed when enabled Auth0 configuration is incomplete", () => {
    vi.stubEnv("AUTH0_ENABLED", "true");
    vi.stubEnv("AUTH0_DOMAIN", "");
    vi.stubEnv("AUTH0_CLIENT_ID", "");
    vi.stubEnv("AUTH0_CLIENT_SECRET", "");
    vi.stubEnv("AUTH0_SECRET", "");
    vi.stubEnv("APP_BASE_URL", "");
    vi.stubEnv("AUTH0_AUDIENCE", "");
    expect(() => getAuth0Config()).toThrow(/configuration is incomplete/);
  });

  it("rejects Auth0 domains with schemes and application base URLs with paths", () => {
    vi.stubEnv("AUTH0_ENABLED", "true");
    vi.stubEnv("AUTH0_DOMAIN", "https://tenant.example.auth0.com");
    vi.stubEnv("AUTH0_CLIENT_ID", "client-id");
    vi.stubEnv("AUTH0_CLIENT_SECRET", "client-secret");
    vi.stubEnv("AUTH0_SECRET", "session-secret");
    vi.stubEnv("APP_BASE_URL", "https://platform.example.org/subpath");
    vi.stubEnv("AUTH0_AUDIENCE", "https://api.example.org");
    expect(() => getAuth0Config()).toThrow(/domain must be a hostname/);
    vi.stubEnv("AUTH0_DOMAIN", "tenant.example.auth0.com");
    expect(() => getAuth0Config()).toThrow(/HTTP\(S\) origin/);
  });
});
