<!-- Use as repository-wide instructions for self-contained execution plans when complex work recurs. Do not add if the repository already has an accepted plan convention. -->
# Execution Plan Standard

- Status: Active
- Owner: `[engineering team or role]`

Require an execution plan for major features, architectural changes, complex migrations, cross-service changes, or work that cannot be safely completed and verified in one bounded pass.

Each plan must be self-contained and maintain these sections:

1. Purpose and observable outcome.
2. Current state, constraints, assumptions, and source-of-truth links.
3. In-scope and forbidden scope.
4. Milestones expressed as independently verifiable behavior.
5. Progress with timestamps only when the repository uses them.
6. Discoveries and surprises with evidence.
7. Decision log with status and owner.
8. Verification, rollout, rollback, and approvals.
9. Outcome and remaining risk.

Update the plan as execution reveals material facts. Never use a plan to authorize production or destructive execution.
