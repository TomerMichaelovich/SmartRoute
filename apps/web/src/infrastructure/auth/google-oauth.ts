const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_TOKENINFO_ENDPOINT = "https://oauth2.googleapis.com/tokeninfo";

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

/**
 * The mobile app signs in with Google via the native Google Sign-In SDK
 * (@react-native-google-signin/google-signin) - not a browser/redirect flow.
 * Google blocks the old custom-URI-scheme browser redirect for newly created
 * Android/iOS OAuth clients ("Custom URI scheme is not enabled for your
 * Android client"), so the native SDK is the only supported path today. It
 * resolves the Android/iOS client automatically from the app's package name +
 * signing certificate (registered in Google Cloud Console - GOOGLE_ANDROID_
 * CLIENT_ID / GOOGLE_IOS_CLIENT_ID document that registration but aren't
 * referenced in code), and is configured with `webClientId` = the *web*
 * GOOGLE_CLIENT_ID so it also mints a server-verifiable idToken - meaning the
 * token's `aud` is the web client id, already an allowed audience below.
 *
 * Hands the resulting id_token to the backend. Unlike exchangeGoogleCode -
 * where the id_token comes straight from Google over a server-to-server TLS
 * call - this one arrives via the client, so it's verified explicitly:
 * signature + expiry via Google's tokeninfo endpoint, and `aud` checked
 * against every OAuth client ID configured for this app.
 */
export function isGoogleNativeSignInConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID ||
      process.env.GOOGLE_ANDROID_CLIENT_ID ||
      process.env.GOOGLE_IOS_CLIENT_ID,
  );
}

function allowedGoogleAudiences(): string[] {
  return [
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_ANDROID_CLIENT_ID,
    process.env.GOOGLE_IOS_CLIENT_ID,
  ].filter((id): id is string => Boolean(id));
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  const res = await fetch(`${GOOGLE_TOKENINFO_ENDPOINT}?id_token=${encodeURIComponent(idToken)}`);
  if (!res.ok) throw new Error("Google tokeninfo lookup failed");

  const claims = (await res.json()) as GoogleIdTokenClaims & { aud?: string; iss?: string };
  const allowed = allowedGoogleAudiences();
  if (!claims.aud || !allowed.includes(claims.aud)) {
    throw new Error("Google id_token has an unrecognized audience");
  }
  if (claims.iss !== "accounts.google.com" && claims.iss !== "https://accounts.google.com") {
    throw new Error("Google id_token has an unrecognized issuer");
  }
  if (!claims.email || claims.email_verified === false) {
    throw new Error("Google id_token has no verified email");
  }

  return {
    providerAccountId: claims.sub,
    email: claims.email,
    displayName: claims.name || claims.given_name || claims.email.split("@")[0],
  };
}
