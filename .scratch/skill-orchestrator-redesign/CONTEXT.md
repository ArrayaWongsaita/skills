# Domain Glossary (Context)

Ubiquitous language and domain concepts for the full-lifecycle skill orchestration architecture.

## Language

**Full-Lifecycle Orchestrator**:
A composite skill that serves as the single conversational entry point to guide an engineer end-to-end through requirement discovery, specification, design review gates, vertical ticket planning, context resets, test-driven implementation, and quality reviews.
_Avoid_: Master agent, parent controller, meta-skill

**Smart Zone**:
The optimal reasoning context window of a state-of-the-art language model (~150k tokens). High-cognitive tasks (grilling, specification, vertical slicing) remain in an unbroken context window, while implementation tasks start in a fresh context window to maximize coding accuracy.
_Avoid_: Working memory, reasoning limit, token threshold

**Phase Boundary**:
An explicit transition checkpoint between planning and execution where accumulated conversational context is cleared to reset the context window before writing code.
_Avoid_: Context clear point, stage reset, session break

**Inline Execution**:
The mechanism by which an orchestrator reads and executes instructions directly from child skill markdown files without requiring runtime tool calls, bypassing model-invocation restrictions on child skills.
_Avoid_: Sub-agent invocation, tool dispatch, direct call

**Design Quality Gate**:
A blocking review stage using outsider scrutiny to evaluate intent, architectural simplicity, and testing seams before ticket breakdown begins.
_Avoid_: Design checkpoint, pre-ticket check, spec gate

**Tracer-Bullet Ticket**:
A self-contained vertical slice of work that cuts across all system layers (schema, logic, interface, and tests) and can be verified independently in a single fresh context window.
_Avoid_: Micro-task, sub-issue, layer slice
