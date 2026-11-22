---
template: "course-research/part@1"
course: "langchain-langgraph"
part: 1
title: "Agent ตัวแรกด้วย create_agent"
outcomes: ["O1", "O3"]
prerequisite_parts: []
versions: {"langchain": "1.5.2", "langgraph": "1.2.24"}
code_status: "verified"
generated: "2026-11-22"
---
# Part 1: Agent ตัวแรกด้วย create_agent

## Context

ผู้เรียนเขียน Python ได้ แต่ยังไม่เคยใช้ LangChain และเรียนด้วยตัวเอง

## Objectives

- O1: จบ part นี้ ผู้เรียนสามารถสร้าง agent ที่เรียกใช้ tool ได้
- O3: ผู้เรียนสามารถบอกได้ว่าโค้ดไหนเป็นแบบก่อน 1.0

## Prerequisites and setup

- Python 3.12 และ `pip install langchain==1.5.2 langgraph==1.2.24`

## Key terms

- **Agent**: โมเดลที่ตัดสินใจเรียก tool เองเป็นวงรอบ

## Core mental model

agent = โมเดล + tool + วงรอบ "คิด → เรียก tool → อ่านผล" จนได้คำตอบ

## Real-world task

สร้างผู้ช่วยตอบคำถามสภาพอากาศ 🌤️

## Sub-topics

### 1.1 เรียกโมเดลด้วย init_chat_model

#### Core knowledge

`init_chat_model("provider:model")` สร้างโมเดลจากชื่อ ([Source](https://docs.langchain.com/oss/python/langchain/models))

#### Worked example

<!-- snippet id="1.1-a" status="verified" checked="2026-11-22" -->
```python
from langchain.chat_models import init_chat_model

# เลือกผู้ให้บริการด้วย prefix
model = init_chat_model("openai:gpt-5")
print(model.invoke("สวัสดี").content)
```

**Expected output:**
```text
(ตัวอย่าง คำตอบจริงจาก LLM จะต่างไป) สวัสดีครับ
```

#### Analogy

_None._

#### Misconceptions

- เรียก `ChatOpenAI` ตรง ๆ ก็ได้ แต่คอร์สนี้ใช้ `init_chat_model` เพื่อสลับผู้ให้บริการได้ง่าย

#### Common errors and fixes

- `ValueError: Unable to infer model provider` → ใส่ prefix เช่น `openai:`

#### Self-check

1. ทำไมต้องใส่ `openai:` หน้าชื่อโมเดล? — เฉลย: เพื่อบอกว่าใช้ผู้ให้บริการไหน

#### Sources

- [LangChain models guide](https://docs.langchain.com/oss/python/langchain/models)

### 1.2 สร้าง agent ที่เรียก tool

#### Core knowledge

`create_agent` รับโมเดลและรายการ tool แล้ววนเรียกจนได้คำตอบ ([Source](https://docs.langchain.com/oss/python/langchain/agents))

#### Worked example

<!-- snippet id="1.2-a" status="verified" checked="2026-11-22" -->
```python
from langchain.agents import create_agent
from langchain.tools import tool


@tool
def get_weather(city: str) -> str:
    """Get the weather for a city."""
    return f"แดดออกที่ {city}"


agent = create_agent(model="openai:gpt-5", tools=[get_weather])
result = agent.invoke({"messages": [{"role": "user", "content": "อากาศที่กรุงเทพ?"}]})
print(result["messages"][-1].content)
```

**Expected output:**
```text
(ตัวอย่าง คำตอบจริงจาก LLM จะต่างไป) วันนี้แดดออกที่กรุงเทพ
```

#### Analogy

เหมือนพนักงานที่เปิดคู่มือ (tool) เมื่อไม่รู้คำตอบ (authored)

#### Misconceptions

- `create_react_agent` จาก `langgraph.prebuilt` เป็นแบบก่อน 1.0 ปัจจุบันใช้ `langchain.agents.create_agent` ([Source](https://docs.langchain.com/oss/python/migrate/langgraph-v1))

#### Common errors and fixes

- tool ไม่มี docstring → ใส่ docstring เพราะโมเดลใช้เป็นคำอธิบาย tool

#### Self-check

1. agent รู้ได้อย่างไรว่าควรเรียก tool ไหน? — เฉลย: จากชื่อและ docstring ของ tool

#### Sources

- [LangChain agents guide](https://docs.langchain.com/oss/python/langchain/agents)

## Practice material

- เพิ่ม tool `get_time(city)` แล้วถามคำถามที่ต้องใช้ทั้งสอง tool

## Bridge to next part

Part 2 จะเปิดดูข้างใน agent ด้วย StateGraph

## Further reading

- [LangChain v1 release notes](https://docs.langchain.com/oss/python/releases/langchain-v1)

## Sources

- [LangChain overview](https://docs.langchain.com/oss/python/langchain/overview)
