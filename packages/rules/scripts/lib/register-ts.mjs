/**
 * `node --import ./scripts/lib/register-ts.mjs <script>` — run the TypeScript sources directly.
 *
 * Node (>= 22.18) strips types natively; the sources use bundler-style extensionless relative
 * imports, so this synchronous resolve hook retries a relative specifier that does not resolve
 * as written as `<specifier>.ts` and `<specifier>/index.ts`. Used by the registry-based coverage
 * scripts; no build step and no dependencies.
 */
import fs from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
      const file = fileURLToPath(new URL(specifier, context.parentURL));
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        for (const candidate of [`${file}.ts`, `${file}/index.ts`]) {
          if (fs.existsSync(candidate)) return nextResolve(pathToFileURL(candidate).href, context);
        }
      }
    }
    return nextResolve(specifier, context);
  },
});
