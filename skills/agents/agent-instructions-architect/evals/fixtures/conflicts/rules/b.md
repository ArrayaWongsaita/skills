# Rule B

Every production change must preserve unrelated behavior, include focused verification, and report any check that could not be run.

- Do not run `pnpm test`; use `pnpm test:unit` instead.
