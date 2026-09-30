import { UserManager, WebStorageStateStore } from "oidc-client-ts";

const env = import.meta.env;
export const devEmail: string | undefined = env.VITE_DEV_STAFF_EMAIL;

/** Cognito managed login (authorization code + PKCE). */
export const userManager = env.VITE_COGNITO_CLIENT_ID
  ? new UserManager({
      authority: env.VITE_COGNITO_AUTHORITY,
      client_id: env.VITE_COGNITO_CLIENT_ID,
      redirect_uri: `${window.location.origin}/callback`,
      post_logout_redirect_uri: window.location.origin,
      response_type: "code",
      scope: "openid email",
      userStore: new WebStorageStateStore({ store: window.sessionStorage }),
    })
  : undefined;

export async function authHeaders(): Promise<Record<string, string>> {
  if (devEmail) return { "x-dev-staff-email": devEmail };
  const user = await userManager?.getUser();
  if (!user || user.expired) {
    await userManager?.signinRedirect();
    throw new Error("Redirecting to login");
  }
  return { authorization: `Bearer ${user.access_token}` };
}

export async function logout() {
  if (!userManager) return;
  await userManager.removeUser();
  // Cognito's logout endpoint (managed login) clears the hosted session too.
  window.location.href = `${env.VITE_COGNITO_DOMAIN}/logout?client_id=${env.VITE_COGNITO_CLIENT_ID}&logout_uri=${encodeURIComponent(window.location.origin)}`;
}
