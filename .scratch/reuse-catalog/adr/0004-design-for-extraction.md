# Reuse nobody needs yet is designed for extraction, not built general

Asking an agent to "design for future reuse" reliably produces speculative
abstraction — generic bases, option bags, hooks for needs no spec has — the
Speculative Generality smell `code-review` itself flags. We split reuse into
three questions with different bars:

1. **Use existing** — always asked; answered from the catalog and survey.
2. **Share within this feature** — a new shared module requires two or more
   named consumers in this spec (or one existing caller plus one in this spec).
   It gets an owner ticket, and its interface is settled in the Reuse Plan so
   the owner builds what every consumer needs.
3. **Future reuse** — no second consumer yet: build it inside the feature with a
   feature-agnostic interface and record it as a **Candidate**. When a later
   feature's survey finds the Candidate and needs it, that feature **promotes**
   it with a prefactor ticket — a legitimate prefactor, since a real caller now
   exists.

The single exception to (3) is a human decision: if the user confirms in
grilling that a named upcoming feature will consume the module, it may be
`create-shared` now. The agent proposes; it does not decide.

Trade-off: a module that will obviously be reused sits in a feature directory
for one cycle and is moved later. Accepted — a move with a real second caller is
cheap and correct; a general abstraction built for an imagined caller is usually
the wrong shape.
