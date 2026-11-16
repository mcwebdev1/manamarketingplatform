import { bindings, defineConfig, defineWorker } from "cf/config";
import { createWorkersResponseStoreSelfContainedConfig } from "@vinext/cloudflare/cache/config";

const cache = await createWorkersResponseStoreSelfContainedConfig({
  worker: "manamarketingplatform",
  bucket: "manamarketingplatform-response-store-cache-bodies",
});

export default defineConfig({
  accountId: "61353fbd22b4221c3ae82a2e8aabb09a",
  worker: defineWorker({
    ...cache,
    name: "manamarketingplatform",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-11-09",
    compatibilityFlags: ["nodejs_compat"],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ...cache.env,
      ASSETS: bindings.assets(),
    },
  }),
});
