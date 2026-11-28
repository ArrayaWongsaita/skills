# The run loop

For each unit of work, in order. A unit is the smallest piece of the job that has its own check.

## The files

`progress.md`: a table with one row per unit.

| unit | state | worker session | status file | log |
|---|---|---|---|---|

State is one of `todo`, `with worker`, `verifying`, `done`, `blocked`. Update the row when the state changes, in the same call as the work that changed it.

`decisions.md`: one line per decision you took for the user.

`<unit> · <decision> · <why> · <alternative dropped>`

Add `overrule?` to the lines the user is most likely to want to change. Write the line when you decide, not at the end.

## The steps

1. **Design.** Decide what the unit is and what "done" is as a command. You plan it yourself: you are the stronger model. Where a skill has a step for the user to approve a plan, and the brief hands that over, approve it yourself and log the decision.
2. **Hand over.** To the worker, the way its skill describes. For OpenCode that is `opencode-delegate`: a plan round you correct, then a build round, in one session. The message has the goal, the files it may touch, the done-command, and what it must not do. One worker turn at a time. After a plan-only round, check that no file changed: a worker may build during it. If it did and the result passes your check, treat that round as the build round and log the decision.
3. **Wait.** `waiting.md`.
4. **Verify.** Run the done-command yourself and open the output. The worker's report is a claim; `opencode-delegate` says so too. The unit is `done` only now. Keep the command and what it printed for the final report.
5. **Fix.** Send the failure back to the same worker session. Take the unit over yourself when the fix is smaller than the message that would ask for it, or when the worker has failed the same check twice. If you cannot fix it within the caps in the brief, it is a serious problem.
6. **Record.** Update `progress.md`, and `decisions.md` for any decision you took.

## A serious problem

Something from the stop list in `brief.md`. Do not ask now.

1. Mark the unit `blocked` in `progress.md` with the question and what you tried.
2. Go on with every unit that does not depend on it.
3. When no unit can go on, stop. Send one message: every open question, each with your recommendation, and what is already done. If the harness can notify the user, do that once when you stop.

A worker that fails for a reason on the stop list (it needs a credential it does not have) is this case too. Never make up the missing thing, and never write the result a worker was meant to fetch yourself.

## Finish

The final report, in the user's language:

- what is done, with the checks you ran and what they printed;
- the decisions the user may want to overrule (the `overrule?` lines);
- what is `blocked`, with each question and your recommendation;
- the three places to look first.

Then clean up what the run started: end each worker session with `opencode session delete <id>` (a stand-in or an older opencode may lack it: say so in the report), stop the servers you started (`lsof -ti tcp:<port> -sTCP:LISTEN` shows the server that holds a port; the bare form also lists every process connected to it, and a `kill` would stop those too), and remove the scratch copies you made. Offer the problem list as the last section of `SKILL.md` says.
