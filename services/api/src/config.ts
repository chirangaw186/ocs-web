import { SSMClient, GetParametersCommand } from "@aws-sdk/client-ssm";

export interface Config {
  stage: string;
  databaseUrl: string;
  allowedOrigins: string[];
  publicApiUrl: string;          // used for PayHere notify_url
  storefrontUrl: string;         // used for PayHere return/cancel URLs
  defaultLocationCode: string;
  storefrontDeployHookUrl?: string;
  payhere: { merchantId: string; merchantSecret: string; sandbox: boolean };
  cognito?: { userPoolId: string; clientId: string };
  devAuth: boolean;              // local development only: trust x-dev-staff-email header
}

const env = (k: string, fallback?: string) => {
  const v = process.env[k] ?? fallback;
  if (v === undefined) throw new Error(`Missing env var ${k}`);
  return v;
};

/**
 * Secrets live in SSM Parameter Store (SecureString, free tier) and are fetched once per
 * Lambda cold start. Locally, plain env vars are used instead.
 */
async function loadSsmSecrets() {
  const names = {
    DATABASE_URL: process.env.DATABASE_URL_PARAM,
    PAYHERE_MERCHANT_SECRET: process.env.PAYHERE_MERCHANT_SECRET_PARAM,
    DATABASE_DIRECT_URL: process.env.DATABASE_DIRECT_URL_PARAM,
    STOREFRONT_DEPLOY_HOOK_URL: process.env.STOREFRONT_DEPLOY_HOOK_URL_PARAM,
  };
  const wanted = Object.entries(names).filter(([k, p]) => p && !process.env[k]) as [string, string][];
  if (wanted.length === 0) return;
  const out = await new SSMClient({}).send(
    new GetParametersCommand({ Names: wanted.map(([, p]) => p), WithDecryption: true }),
  );
  for (const [key, param] of wanted) {
    const value = out.Parameters?.find((p) => p.Name === param)?.Value;
    if (!value) throw new Error(`SSM parameter ${param} not found`);
    if (value !== "CHANGE_ME") process.env[key] = value; // placeholder = not configured yet
  }
}

let cached: Config | undefined;
export async function loadConfig(): Promise<Config> {
  if (cached) return cached;
  await loadSsmSecrets();
  const stage = env("STAGE", "local");
  const devAuth = process.env.DEV_AUTH === "1";
  if (devAuth && stage === "prod") throw new Error("DEV_AUTH must never be enabled in prod");
  cached = {
    stage,
    databaseUrl: env("DATABASE_URL"),
    allowedOrigins: env("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173").split(","),
    publicApiUrl: env("PUBLIC_API_URL", "http://localhost:8787"),
    storefrontUrl: env("STOREFRONT_URL", "http://localhost:3000"),
    defaultLocationCode: env("DEFAULT_LOCATION_CODE", "HOME"),
    storefrontDeployHookUrl: process.env.STOREFRONT_DEPLOY_HOOK_URL || undefined,
    payhere: {
      merchantId: env("PAYHERE_MERCHANT_ID", ""),
      merchantSecret: env("PAYHERE_MERCHANT_SECRET", ""),
      sandbox: env("PAYHERE_SANDBOX", "1") === "1",
    },
    cognito: process.env.COGNITO_USER_POOL_ID
      ? { userPoolId: env("COGNITO_USER_POOL_ID"), clientId: env("COGNITO_CLIENT_ID") }
      : undefined,
    devAuth,
  };
  return cached;
}
