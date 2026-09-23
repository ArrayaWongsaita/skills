# Reuse Catalog

Domain glossary for the reuse feature that spans `grill-to-tickets`, the three
directory implementers (`subagent-implement`, `agy-implement`,
`opencode-implement`), and `review-to-pr`. It exists so agents plan and write
code against what the target project already has, instead of re-deriving it —
and so the knowledge of what exists persists between runs rather than being
re-surveyed from scratch every time.

## Language

### The catalog

**Reuse Catalog**:
The per-project file `docs/reuse-catalog.md` that indexes the project's
reusable code: where shared code lives, the rules for using it, one entry per
shared module, the candidates, and the survey coverage. It lists only code that
exists at the moment it is read.
_Avoid_: reuse doc, util list, component registry, inventory

**Entry**:
One line in the Reuse Catalog naming one module by symbol, its file, and when to
use it. Symbol + file + use-when, nothing else — the module's own interface is
read from the code.
_Avoid_: record, item, listing

**Shared layer**:
The part of a project intended for use across features (helpers, UI primitives,
clients, test factories). A module belongs here when it has two or more real
consumers, or was deliberately built as a primitive.
_Avoid_: common, utils, core

**Candidate**:
A module built inside one feature with a feature-agnostic interface, catalogued
so a later feature can find it — but not yet in the shared layer because only one
consumer exists.
_Avoid_: future shared, maybe-reusable, draft

**Promote**:
Moving a Candidate into the shared layer once a second real consumer appears,
done by a prefactor ticket in the feature that brings the second consumer.
_Avoid_: graduate, upgrade, extract (extract is the code motion; promote is the
catalog + layer change)

**Coverage**:
The catalog section listing each project area already surveyed and the date of
that survey. It is what makes the catalog's incompleteness explicit: an area not
in Coverage has never been surveyed, and a covered area is re-read only for files
changed since its date.
_Avoid_: scope, surveyed dirs, index state

**Drift check**:
Verifying, at every read, that each Entry's symbol still exists in its file, and
removing or correcting the ones that do not.
_Avoid_: validation, catalog lint, freshness check

### Planning

**Reuse survey**:
The Stage 0 lookup in `grill-to-tickets` that reads the catalog, runs the drift
check, and searches only the gaps — uncovered areas the idea touches, and files
changed in covered areas since their Coverage date.
_Avoid_: reuse scan, codebase crawl, inventory pass

**Reuse Plan**:
The spec subsection (under Implementation Decisions) that records, for this
feature, what is used as-is, extended, created as shared, created as a
candidate, promoted, and deliberately kept separate — with the interface of every
new shared module and its named consumers.
_Avoid_: reuse section, DRY plan, sharing strategy

**Owner ticket**:
The single ticket that creates a given new shared module — the first vertical
slice that needs it. Every other ticket consuming that module is blocked by the
owner ticket.
_Avoid_: utils ticket, shared ticket, foundation ticket

**Reuse field**:
The `**Reuse:**` line on a ticket, listing its reuse actions with fixed verbs:
`use`, `extend`, `create-shared`, `create-candidate`, `promote`. It is guidance
and catalog bookkeeping, never an acceptance criterion.
_Avoid_: reuse criteria, reuse checklist, DRY requirements

**Design for extraction**:
The policy for reuse nobody needs yet: build the module inside the feature with a
feature-agnostic interface and record it as a Candidate, rather than building a
general-purpose shared module ahead of a second consumer.
_Avoid_: future-proofing, build for reuse, generic-first
