# Bug Flow

1. Classify an observed contract violation as `BUG`; record `INCIDENT` only
   for current production impact.
2. Run installed `diagnosing-bugs`. It owns the feedback loop, reproduction,
   minimization, hypotheses, instrumentation, regression seam, and may hand
   back a validated fix.
3. If diagnosis returns only confirmed cause and red evidence, hand off to
   installed `implement` using `REGRESSION_TEST` then `FIX` modes. If the
   installed diagnosis already completed the fix, register the evidence and
   continue to code review without repeating implementation.
4. For active incidents, a human may authorize a small reversible observable
   emergency mitigation. Review it, then return to diagnosis; mitigation never
   clears `mitigationOutstanding` or completes the workflow.
5. Run two-axis `code-review`; run final `scrutinize` for system-sensitive
   impact. The final system gate is blocking, has an independent six-review
   maximum, and stops earlier on no progress. A fix from final scrutinize must
   pass tests/typecheck and `code-review` before system review runs again.
6. Enter `POST_MORTEM` only when `incidentSubtype=INCIDENT`, all four external
   post-mortem inputs are validated, and the installed contract accepts the
   case. The audited 9arm post-mortem explicitly rejects customer-visible
   incidents, so that path blocks rather than inventing a replacement writer.
