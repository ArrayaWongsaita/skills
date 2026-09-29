# Large-Project Flow

1. Classify `LARGE_PROJECT` and establish the destination and repository
   boundary.
2. Hand off to installed user-only `wayfinder` on Claude, or load its exact
   audited path on Codex. It owns the decision map, frontier, and fog of war.
3. Route external-fact questions to installed `research` and UI/state questions
   to installed `prototype`; check/install them only when that uncertainty is
   actually present, persist each evidence reference, and resume from the
   paused exploration stage after an approved installation.
4. Use `to-tickets` when the settled map needs vertical bounded feature slices;
   the orchestrator records child workflow IDs and parent links only.
5. Create one `FEATURE` child workflow per bounded destination and execute the
   normal/reduced feature route for each child.
6. Re-wayfind whenever a child invalidates an assumption. The parent may not
   jump from `DISCOVERY` or `PLANNING` directly to implementation.
7. Complete the parent only after every child is `COMPLETE`, parent artifacts
   reconcile, and the destination still matches the map.
