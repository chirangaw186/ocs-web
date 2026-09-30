import { CognitoJwtVerifier } from "aws-jwt-verify";
import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import type { Config } from "../../config.js";
import type { Db } from "../../db/client.js";
import { staff } from "../../db/schema.js";
import { HttpError } from "../../lib/errors.js";

export type StaffRole = (typeof staff.$inferSelect)["role"];
export type StaffUser = typeof staff.$inferSelect;
export type AppEnv = { Variables: { staff: StaffUser } };

let verifier: ReturnType<typeof CognitoJwtVerifier.create> | undefined;

/** Verifies the Cognito access token, then loads the staff record (role comes from our DB). */
export function requireStaff(db: Db, config: Config, roles?: StaffRole[]) {
  return createMiddleware<AppEnv>(async (c, next) => {
    let user: StaffUser | undefined;
    if (config.devAuth) {
      const email = c.req.header("x-dev-staff-email");
      if (email) [user] = await db.select().from(staff).where(eq(staff.email, email));
    } else {
      if (!config.cognito) throw new HttpError(500, "Cognito is not configured");
      verifier ??= CognitoJwtVerifier.create({
        userPoolId: config.cognito.userPoolId, clientId: config.cognito.clientId, tokenUse: "access",
      });
      const token = c.req.header("authorization")?.replace(/^Bearer /i, "");
      if (!token) throw new HttpError(401, "Missing token", "unauthenticated");
      const payload = await verifier.verify(token).catch(() => {
        throw new HttpError(401, "Invalid token", "unauthenticated");
      });
      [user] = await db.select().from(staff).where(eq(staff.cognitoSub, payload.sub));
    }
    if (!user || !user.active) throw new HttpError(403, "Not a staff member", "forbidden");
    if (roles && user.role !== "OWNER" && !roles.includes(user.role)) throw new HttpError(403, "Insufficient role", "forbidden");
    c.set("staff", user);
    await next();
  });
}
