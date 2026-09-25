# Coding Standards

Project rules and conventions.

## Documentation and Guides

- **Single Source of Truth**: User guides and skill documentation must reference canonical glossary terms and skill contract files rather than duplicating normative parameter descriptions or cache semantics in prose. When documenting shared mechanics across multiple skills, link to the canonical contract or glossary entry to prevent documentation drift.


## File System Mutations

- **Atomic File Rewrites**: When a script modifies or rewrites existing files in-place (especially in git-ignored scratch directories), write the new contents to a sibling temporary file (e.g. `.<file>.tmp-<pid>`) and atomically rename it (`fs.renameSync`) over the target file, preserving permissions and ensuring temporary files are removed on abort or failure.
