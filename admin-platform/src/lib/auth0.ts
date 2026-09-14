import "server-only";

import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { getAuth0Config } from "@/lib/env";

const config = getAuth0Config();

export const auth0 = config
  ? new Auth0Client({
      domain: config.domain,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      secret: config.secret,
      appBaseUrl: config.appBaseUrl,
      authorizationParameters: {
        audience: config.audience,
        scope: "openid profile email offline_access",
      },
      logoutStrategy: "auto",
      includeIdTokenHintInOIDCLogoutUrl: true,
    })
  : null;

export const auth0Audience = config?.audience ?? null;
