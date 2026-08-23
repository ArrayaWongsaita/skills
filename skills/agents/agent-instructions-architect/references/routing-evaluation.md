# Routing evaluation

Test the final skill catalog with repository-specific prompts. Record expected
and unexpected skills; the goal is the minimum sufficient composition.

| Representative prompt | Expected | Not expected |
| --- | --- | --- |
| Design Order and Payment persistence; do not implement | `database-design` | `database-change` |
| Add `deletedAt` to User and update behavior | `database-change`, proportional `testing` | `database-design` |
| Persist password reset tokens and add an endpoint | `database-change`, `backend-development`, `security-review`, `testing` | frontend unless affected |
| Build a dashboard component using an existing API | `frontend-development`, proportional `testing` | database skills |
| Fix button padding | `frontend-development` | database or backend skills |
| Rename a database column used by API and UI | `database-change`, `backend-development`, `frontend-development`, `testing` | design-only skill |
| Refactor an internal backend function without behavior change | `backend-development` | unrelated domain skills |

Adapt nouns and technologies to the repository; do not invent absent domains.

## Evaluation checks

1. Design-only wording must not route to implementation.
2. High-risk database changes and security boundaries must not be missed.
3. Cross-cutting skills compose with domain procedures.
4. Trivial work does not load unrelated expertise.
5. Descriptions, not hidden body text, are sufficient for selection.
6. Similar prompts with one changed concern produce the expected routing delta.
7. No prompt routes to specialist-agent roles or multi-agent coordination.

When routing is wrong, first tighten the skill description. Split or merge
skills only when the underlying procedures truly differ or overlap; do not grow
a taxonomy to compensate for vague metadata.
