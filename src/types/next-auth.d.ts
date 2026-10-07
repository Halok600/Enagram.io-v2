import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    accessTokenExpiresAt?: number;
    error?: "MissingRefreshToken" | "RefreshAccessTokenError";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpiresAt?: number;
    error?: "MissingRefreshToken" | "RefreshAccessTokenError";
  }
}
