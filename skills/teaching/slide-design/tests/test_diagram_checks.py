import copy

import pytest

from deck import Field, Slide, parse_diagrams
from diagram_checks import check_diagram, check_states, element_kinds

CONCEPTS = {"user", "model", "tool", "agent", "function", "value"}


@pytest.fixture
def diagrams(fixtures_dir):
    text = (fixtures_dir / "course/slides/_work/part-01/diagrams.md").read_text(encoding="utf-8")
    return parse_diagrams(text)[0]


@pytest.fixture
def agent_loop(diagrams):
    return copy.deepcopy(diagrams["d-agent-loop"])


def show(ids, new=None, highlight=(), dim=(), diagram="d-agent-loop"):
    visual = {"kind": "diagram", "diagram": diagram, "show": list(ids), "highlight": list(highlight), "dim": list(dim)}
    if new is not None:
        visual["new"] = list(new)
    return visual


def slides_with(specs, items=0):
    """Build slides 1-001…; a spec's third value "same" fills `new` with what the slide adds."""
    slides, shown = [], {}
    for number, (layout, visual, new) in enumerate(specs, start=1):
        visual = copy.deepcopy(visual)
        if new == "same" and visual.get("kind") == "diagram":
            before = shown.get(visual["diagram"], [])
            visual["new"] = [i for i in visual["show"] if i not in before]
        if visual.get("kind") == "diagram":
            shown[visual["diagram"]] = visual["show"]
        fields = {}
        if items:
            names = [f"ขั้น {n}" for n in range(1, items + 1)]
            fields["Items"] = Field(name="Items", text="\n".join(f"{n}. {t}" for n, t in enumerate(names, 1)), items=names, blocks=[], line=0)
        slides.append(Slide(id=f"1-{number:03d}", layout=layout, line=number, section="opening", meta={"layout": layout}, fields=fields, visual=visual))
    return slides


def test_fixture_diagrams_are_valid(fixtures_dir):
    diagrams, _, errors = parse_diagrams((fixtures_dir / "course/slides/_work/part-01/diagrams.md").read_text(encoding="utf-8"))
    assert errors == [] and set(diagrams) == {"d-agent-loop", "d-init"}
    assert [m for d in diagrams.values() for m in check_diagram(d, CONCEPTS)] == []


def test_element_kinds(agent_loop):
    kinds = element_kinds(agent_loop)
    assert (kinds["n-user"], kinds["e-call"], kinds["g-agent"], kinds["b2"]) == ("node", "edge", "group", "badge")
    assert len(kinds) == 11


@pytest.mark.parametrize("change,message", [
    (lambda d: d["nodes"][2].update(at=[5, 1]), "nodes overlap: n-model, n-tool"),
    (lambda d: d["nodes"][2].update(at=[11, 4]), "node n-tool is outside the canvas"),
    (lambda d: d["nodes"][0].update(concept="robot"), "unknown concept 'robot'"),
    (lambda d: d["groups"][0].update(concept="robot"), "unknown concept 'robot'"),
    (lambda d: d["edges"][0].update(to="n-zzz"), "edge e-ask: unknown node 'n-zzz'"),
    (lambda d: d["edges"][0].update(to="n-user"), "edge e-ask points to itself"),
    (lambda d: d["edges"][0].update(style="dotted"), "edge e-ask: style must be"),
    (lambda d: d["badges"][1].update(id="b1"), "duplicate element id b1"),
    (lambda d: d["badges"][1].update(n=1), "badge numbers must be unique"),
    (lambda d: d["badges"][0].update(near="n-zzz"), "badge b1: unknown element 'n-zzz'"),
    (lambda d: d["groups"][0].update(members=["e-ask"]), "group g-agent: unknown node 'e-ask'"),
    (lambda d: d["nodes"][0].update(label="ก" * 25), "label too long: n-user"),
    (lambda d: d.update(canvas=[30, 6]), "canvas must be"),
    (lambda d: d.update(id="agent-loop"), "diagram id 'agent-loop'"),
])
def test_diagram_errors(agent_loop, change, message):
    change(agent_loop)
    assert any(message in m for m in check_diagram(agent_loop, CONCEPTS)), check_diagram(agent_loop, CONCEPTS)


def test_touching_nodes_do_not_overlap(agent_loop):
    agent_loop["nodes"][2].update(at=[5, 2])  # directly under n-model, sharing an edge
    assert not any("overlap" in m for m in check_diagram(agent_loop, CONCEPTS))


def test_thai_label_counts_visible_characters(agent_loop):
    agent_loop["nodes"][0].update(label="ที่" * 24)  # 24 visible, 72 code points
    assert check_diagram(agent_loop, CONCEPTS) == []


def test_valid_build_has_no_errors(diagrams):
    slides = slides_with([("explain", show(["n-user", "n-model", "e-ask", "e-answer"]), "same"),
                          ("explain", show(["n-user", "n-model", "e-ask", "e-answer", "n-tool", "e-call"], highlight=["n-model"]), "same"),
                          ("explain", show(["n-user", "n-model", "e-ask", "e-answer", "n-tool", "e-call"], dim=["n-user"]), "same")])
    assert check_states(slides, diagrams) == []
    assert slides[2].visual["new"] == []


def test_new_must_match_what_the_slide_adds(diagrams):
    slides = slides_with([("explain", show(["n-user", "n-model", "e-ask"]), "same"),
                          ("explain", show(["n-user", "n-model", "e-ask", "n-tool", "e-call"], new=["n-tool"]), "")])
    assert check_states(slides, diagrams) == [("1-002", "`new` does not match what this slide adds: expected [e-call, n-tool]")]


def test_new_compares_with_the_last_slide_on_the_same_diagram(diagrams):
    slides = slides_with([("explain", show(["n-user"]), "same"),
                          ("explain", show(["n-name"], diagram="d-init"), "same"),
                          ("explain", show(["n-user", "n-model", "e-ask"], new=["n-model", "e-ask"]), "")])
    assert check_states(slides, diagrams) == []


def test_closure_and_subsets(diagrams):
    slides = slides_with([("explain", show(["n-model", "e-call"], highlight=["e-call"], dim=["e-call"]), "same")])
    messages = [m for _, m in check_states(slides, diagrams)]
    assert "edge e-call shown without n-tool" in messages and "highlight and dim overlap" in messages


@pytest.mark.parametrize("visual,message", [
    (show(["n-model", "b2"]), "badge b2 shown without e-call"),
    (show(["n-model", "g-agent"]), "group g-agent shown without n-tool"),
    (show(["n-model"], highlight=["n-tool"]), "highlight is not a subset of show"),
    (show(["n-model", "n-ghost"]), "unknown element 'n-ghost'"),
    (show(["n-model"], diagram="d-missing"), "unknown diagram 'd-missing'"),
])
def test_state_errors(diagrams, visual, message):
    messages = [m for _, m in check_states(slides_with([("explain", visual, "same")]), diagrams)]
    assert any(message in m for m in messages), messages


def test_steps_items_match_badges(diagrams):
    slides = slides_with([("steps", show(["n-model", "n-tool", "e-call", "b1", "b2"]), "same")], items=3)
    assert ("1-001", "steps items (3) do not match visible badges [1, 2]") in check_states(slides, diagrams)


def test_steps_need_a_diagram(diagrams):
    slides = slides_with([("steps", {"kind": "illustration", "description": "x"}, "")], items=2)
    assert ("1-001", "a steps slide needs a diagram visual") in check_states(slides, diagrams)


def test_fallback_is_outside_the_new_rule(diagrams):
    fallback = {"kind": "illustration", "fallback": {"kind": "diagram", "diagram": "d-agent-loop", "show": ["n-model"], "new": ["n-model"]}}
    assert ("1-001", "fallback diagram takes no new") in check_states(slides_with([("explain", fallback, "")]), diagrams)


def test_fallback_does_not_count_as_previous(diagrams):
    fallback = {"kind": "illustration", "fallback": {"kind": "diagram", "diagram": "d-agent-loop", "show": ["n-model", "n-tool", "e-call"]}}
    slides = slides_with([("explain", fallback, ""), ("explain", show(["n-model"]), "same")])
    assert check_states(slides, diagrams) == []
    assert slides[1].visual["new"] == ["n-model"]
