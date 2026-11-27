# Interviewing the user about a Part

Read this at the start of a Part, before you research anything.

The user often has only an idea: a broad subject, a few details they care about, and little knowledge of the subject itself. Your job is to learn enough to research and plan well, without making them do your thinking for them or answer a form.

## How to ask

- **One question per message,** in the user's language, and say why you ask: what the answer will change.
- **Propose, do not only ask.** Once you know the subject, offer your own guess for the next question ("I would assume learners are beginners who have used a spreadsheet; right?"). A guess the user can correct is easier than a blank.
- **Skip what is already answered:** by `<course_dir>/course-notes.md` (who the learner is, what earlier Parts taught), or by what the user said earlier.
- **Four to six questions at most.** Stop as soon as you can write the brief.
- **"I don't know" is a good answer.** Say "then I will propose X", write it in the brief as `Assumed:`, and move on.

## The questions, in this order

1. **What is the Part about?** In the user's own words, and what they already know about it, even if it is little. Ask for the one sentence they would say to a friend.
2. **Who learns it?** What they already know and can do, and what they use the slides for (reading alone, on a phone, in a class). The learner's starting point sets the first slide.
3. **What should they be able to do or explain afterwards?** One or two sentences, or an example of a thing the learner could do at the end. This is the Part's goal and its last slide.
4. **Must-haves and left-outs.** A way of explaining the user likes (an analogy, an example, a tool), a topic that must be in, a topic that must stay out.
5. **Is there code?** Only when the subject could involve it: the language, and whether learners run it. A Part with code gets real, run output on its example slides.
6. **Size.** Offer a default instead of asking: "about 20 to 35 slides, 3 to 5 topics; shall I?" Ask only when the user hinted at something very different.

## What you write down

At the end of the interview write `<work>/brief.md`, five lines at most, so a resumed run does not ask again:

```
Subject: …
Learner: …
Goal: …
Language: th   Code: python | none
Must / must not: …
Assumed: …   (every answer you proposed because the user did not know)
```

Show it in one short message and ask whether it is right, then go on to research. Do not wait for a long approval: the real checkpoints come later.

## A Part of a course

When `<course_dir>/course.md` has a row for this Part (`course-builder` made it; Part N is chapter NN), write the brief from it instead of interviewing:

- `Subject:` the row's title and what it practises; `Learner:` and `Goal:` from the top of `course.md`, narrowed to this chapter; `Language:` its slides language, and `Code:` the stack's language.
- `Must / must not:` the row's `under test`, what it `builds on`, and the rules of `<course_dir>/pattern.md` that bear on slides.
- Ask the user only what is still open after that, if anything. In a wave run by `foreman` nobody is there to ask: put it under `Assumed:`.

The playground already holds the chapter's code and its runs: research only what it does not show, and take every listing from it with `sync_listings.py` (`references/slides.md`, Code).

## When you cannot ask

A harness with no way to ask the user (a non-interactive run) cannot interview. Write the brief with an `Assumed:` entry for every line, say so at the top of your report ("nobody answered these; I assumed them"), and never present an assumption as something the user said.
