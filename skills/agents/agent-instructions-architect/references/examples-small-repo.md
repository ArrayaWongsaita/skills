# Example: small repository

~~~text
AGENTS.md
ARCHITECTURE.md
docs/
└── standards/
    └── testing.md
.agents/
└── skills/
    └── testing/
        └── SKILL.md
~~~

The root keeps the mission, actual commands, repository map, universal
invariants, and proportional verification. It routes behavior changes to the
testing skill. The skill owns the repeatable HOW; `docs/standards/testing.md`
owns only project-specific test requirements. Omit `ARCHITECTURE.md` or the
standard when existing documentation already owns those facts or the repository
is too simple to need them.
