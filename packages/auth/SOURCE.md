# Source

Vendored copy of the product owner's `@cloud-np/auth` package.

- Source path: `/home/cloud-np/Programming/my-repos/core/packages/auth`
- Source package: `@cloud-np/auth@0.1.8`
- Upstream git commit: `8bc0317cc916704a403dd4a7beebfab4518946b8` (`core` working tree had unrelated
  modifications when this copy was taken; the auth package files were unchanged).
- Files copied: `src/index.ts`, `src/client.ts`, `src/models.ts`, `src/otp.ts`. One type-only
  patch in `src/index.ts` (`copy[0]!`) keeps the file compiling under this repo's
  `noUncheckedIndexedAccess`; behaviour is unchanged.
- `src/astro.ts` was not copied: this repo does not use Astro and the file only exports Astro
  middleware glue.

The mezenta reference app depends on the published `@cloud-np/auth@^0.1.8` package and overlays
the sibling `../core` checkout locally with `scripts/core-link.mjs`. That registry is the private
GitHub Packages registry, and `../core` is read-only for this task, so this repo vendors the same
version as a workspace package (`workspace:*`) instead. `packages/auth` is otherwise unmodified;
update it by re-copying the files above from `core/packages/auth` at a newer commit and updating
this file.
