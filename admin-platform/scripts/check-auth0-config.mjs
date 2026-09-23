import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

if ((process.env.AUTH0_ENABLED || "").trim().toLowerCase() !== "true") {
  process.exit(0);
}

const required = [
  "AUTH0_DOMAIN",
  "AUTH0_CLIENT_ID",
  "AUTH0_CLIENT_SECRET",
  "AUTH0_SECRET",
  "APP_BASE_URL",
  "AUTH0_AUDIENCE",
];
const missing = required.filter((name) => !(process.env[name] || "").trim());
if (missing.length) {
  console.error(`Error: Auth0 is enabled for Next.js but these variables are missing: ${missing.join(", ")}.`);
  console.error("See docs/AUTH0.md and admin-platform/.env.example.");
  process.exit(1);
}

if (!/^[a-z0-9.-]+(?::\d+)?$/i.test(process.env.AUTH0_DOMAIN)) {
  console.error("Error: AUTH0_DOMAIN must be a hostname without a scheme or path.");
  process.exit(1);
}

try {
  const baseUrl = new URL(process.env.APP_BASE_URL);
  if (
    !["http:", "https:"].includes(baseUrl.protocol)
    || baseUrl.username
    || baseUrl.password
    || baseUrl.pathname !== "/"
    || baseUrl.search
    || baseUrl.hash
  ) throw new Error();
} catch {
  console.error("Error: APP_BASE_URL must be an absolute HTTP(S) origin when Auth0 is enabled.");
  process.exit(1);
}
