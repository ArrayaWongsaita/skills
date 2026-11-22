---
template: "course-research/part@1"
course: "langchain-langgraph"
part: 2
title: "เปิดดูข้างในด้วย StateGraph"
outcomes: ["O2"]
prerequisite_parts: [1]
versions: {"langchain": "1.5.2", "langgraph": "1.2.24"}
code_status: "verified"
generated: "2026-11-22"
---
# Part 2: เปิดดูข้างในด้วย StateGraph

## Context

ผู้เรียนสร้าง agent ด้วย create_agent ได้แล้วจาก Part 1

## Objectives

- O2: จบ part นี้ ผู้เรียนสามารถสร้าง StateGraph ที่มี node และ edge ได้

## Prerequisites and setup

- จบ Part 1 และติดตั้งแพ็กเกจชุดเดิม

## Key terms

- **State**: ข้อมูลที่ส่งต่อระหว่าง node

## Core mental model

กราฟ = state ที่ไหลผ่าน node ตามเส้น edge

## Real-world task

แยกขั้นตอนของผู้ช่วยเป็น node ที่ทดสอบแยกกันได้

## Sub-topics

### 2.1 node และ edge แรก

#### Core knowledge

`StateGraph` รับชนิดของ state แล้วเพิ่ม node และ edge ([Source](https://docs.langchain.com/oss/python/langgraph/graph-api))

#### Worked example

<!-- snippet id="2.1-a" status="verified" checked="2026-11-22" -->
```python
from typing import TypedDict

from langgraph.graph import END, START, StateGraph


class State(TypedDict):
    text: str


def shout(state: State) -> State:
    return {"text": state["text"].upper()}


builder = StateGraph(State)
builder.add_node("shout", shout)
builder.add_edge(START, "shout")
builder.add_edge("shout", END)
print(builder.compile().invoke({"text": "hello"}))
```

**Expected output:**
```text
{'text': 'HELLO'}
```

#### Analogy

_None._

#### Misconceptions

_None._

#### Common errors and fixes

- ลืม `add_edge(START, ...)` → กราฟไม่มีจุดเริ่ม ต้องเพิ่ม edge จาก START

#### Self-check

1. node คืนค่าอะไร? — เฉลย: ส่วนของ state ที่ต้องการอัปเดต

#### Sources

- [LangGraph Graph API](https://docs.langchain.com/oss/python/langgraph/graph-api)

## Practice material

- เพิ่ม node ที่สองที่ต่อท้ายด้วยเครื่องหมาย !

## Bridge to next part

จบคอร์ส: ต่อยอดด้วย persistence และ human-in-the-loop

## Further reading

- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview)

## Sources

- [LangGraph Graph API](https://docs.langchain.com/oss/python/langgraph/graph-api)
