# Coding Standards

Project rules and conventions.

## Documentation and Guides

- **Single Source of Truth**: User guides and skill documentation must reference canonical glossary terms and skill contract files rather than duplicating normative parameter descriptions or cache semantics in prose. When documenting shared mechanics across multiple skills, link to the canonical contract or glossary entry to prevent documentation drift.


## File System Mutations

- **Atomic File Rewrites**: When a script modifies or rewrites existing files in-place (especially in git-ignored scratch directories), write the new contents to a sibling temporary file (e.g. `.<file>.tmp-<pid>`) and atomically rename it (`fs.renameSync`) over the target file, preserving permissions and ensuring temporary files are removed on abort or failure.


## Contract Tests

- **Scoped Assertions**: Contract tests must assert against sliced sections or specific AST structures (catalog Rule 5), never whole files. Do not hardcode exact line numbers (`lineNumber === 27`) when matching content, and ensure regexes test distinguishing tokens rather than generic words that vacuously match surrounding boilerplate.
