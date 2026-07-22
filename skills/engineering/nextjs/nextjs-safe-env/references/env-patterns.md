# Next.js Environment Patterns

Use this reference when implementing or debugging a Next.js env boundary. Adapt names, paths, package-manager commands, and validation APIs to the inspected project.

## Contents

- [Decision matrix](#decision-matrix)
- [Client module](#client-module)
- [Server schema](#server-schema)
- [Eager server access](#eager-server-access)
- [Lazy runtime server access](#lazy-runtime-server-access)
- [Consumer routing](#consumer-routing)
- [Public runtime configuration](#public-runtime-configuration)
- [Tests and tools outside Next.js](#tests-and-tools-outside-nextjs)
- [Example env files](#example-env-files)
- [Troubleshooting](#troubleshooting)
- [Primary sources](#primary-sources)

## Decision matrix

Classify the value before choosing its file or prefix:

| Question | Yes | No |
| --- | --- | --- |
| Must browser JavaScript read it? | Continue to the next question | Keep it unprefixed in server env |
| Is it safe for every user to inspect? | Continue to the next question | Redesign behind a server operation |
| May it be fixed when the artifact is built? | Use `NEXT_PUBLIC_*` and client env | Expose an allowlisted runtime value from the server |

Then classify the consumer:

| Consumer | Permitted env access |
| --- | --- |
| Client Component or client-reachable dependency | Client env only |
| Server Component | Server env; client env only for intentionally public build-time values |
| Route Handler or API route | Server env |
| Server Action or data-access layer | Server env |
| `getServerSideProps`, `getStaticProps`, `getStaticPaths` | Server env, with timing matched to request/build execution |
| Client instrumentation | Client env only |
| Server instrumentation | Server env, conditioned on runtime where necessary |
| Middleware/Proxy | Server env only after checking Next.js version, runtime, and host support |
| `next.config.*`, ORM config, test bootstrap | Load separately; do not import the `server-only` adapter |

The `NEXT_PUBLIC_` prefix is an exposure decision, not a way to repair an import error.

## Client module

Use direct static property access so Next.js can inline each public variable. Parse an explicit object rather than `process.env`.

```ts
import { z } from "zod";

const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().trim().min(1).default("DevNest"),
  NEXT_PUBLIC_SITE_URL: z
    .string()
    .url()
    .default("http://localhost:3000"),
});

export const clientEnv = clientEnvSchema.parse({
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
```

Do not replace the explicit object with these patterns:

```ts
const key = "NEXT_PUBLIC_SITE_URL";
process.env[key]; // Not statically inlined.

const env = process.env;
env.NEXT_PUBLIC_SITE_URL; // Not statically inlined.

clientEnvSchema.parse(process.env); // Hides static access from the client bundler.
```

Do not put private keys in the client schema. A public variable is discoverable in the browser bundle even when its name contains `SECRET`.

## Server schema

Keep private keys unprefixed. Use safe local defaults sparingly and collect production issues so one validation run reports every actionable failure.

```ts
import { z } from "zod";

export const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]),
    API_BASE_URL: z.string().url().default("http://localhost:3001"),
    BROWSER_SAFE_RUNTIME_API_BASE_URL: z.string().url().optional(),
    AUTH_SECRET: z.string().min(1).optional(),
    SIGNUP_STUDENT_CODE: z.string().min(1).optional(),
    SIGNUP_ADMIN_CODE: z.string().min(1).optional(),
    SIGNUP_SUPER_ADMIN_CODE: z.string().min(1).optional(),
  })
  .refine(
    (env) => env.NODE_ENV !== "production" || Boolean(env.AUTH_SECRET),
    {
      message: "AUTH_SECRET is required in production",
      path: ["AUTH_SECRET"],
    },
  )
  .refine(
    (env) =>
      env.NODE_ENV !== "production" ||
      env.API_BASE_URL !== "http://localhost:3001",
    {
      message: "API_BASE_URL must not use localhost in production",
      path: ["API_BASE_URL"],
    },
  );

export type ServerEnv = z.infer<typeof serverEnvSchema>;
```

Keep a shared schema module free of `process.env` reads and runtime side effects. Guard the application accessor that reads values with `import "server-only"`. This allows selected external tooling to reuse validation without importing the guarded Next.js entry point; do not export the server schema through a client-facing barrel.

Keep aliases such as `SIGNUP_*` and `REGISTER_*` only when both names are part of a real compatibility contract. Otherwise choose one canonical name and migrate callers deliberately.

Refinements validate the output at runtime but do not necessarily narrow an optional TypeScript property for consumers. When a consumer needs a statically required production-only type, model separate schemas or provide a focused accessor instead of scattering non-null assertions.

## Eager server access

Choose eager validation when required server variables are present during build and failing `next build` is desired.

```ts
import "server-only";

import { serverEnvSchema } from "./server-schema";

export const serverEnv = serverEnvSchema.parse(process.env);
export type { ServerEnv } from "./server-schema";
```

An explicit input object is also valid and can make the accepted keys easier to audit:

```ts
export const serverEnv = serverEnvSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  API_BASE_URL: process.env.API_BASE_URL,
  BROWSER_SAFE_RUNTIME_API_BASE_URL:
    process.env.BROWSER_SAFE_RUNTIME_API_BASE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  SIGNUP_STUDENT_CODE: process.env.SIGNUP_STUDENT_CODE,
  SIGNUP_ADMIN_CODE: process.env.SIGNUP_ADMIN_CODE,
  SIGNUP_SUPER_ADMIN_CODE: process.env.SIGNUP_SUPER_ADMIN_CODE,
});
```

Do not eagerly import this entry point from a static route when its required values are intentionally unavailable during build.

## Lazy runtime server access

Choose lazy validation when a built artifact is promoted across environments or secrets arrive only when the server starts.

```ts
import "server-only";

import { serverEnvSchema, type ServerEnv } from "./server-schema";

let cachedServerEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  cachedServerEnv ??= serverEnvSchema.parse(process.env);
  return cachedServerEnv;
}
```

Call `getServerEnv()` only from server execution paths. The accessor prevents parsing merely because the module was imported, but it cannot make build-time code read values that exist only at runtime.

For an App Router Server Component that must read a runtime value, confirm that the route is intentionally request-time rendered. Dynamic APIs or `connection()` can opt a route into dynamic rendering, but adding them changes caching and must be an explicit application decision.

Do not use a cache when tests intentionally mutate `process.env` in one process unless the test isolates modules or the implementation exposes a test-only reset through an established testing pattern.

## Consumer routing

### App Router

Use server env in:

- Server Components
- Route Handlers
- Server Actions
- authentication and authorization modules
- database and internal API clients
- server instrumentation

Use client env in:

- Client Components
- browser hooks and utilities
- client instrumentation
- client-reachable third-party initialization

A file does not need its own `"use client"` directive to be client code. If a Client Component imports it, its dependencies join the client graph.

### Pages Router

Use server env inside `getServerSideProps`, API routes, and server-only helpers. `getStaticProps` and `getStaticPaths` execute at build time, so their required values must exist during the build. Page component code can be bundled for the browser; do not read private env in the render module or shared helpers.

When a page component and `getServerSideProps` share one module, keep the render path on client env and load the guarded server adapter inside the server function:

```tsx
import { clientEnv } from "@/env/client";

export default function Page() {
  return <a href={clientEnv.NEXT_PUBLIC_SITE_URL}>Home</a>;
}

export async function getServerSideProps() {
  const { getServerEnv } = await import("@/env/server");
  const env = getServerEnv();

  // Perform server-only work with env and return safe props.
  return { props: {} };
}
```

Prefer a dedicated server data-loader when the server work is substantial. Never return `env` or `DATABASE_URL` in props.

### Boundary repair

Given a Client Component that needs authenticated data:

1. Keep the credential in server env.
2. Move the privileged fetch to a Server Component, Route Handler, or Server Action as appropriate.
3. Return only the data the client is authorized to see.
4. Keep `import "server-only"` in the privileged module.

Never repair the boundary by exposing the credential or deleting the guard.

## Public runtime configuration

`NEXT_PUBLIC_*` values are frozen during `next build`. When browser-visible configuration must vary after build, keep the source value server-side and construct a small allowlisted payload.

```tsx
import { getServerEnv } from "@/env/server";
import { connection } from "next/server";

import { ClientShell } from "./client-shell";

export default async function Page() {
  // Make this request-time behavior only after accepting the caching change.
  await connection();

  const env = getServerEnv();
  const publicConfig = {
    apiBaseUrl: env.BROWSER_SAFE_RUNTIME_API_BASE_URL,
  };

  return <ClientShell config={publicConfig} />;
}
```

Before passing the value, verify that it is genuinely public. Do not serialize the full env object. For client-side navigation that must refresh configuration independently, expose a focused Route Handler with an explicit response schema and suitable cache policy.

## Tests and tools outside Next.js

Next.js loads `.env*` files inside its runtime. For Jest, Vitest, ORM tools, scripts, or config files that run separately, load them with `@next/env` before importing modules that parse env:

```ts
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
```

Avoid importing a module marked with `import "server-only"` into a generic Node test or config environment. Either:

- validate a focused config schema in that tool,
- import a pure schema module after loading env, or
- use the test runner's established server-only mock when application modules must be tested.

For tests, cover:

- valid development input,
- safe defaults,
- missing and malformed required values,
- every production-only invariant,
- eager versus lazy timing when the distinction matters,
- absence of secrets from client-reachable modules.

Do not snapshot raw env input or validation errors configured to include input values.

## Example env files

Keep real values in ignored local/deployment configuration. Commit only safe examples when the repository convention permits it:

```dotenv
# Public and frozen during next build
NEXT_PUBLIC_APP_NAME=DevNest
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Server-only
API_BASE_URL=http://localhost:3001
AUTH_SECRET=
SIGNUP_STUDENT_CODE=
SIGNUP_ADMIN_CODE=
SIGNUP_SUPER_ADMIN_CODE=
```

Use obvious empty or non-secret placeholders. Do not place a real-looking credential in an example because it can be copied into production or trigger secret scanners.

Keep env files at the Next.js project root rather than inside `src/`. Preserve the repository's ignore rules for `.env*.local` and other secret-bearing variants.

## Troubleshooting

### A server-only module is imported from a Client Component

Trace imports from the reported module to the nearest client boundary. Decide whether the client truly needs a public value:

- If yes, add only that safe key to the client schema with a static `NEXT_PUBLIC_*` access.
- If no, move the operation to the server and return an authorized result.

Keep the server-only marker.

### A public variable is undefined in the browser

Verify:

1. The name starts with `NEXT_PUBLIC_`.
2. Source code uses `process.env.EXACT_NAME` directly.
3. The value was present during `next build`.
4. The artifact was rebuilt after the value changed.

### Production build fails because a runtime secret is missing

Determine whether the secret should exist during build:

- If yes, fix the build environment.
- If no, use lazy validation and ensure the first access occurs at server startup or request time.

Do not add a fake production default.

### Env works in Next.js but not in a test or ORM command

Load env with `@next/env` before parsing. Resolve the project directory correctly in a monorepo. Do not import the `server-only` entry point into unsupported tooling.

### Multiple validation issues are hidden

Remove unnecessary fatal/abort behavior from independent checks. Report all missing or invalid production fields in one run unless a later check cannot execute safely.

## Primary sources

- [Next.js environment variables](https://nextjs.org/docs/app/guides/environment-variables)
- [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [Next.js data security](https://nextjs.org/docs/app/guides/data-security)
- [Next.js `next.config.js` `env` option](https://nextjs.org/docs/pages/api-reference/config/next-config-js/env)
- [Zod schemas and refinements](https://zod.dev/api)
- [Zod error handling and formatting](https://zod.dev/error-formatting)
