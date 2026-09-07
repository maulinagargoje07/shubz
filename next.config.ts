import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-auth", "pg"],

  /**
   * Where the build output goes.
   *
   * `next build` and `next dev` both use `.next` by default, so a production
   * build run while a dev server is up overwrites the chunks that server is
   * still serving. The visible symptom is the stylesheet 404ing and every page
   * rendering as unstyled HTML until `.next` is deleted — the markup is fine,
   * the CSS simply is not there any more.
   *
   * Overriding this lets a verification build write somewhere else and leave
   * the dev server's cache alone. Unset — which is how Railway builds — it is
   * exactly the default, so deploys are unaffected.
   */
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
