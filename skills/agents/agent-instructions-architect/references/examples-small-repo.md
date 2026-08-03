# Example: small repository

```text
AGENTS.md
.agents/rules/testing-quality.md
```

Keep purpose, core commands, and universal constraints in `AGENTS.md`. Route
to detailed testing guidance with an explicit condition:

```markdown
## Read when relevant

- [Testing quality](.agents/rules/testing-quality.md): read before changing
  tests or production behavior covered by tests.
```

The linked file is inventory until a runtime expands it or the agent follows
the routing instruction. Measure it accordingly.
