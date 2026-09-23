# Transcript Mode

When invoked with `--transcript`, or when no `.scratch/<feature-slug>/` directory exists and the user confirms, the Retro reads session transcripts. Reading full session transcripts directly into the primary context is costly, so transcript mode gives the user full cost control: the user chooses which sessions to read, and a single read-only subagent reads them, returning Misses only.

## Session Discovery and Selection

Under Claude Code, the Retro discovers candidate sessions by inspecting the harness's transcript directory:

```text
~/.claude/projects/<project>/
```

It scans for sessions that mention the feature slug, listing each matching session with its:
- **Date** (timestamp of the session)
- **Size** (file size / length of the transcript)

The user picks which sessions to read from the list. The Retro never reads unselected sessions.

### Outside Claude Code

Outside Claude Code, the harness transcript directory is not known automatically. The Retro asks the user for the transcript path directly before proceeding:

> Outside Claude Code, the Retro asks for the transcript path.

## Read-Only Subagent Extraction

The Retro delegates the reading of the selected session transcripts to one single read-only subagent.

The subagent:
1. Runs read-only with a focused prompt.
2. Reads the selected transcripts.
3. Returns **Misses only**, preserving the primary agent's context window.

Every transcript Miss returned carries:
- **Session ID**: the identifier of the session where the Miss occurred.
- **Quote**: a verbatim quote from the transcript providing verifiable evidence.

## The Four Miss Signals

The subagent inspects the transcripts specifically for four signals:
1. **Slow searches for files**: excessive exploration steps, repeated file finds, or lengthy traversal when seeking project files.
2. **Tool calls that failed repeatedly**: commands or tool invocations that errored or failed multiple times before succeeding or being abandoned.
3. **Information the agent lacked**: missing access, unprovided environment documentation, missing logs, or unavailable tools that left the agent debugging blind or guessing.
4. **Expensive tool use**: disproportionately heavy tool calls, massive context dumps, or inefficient multi-megabyte queries.
