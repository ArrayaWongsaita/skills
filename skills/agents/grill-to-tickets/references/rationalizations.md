# Rationalizations

These fixed replies guide the main thread that decides and writes the artifacts.

## Shortcuts

| Excuse | Reality | Action |
| --- | --- | --- |
| The spec looks clear, so I can skip the design review. | Clarity to its author does not replace the fresh review chosen by the person. | Do not invent a skip. Read the recorded review answer and run Stage 2 within its budget; a recorded zero skips it. |
| The answer is obvious, so I can answer the human question myself. | Human decisions belong to the person; repository facts can be looked up. | Do not decide for the person. Ask the decision question with its tier and recommendation, or park it when they cannot answer. |
| I remember the interview, so I can write the spec from memory. | The decision log, glossary, and ADRs are the durable inputs to Stage 1. | Do not substitute recall for the log. Read the artifacts and account for every logged decision and assumed parked default in the spec. |
| The tickets look consistent, so I can skip the checker. | The checker verifies coverage, dependencies, context, and measured budgets before the quiz. | Do not trust visual inspection alone. Run the checker with --write-budget, fix errors, and re-run after changes; use the documented by-hand checks when Node is unavailable. |
| The stage skills were installed last time, so I can skip Preflight. | A new or resumed run needs the current stage-skill paths before execution. | Do not assume an old installation still exists. Locate all three skills in lookup order and stop with the install lines when one is missing. |
| The interview felt thorough, so I can skip the blind-spot pass. | An empty frontier still needs the category pass to surface gaps and assumptions. | Do not replace the pass with confidence. Mark every category and ask the final round for gaps that change the spec. |
| A blocking parked question has a sensible default, so I can proceed. | Its default only resolves the blocker when the person accepts it at the pause. | Do not silently downgrade a blocker. Hold the pause until the person answers or accepts the default, then record its resolved status. |
| The tickets are small, so I can implement the tickets before handing off. | This run ends at approved, checked tickets; implementation belongs to a separate run. | Do not start implementation here. Complete Stage 3 and give the handoff message for the later implementer run. |
