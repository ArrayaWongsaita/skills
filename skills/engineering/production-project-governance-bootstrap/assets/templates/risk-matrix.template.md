<!-- Use when task risk and approval expectations are otherwise ambiguous. Do not replace an existing accepted risk model. -->
# Risk and Human Approval Matrix

- Status: Proposed
- Owner: `[risk/governance owner]`

| Level | Description | Examples | Required approval |
| --- | --- | --- | --- |
| R0 | Read-only analysis | Repository inspection | None |
| R1 | Local reversible change | Tests, internal refactor | Review before merge |
| R2 | Contract, schema, dependency, coordinated change | API, migration, package | Plan approval |
| R3 | Security, payment, production data, critical infrastructure | Auth, secrets, queues | Design and diff approval |
| R4 | Destructive or production execution | Delete data, deploy, rotate secret | Explicit human execution or action approval |

Planning is not execution. Require explicit human gates for destructive data operations, production deployment/traffic, secrets, authentication/authorization weakening, disabled security controls, breaking contracts, critical infrastructure/services, irreversible migrations, and deletion of historical governance.
