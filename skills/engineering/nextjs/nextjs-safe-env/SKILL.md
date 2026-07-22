---
name: nextjs-safe-env
description: Set up, audit, refactor, or debug type-safe environment variables in Next.js applications with split Zod schemas and strict client/server boundaries. Use when creating env modules, adding or renaming variables, reviewing process.env access, fixing missing-env or server-only import errors, configuring env loading for tests and tools, or deciding between build-time and runtime configuration in App Router or Pages Router projects.
---

# Next.js Safe Env

Keep environment access explicit, validated, and on the correct side of the React Server Component boundary. Follow this sequence:

```text
Inspect -> Classify values -> Trace consumers -> Choose validation timing -> Implement -> Verify
```

## Inspect before changing code

1. Resolve the Next.js application root. In a monorepo, work from the package that owns `next.config.*` and its Next.js dependency.
2. Inspect the installed Next.js and Zod versions, package manager, App/Pages Router usage, TypeScript paths, deployment configuration, and existing env modules.
3. Find `process.env` access, env-module imports, `next.config.*` `env` entries, and client boundaries. Treat every module imported beneath a `"use client"` entry as client-reachable even when it lacks its own directive.
4. Inventory variable names and consumers without printing values. Never dump `process.env` or expose the contents of secret-bearing `.env*` files in output.
5. Inspect `.gitignore` and example env files. Keep `.env*` files containing real values untracked.
6. Read [env-patterns.md](references/env-patterns.md) before creating modules, choosing eager versus lazy validation, handling code outside the Next.js runtime, or diagnosing a boundary error.

Preserve the project's established layout and aliases when they already enforce the same boundaries. Do not replace an existing env library or public contract without explicit scope.

## Classify the value before the consumer

Use exposure requirements, not convenience, to choose the variable:

| Requirement | Classification | Access |
| --- | --- | --- |
| Secret, credential, internal URL, or server-only setting | Private server env | Unprefixed name through the server module |
| Safe for every browser user and stable for the built artifact | Public build-time env | `NEXT_PUBLIC_*` through the client module |
| Safe for the browser but must change after `next build` | Public runtime config | Keep on the server and send an explicit allowlisted value |
| Needed only by server code, even if not sensitive | Server env | Keep unprefixed unless browser exposure is intentional |

Apply these consumer rules:

- Import only the client env module from Client Components, browser utilities, client instrumentation, and every dependency reachable from them.
- Use the server env module in Server Components, Route Handlers, Server Actions, data-access code, authentication code, Pages Router server data functions, and API routes.
- Allow server code to use client env only when the value is intentionally public and build-time frozen.
- Pass individual allowlisted values to Client Components. Never pass the server env object, a secret, or an unfiltered configuration object across the boundary.
- Inspect runtime and hosting support before using private env in Middleware, Edge runtime, or version-specific Proxy code.

If a browser consumer requests a secret, move the privileged operation behind a server boundary. Never fix the error by adding `NEXT_PUBLIC_` or removing `import "server-only"`.

## Implement split modules

Create separate client and server entry points. Do not create a barrel file that re-exports both.

### Build the client module

- Include only `NEXT_PUBLIC_*` keys.
- Read every key with a direct static expression such as `process.env.NEXT_PUBLIC_SITE_URL`.
- Parse an explicit object. Do not use `process.env[key]`, destructure or alias `process.env`, or pass the whole object to the client schema; Next.js cannot reliably inline dynamic access.
- Export one parsed `clientEnv` value and its inferred output type.
- Use defaults only for harmless local or product-display values. Remember that every public value is visible and frozen during `next build`.

### Build the server module

- Put `import "server-only"` at the top of the server entry point.
- Include private and server-runtime keys without `NEXT_PUBLIC_`.
- Export the inferred output type and exactly one access style: `serverEnv` for eager validation or `getServerEnv()` for lazy validation.
- Do not give secrets, signing keys, credentials, or production endpoints a permissive default.
- Express production-only requirements with refinements that report field paths. Prefer collecting all actionable configuration issues over aborting at the first issue.
- Avoid importing the `server-only` entry point from Next.js config, ORM config, test bootstrap, or other tools that execute outside the Next.js module environment.

### Choose validation timing from deployment evidence

Use eager `serverEnvSchema.parse(process.env)` when all required server values exist during `next build` and build failure is intentional.

Use a cached `getServerEnv()` when the same artifact is promoted between environments or secrets are injected only at `next start`/request time. Ensure the accessor is called only in a request-time or server-startup path. Do not silently force dynamic rendering merely to accommodate env timing because that changes caching behavior.

When evidence is inconclusive, ask whether production server variables exist during `next build`. Preserve the existing access style during a focused audit or unrelated change.

## Handle Zod and supporting files

- Match the installed Zod major version and existing import style. Do not paste version-specific error or refinement APIs without checking compatibility.
- Keep validation failures actionable by reporting variable names and messages, never values. Zod does not include input values by default; do not opt into input reporting for env parsing.
- Treat TypeScript `ProcessEnv` augmentation as editor assistance only, never as runtime validation.
- Add Zod with the detected package manager only when implementation is authorized and the application does not already provide an accepted validation library.
- Keep `.env.example` limited to names, safe placeholders, and comments that explain required/optional timing. Never copy real secret values.
- Use `@next/env` to reproduce Next.js env-file loading in tests or external tools when needed; load values before importing code that parses them.
- Avoid `next.config.*` `env` for private values because entries there are bundled into client JavaScript.

If the repository already uses `@t3-oss/env-nextjs` or another env system, preserve it unless replacement is explicitly requested. Apply the same exposure, static-access, and runtime-timing rules to the existing system.

## Diagnose without weakening boundaries

- For a `server-only` import error, trace upward to the nearest `"use client"` boundary. Replace the consumer with client env only if the value is intentionally public; otherwise move the operation server-side.
- For a missing public value after deployment, verify the value existed during `next build` and rebuild the artifact. Use a public runtime-config path if post-build changes are required.
- For validation that fails during build but should occur at runtime, confirm the deployment model, then use the lazy server accessor and a request-time/server-startup call site.
- For code that works in Next.js but fails in tests or tooling, load env with `@next/env` before parsing and avoid importing the `server-only` adapter outside Next.js.
- For `undefined` caused by dynamic public lookup, replace it with direct property access.

Do not suppress schema errors, introduce non-null assertions as a substitute for validation, log secrets, or weaken the client/server boundary to make a build pass.

## Verify and report

Run the narrowest available checks first, then expand in proportion to the change:

1. Exercise schema cases for valid input, missing required input, invalid URLs or enums, development defaults, and production-only requirements.
2. Run the relevant type-check, lint, and tests.
3. Run `next build` when env imports, client boundaries, or build-time behavior changed. Supply only safe test values and never echo them.
4. Inspect the final imports and `process.env` access again. Confirm that no private key is client-reachable and no public lookup is dynamic.
5. Report variable names and classifications, client/server consumers, eager/lazy timing, files changed, commands run, failures, and any deployment assumptions. Never report secret values.

