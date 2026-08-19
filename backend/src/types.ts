import type { PublicUser } from "./lib/session.js";

export type AppEnv = {
  Variables: {
    user: PublicUser | null;
    sessionId: string | null;
  };
};
