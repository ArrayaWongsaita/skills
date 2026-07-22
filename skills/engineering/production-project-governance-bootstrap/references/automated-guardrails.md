# Automated Guardrails

Use this reference to move recurring rules from advisory prose into enforceable protection.

## Strength hierarchy

For each reusable failure, attempt the strongest practical layer:

```text
Documentation
-> Regression test
-> Static analysis
-> CI gate
-> Runtime guard
-> Monitoring and alert
```

The right layer depends on detectability, cost, false positives, and recovery time. More automation is not automatically better.

## Selection rules

- Use compiler or type-system constraints for representable invariants.
- Use linters or static analysis for reliably detectable source patterns.
- Use regression and contract tests for behavior and compatibility.
- Use migration/schema validators for data-shape and sequencing risk.
- Use secret, dependency, and security scanners when the repository already supports or clearly needs them.
- Use required CI checks for protections that must block merging.
- Use runtime validation for conditions known only at execution time.
- Use monitoring and actionable alerts for production symptoms that cannot be prevented completely.

Do not duplicate formatting rules in prose when the formatter is authoritative. Instructions may state how and when to run the enforcement command.

## Guardrail proposal

Record the failure prevented, evidence, enforcement point, owner, false-positive and bypass policy, verification, rollout, and recovery. Do not install tools or production dependencies without approval.

Scripts bundled with this skill may inspect deterministic facts only. They must not decide architecture, infer business risk, select production strategy, or rewrite files by default.
