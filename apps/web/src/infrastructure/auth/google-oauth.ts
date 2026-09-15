const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export interface GoogleProfile {
  providerAccountId: string;
  email: string;
  displayName: string;
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function requireConfig(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set");
  }
  return { clientId, clientSecret };
}

export function buildGoogleAuthUrl(state: string, redirectUri: string): string {
  const { clientId } = requireConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

interface GoogleIdTokenClaims {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
}

function decodeJwtPayload(idToken: string): GoogleIdTokenClaims {
  const payload = idToken.split(".")[1];
  if (!payload) throw new Error("Malformed id_token");
  const json = Buffer.from(payload, "base64url").toString("utf8");
  return JSON.parse(json) as GoogleIdTokenClaims;
}

/**
 * Exchanges the authorization code for tokens and returns the user's Google
 * profile. The id_token's signature is not re-verified: it's received directly
 * from Google's token endpoint over TLS in a server-to-server request, which is
 * the trust model for the authorization-code flow.
 */
export async function exchangeGoogleCode(
  code: string,
  redirectUri: string,
): Promise<GoogleProfile> {
  const { clientId, clientSecret } = requireConfig();

  const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${res.status}`);
  }

  const data = (await res.json()) as { id_token?: string };
  if (!data.id_token) throw new Error("No id_token in Google response");

  const claims = decodeJwtPayload(data.id_token);
  if (!claims.email) throw new Error("No email in Google id_token");

  return {
    providerAccountId: claims.sub,
    email: claims.email,
    displayName: claims.name || claims.given_name || claims.email.split("@")[0],
  };
}
