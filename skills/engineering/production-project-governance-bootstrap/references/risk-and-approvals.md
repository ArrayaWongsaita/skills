# Risk and Approvals

Use this reference to separate reversible planning from consequential execution.

## Default risk model

| Level | Description | Examples | Required approval |
| --- | --- | --- | --- |
| R0 | Read-only analysis | Inspection, audit, design proposal | None |
| R1 | Local reversible change | Tests, docs, internal refactor | Review before merge |
| R2 | Contract, schema, dependency, or coordinated change | API, migration, package, multi-module feature | Plan approval |
| R3 | Security, payment, production data, critical integration, or infrastructure | Auth, secrets, queues, critical services | Design and diff approval |
| R4 | Destructive or production execution | Delete data, deploy, rotate secret, shift traffic | Explicit human execution or explicit action approval |

Adapt labels to an existing repository model but preserve the escalation behavior.

## Mandatory human gates

Require approval before:

- Destructive database commands or persistent data deletion.
- Production deployment or production traffic changes.
- Secret disclosure or rotation.
- Authentication-boundary changes, authorization weakening, or disabled security controls.
- Breaking public contracts.
- New critical infrastructure or external production services.
- Irreversible migrations.
- Deleting historical governance, incident, lesson, or ADR records.

Approval to design or plan does not authorize execution. Approval for one named action does not authorize adjacent actions.

## Approval record

Record the operation, exact scope, risk, reversibility, evidence reviewed, approver or required role, decision, conditions, and date when the repository convention uses dates. If the approver is unknown, stop at the plan and identify the missing owner.
