import { spawnSync } from "node:child_process";
import { createSerwistRoute } from "@serwist/turbopack";

// Change à chaque commit pour renouveler la page hors ligne en cache ; sans git (build distant), un identifiant aléatoire.
const revision = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() || crypto.randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  additionalPrecacheEntries: [{ url: "/~offline", revision }],
  swSrc: "src/app/sw.ts",
  useNativeEsbuild: true,
});
