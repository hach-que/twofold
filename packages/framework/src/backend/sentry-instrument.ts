// Load instrument.server.ts very early if it exists.
import { createJiti } from "jiti";
import { existsSync } from "node:fs";
import { join } from "node:path";
import * as Sentry from "@sentry/node";
if (globalThis.__instrumented__ === undefined) {
  let jiti = createJiti(import.meta.url, {
    debug: false,
    moduleCache: false,
    fsCache: false,
  });
  let appConfigPath = join(process.cwd(), "config", "application.ts");
  if (existsSync(appConfigPath)) {
    let configMod: any = await jiti.import(appConfigPath);
    let appConfig = configMod.default ?? {};
    if (appConfig.sentryOptions) {
      Sentry.init(appConfig.sentryOptions);
    }
  }
  globalThis.__instrumented__ = true;
}
