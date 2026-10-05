import type { NextConfig } from "next";

// The e2e dev server builds into its own folder, so it can run next to `npm run dev`.
const distDir = process.env.TODO_CAT_DIST_DIR;

const nextConfig: NextConfig = {
  distDir: distDir || ".next",
  // Next adds its dist dir's type globs to the tsconfig it uses; give it a throwaway one
  // instead of the committed tsconfig.json (playwright.config.ts writes it).
  typescript: distDir ? { tsconfigPath: `${distDir}.tsconfig.json` } : {},
};

export default nextConfig;
