# Intake

The only time you ask the user anything. After the user says "go" they may be gone for hours, so every question that could change what you build is asked here, in one message.

## 1. Look first

Read what the job points at: the repository, the files, the links, the skills it will use. Check what you will need exists: the worker's tool, `<skill>/scripts/wait_status.py`, which of the wake modes in `waiting.md` your harness offers. Never ask what that already answers.

## 2. Ask once

One message. Numbered questions, each ending with `My proposal: …` so the user can reply "all as proposed". Ask even when the job looks doable: an agent that asked nothing guessed what "the answer file" meant, and the user only learned of the guess at the end.

Ask only what would change the result. Put what the job makes uninteresting (the stop list, the caps, the wake mode, where the files go, the worker's model) into one question that proposes the defaults. Three to six questions is normal; nine means you are asking out of habit.

Cover, as far as the job leaves them open:

- the goal, and what "done" is as checks you can run yourself (a command and what it prints);
- the input and the scope, including what to leave out;
- what the user keeps for themselves and what they hand over. By default everything not on the stop list is handed over, including approving your own plans where a skill has an approval step for the user;
- the stop list (below), for the user to edit;
- the workers: which, which model, and any cost, time or retry cap (default retry cap: the worker may fail the same check twice, then you take the unit over);
- where work may happen and what it must not touch (`opencode --auto` approves everything: use a scratch copy or a worktree);
- the wake mode and the interval between checks of a running worker (default 40 minutes);
- where the run's files go (default `<cwd>/.foreman/<slug>/`).

Format of the message:

```
Before I start I need these answered once. After "go" I will not ask again unless a serious problem comes up.

1. What does "done" look like? My proposal: <a command and its expected output>.
2. …

Send your answers and "go" in one reply and I start at once. Whatever you leave open I decide and list as my assumption.
```

## 3. Answers

A question the user leaves open becomes an entry under Assumptions in `brief.md`, marked as yours. Never write an assumption as something the user said. Do not start work until the user says "go".

## 4. The brief

Write `<work>/brief.md` from the answers. If the reply carries the answers and "go" in one reply, write `Status: go` in it and start: the user sees the brief in your final report, where it is the first place to look. If the reply has answers but no "go", show the brief and wait for "go", then write `Status: go`. "Go" is the authority for everything after it.

Headings of `brief.md`: Goal, Done checks, Input and scope, Handed over, Stop list, Workers, Where work may happen, Wake mode and interval, Caps, Assumptions, Status.

## The default stop list

A serious problem is one of these. The user edits the list at intake.

- It needs a credential, a secret or a payment.
- An irreversible or outward-facing action: delete, push, merge, deploy, send, anything outside the work folder.
- A finding that changes what the user would get: the source contradicts the request, or the job cannot be done as asked.
- A cap in the brief is reached (cost, time, retries) with the job unfinished.
- A result you have no way to check, on which the job's success depends.

Everything else you decide and write down.
