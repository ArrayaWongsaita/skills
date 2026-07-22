<!-- Use when test layers, commands, ownership, or risk-based gates need coordination. Do not restate a simple existing test command list. -->
# Test Strategy

- Status: Proposed
- Owner: `[quality/system owner]`
- Scope: `[repository/system]`

## Risks and observable seams

Map user/system risks to public interfaces or stable seams. Prefer behavior checks over private implementation assertions.

| Risk or contract | Test layer | Fixture/environment | Verified command | CI gate | Owner |
| --- | --- | --- | --- | --- | --- |
| `[risk]` | `[unit/integration/e2e/contract/etc.]` | `[requirements]` | `[command or Unknown]` | `[required/advisory/none]` | `[owner]` |

## Modifier-specific requirements

Define only applicable checks for security, database, migration, public contract, performance, reliability, integration, infrastructure, and cross-service modifiers.

## Failure and maintenance policy

Record flake handling, test-data ownership, environment limits, evidence retention, and who may approve exceptions. Do not invent unavailable environments or commands.
