# Multi-Turn Orchestration & Resumption

Delegated tasks often benefit from a verification loop. Rather than restarting from scratch when minor revisions are needed, the host agent resumes the active subagent session via `--conversation <conversation_id>`.

## The Resumption Loop

```
Host Agent                         Headless agy Subagent
    │                                        │
    │── Write prompt to file ───────────────>│  Turn 1: Initial Dispatch
    │<─ Return JSON (conversation_id) ───────│
    │
    │  [Verification Gate: Inspect Result]
    │  - Check acceptance criteria
    │  - Verify test and build passes
    │
    │  [If revisions needed]
    │── Write feedback to followup file ────>│  Turn 2: Resume via --conversation
    │<─ Return updated JSON ─────────────────│
    │
    ▼
Task Complete / Integrated
```

## Step-by-Step Resumption Procedure

1. **Extract Conversation ID**: Read the initial JSON output file and capture `"conversation_id"`.
2. **Formulate Specific Feedback**: Write the targeted correction to `/tmp/agy-prompts/<task-id>-followup.md`.
   State the exact failure (compiler error output, failing test stack trace, or missing requirement).
3. **Dispatch Resumption Command**:
   ```bash
   agy --conversation "<conversation_id>" \
     -p "$(cat /tmp/agy-prompts/<task-id>-followup.md)" \
     --dangerously-skip-permissions \
     --output-format json \
     --print-timeout 15m \
     --disable-slash-commands \
     > /tmp/agy-logs/<task-id>-followup.json \
     2> /tmp/agy-logs/<task-id>-followup.err
   ```
   Keep stderr in its own file — a diagnostic line merged into the envelope
   breaks the parse.
4. **Inspect Updated Result**: Check the exit code (`0`/`1`/`2`), read
   `/tmp/agy-logs/<task-id>-followup.json`, confirm `status == "SUCCESS"` (any of
   `ERROR`, `CANCELED`, `INTERRUPTED`, `INVALID` is a failure — read `error` and
   the `.err` file), then verify the criteria.

## Verification Gate Guidelines

The host agent remains the primary authority over task correctness:
- Run verification tests locally in the host environment to confirm changes before accepting the result.
- Inspect git diffs directly rather than relying solely on the subagent's verbal self-report.
- Bound follow-up attempts: Allocate a budget of up to 3 revision turns. If the subagent fails to converge after 3 turns, halt and escalate the specific blocker to the human user.
