---
template: "slide-design/deck@1"
course: "langchain-agents"
part: 1
title: "Agent ตัวแรก"
source_file: "part-01-first-agent.md"
source_generated: "2026-11-20"
source_sha256: "0ac8ef9b7357e90fe2cd0605995b01641cf17cc1e74a4db0db3f4568485fe341"
language: "th"
vocabulary: "visual-vocabulary.md"
vocabulary_version: 1
slide_count: 19
code_status: "partial"
generated: "2026-11-21"
---
# Part 1: Agent ตัวแรก

## Deck notes

ผู้เรียนเขียน Python ได้ และอ่านสไลด์เองโดยไม่มีผู้บรรยาย

### Visuals to produce

- 1-001 illustration: หุ่นยนต์ผู้ช่วยถือกล่องเครื่องมือ
- 1-009 screenshot: https://docs.langchain.com/oss/python/langchain/agents
- 1-010 illustration: หุ่นยนต์ผู้ช่วยถือกล่องเครื่องมือ

### Code status

- 1.2-b: unverified (needs an API key)

## Opening

### 1-001 · cover

```slide
{"layout": "cover", "purpose": "รู้ว่า Part นี้จะสร้าง agent ตัวแรก", "from": ["Context"], "sources": []}
```

**Title:** Agent ตัวแรกของคุณ

**Body:** สร้าง agent ที่เรียก tool ได้ภายในบทเดียว 🎉

```visual
{"kind": "illustration", "description": "หุ่นยนต์ผู้ช่วยถือกล่องเครื่องมือ", "prompt": "A friendly robot assistant holding a toolbox. Hand-drawn line illustration, thin dark strokes, a few soft colour accents, plain white background, no text.", "alt": "หุ่นยนต์ถือกล่องเครื่องมือ", "fallback": {"kind": "diagram", "diagram": "d-init", "show": ["n-start", "n-name", "n-init", "n-chat", "n-cache", "e-start", "e-name", "e-make", "e-keep"], "highlight": [], "dim": []}}
```

### 1-002 · objectives

```slide
{"layout": "objectives", "purpose": "รู้ว่าจบบทแล้วทำอะไรได้", "from": ["Objectives"], "sources": []}
```

**Title:** จบบทนี้แล้วคุณจะ

**Items:**
1. สร้าง agent ด้วย `create_agent` ได้
2. ประกาศ tool ด้วย `@tool` ได้
3. อ่านผลลัพธ์ที่ agent ส่งกลับมาได้

### 1-003 · setup

```slide
{"layout": "setup", "purpose": "เตรียมเครื่องให้พร้อม", "from": ["Prerequisites and setup"], "sources": ["https://docs.langchain.com/oss/python/langchain/install"]}
```

**Title:** เตรียมเครื่องก่อนเริ่ม

**Items:**
- ติดตั้ง Python 3.11 ขึ้นไป
- ตั้งค่า `OPENAI_API_KEY` ในเครื่อง

```bash
pip install -U langchain langgraph
```

### 1-004 · terms

```slide
{"layout": "terms", "purpose": "รู้จักคำสำคัญของบท", "from": ["Key terms"], "sources": []}
```

**Title:** คำที่ต้องรู้

**Items:**
- **agent**: model ที่เรียก tool เป็นวงรอบจนได้คำตอบ
- **tool**: ฟังก์ชันที่ model ขอให้เรียก
- **tool call**: คำขอจาก model ว่าจะใช้ tool ไหน

## 1.1 รู้จัก agent

### 1-005 · focus

```slide
{"layout": "focus", "purpose": "เห็นว่าผู้ใช้คุยกับ model ผ่านคำถามและคำตอบ", "from": ["Core mental model"], "sources": []}
```

**Title:** Agent เริ่มจากคำถามของผู้ใช้เสมอ

**Body:** ผู้ใช้ส่งคำถาม แล้ว model ตอบกลับ

```visual
{"kind": "diagram", "diagram": "d-agent-loop", "show": ["n-user", "n-model", "e-ask", "e-answer"], "new": ["n-user", "n-model", "e-ask", "e-answer"], "highlight": [], "dim": []}
```

### 1-006 · explain

```slide
{"layout": "explain", "purpose": "เห็นว่า model ขอให้เรียก tool ได้", "from": ["1.1/Core knowledge"], "sources": ["https://docs.langchain.com/oss/python/langchain/agents"]}
```

**Title:** Model ขอให้เรียก tool ได้

**Body:** เมื่อคำถามต้องใช้ข้อมูลจริง model จะส่ง **tool call** ออกไป
ผลลัพธ์จาก tool กลับมาให้ model อ่านต่อ *ทุกครั้ง* (ดู [เอกสาร](https://docs.langchain.com/oss/python/langchain/agents))

```visual
{"kind": "diagram", "diagram": "d-agent-loop", "show": ["n-user", "n-model", "e-ask", "e-answer", "n-tool", "e-call", "e-result", "g-agent"], "new": ["n-tool", "e-call", "e-result", "g-agent"], "highlight": ["n-model"], "dim": []}
```

### 1-007 · steps

```slide
{"layout": "steps", "purpose": "เห็นวงรอบของ agent ครบทั้งสามขั้น", "from": ["Core mental model"], "sources": []}
```

**Title:** วงรอบของ agent สามขั้น

**Items:**
1. model อ่านคำถามแล้วตัดสินใจ
2. agent เรียก tool ตาม tool call
3. ผลลัพธ์กลับไปให้ model ตอบต่อ

```visual
{"kind": "diagram", "diagram": "d-agent-loop", "show": ["n-user", "n-model", "e-ask", "e-answer", "n-tool", "e-call", "e-result", "g-agent", "n-api", "e-llm", "e-hand", "b1", "b2", "b3", "t-loop"], "new": ["n-api", "e-llm", "e-hand", "b1", "b2", "b3", "t-loop"], "highlight": [], "dim": ["e-ask"]}
```

### 1-008 · compare

```slide
{"layout": "compare", "purpose": "เห็นว่า create_agent ทำวงรอบให้เอง", "from": ["1.1/Misconceptions"], "sources": []}
```

**Title:** เขียนวงรอบเอง กับ ใช้ create_agent

**Left:** เขียนวงรอบเอง ต้องเช็ก tool call ทุกรอบ

```python
while not done:
    reply = model.invoke(messages)
```

**Right:** `create_agent` ทำวงรอบให้

```python
agent = create_agent("openai:gpt-5", tools=[get_weather])
```

**Takeaway:** ใช้ `create_agent` แล้วไม่ต้องเขียนวงรอบเอง

### 1-009 · explain

```slide
{"layout": "explain", "purpose": "รู้ว่าเอกสารของ create_agent อยู่ที่ไหน", "from": ["Further reading"], "sources": ["https://docs.langchain.com/oss/python/langchain/agents"]}
```

**Title:** เอกสารของ create_agent

**Body:** หน้าเอกสารนี้อธิบายพารามิเตอร์ทั้งหมดของ `create_agent`

```visual
{"kind": "screenshot", "url": "https://docs.langchain.com/oss/python/langchain/agents", "capture": "The agents page, scrolled to the create_agent signature, with the tools parameter highlighted", "fallback": {"kind": "text", "text": "1. เปิด https://docs.langchain.com/oss/python/langchain/agents\n2. เลื่อนไปที่หัวข้อ create_agent"}}
```

## 1.2 สร้าง agent ที่เรียก tool

### 1-010 · explain

```slide
{"layout": "explain", "purpose": "เห็นว่า tool รับและคืนค่าอะไร", "from": ["1.2/Core knowledge"], "sources": []}
```

**Title:** Tool รับค่าแล้วคืนข้อความ

**Body:** tool รับ `{"city": "Bangkok"}` แล้วคืน `"<ข้อความ>"` & model อ่านต่อ เมื่อ a < b และ b > c ก็ยังเป็นข้อความธรรมดา

```visual
{"kind": "illustration", "description": "หุ่นยนต์ผู้ช่วยถือกล่องเครื่องมือ", "prompt": "A friendly robot assistant holding a toolbox, handing a tool to a laptop. Hand-drawn line illustration, thin dark strokes, a few soft colour accents, plain white background, no text.", "alt": "หุ่นยนต์ยื่นเครื่องมือให้คอมพิวเตอร์", "fallback": {"kind": "text", "text": "tool รับค่าเข้า แล้วคืนข้อความกลับไปให้ model"}}
```

### 1-011 · code

```slide
{"layout": "code", "purpose": "เห็นการประกาศ tool ด้วย @tool", "from": ["1.2/Worked example"], "sources": [], "snippet": "1.2-a", "lines": [[1, 2], [5, 6]], "highlight": [[5, 5]]}
```

**Title:** ขั้นที่ 1: ประกาศ tool

**Body:** ใส่ `@tool` บนฟังก์ชันธรรมดาให้กลายเป็น tool

```python
from langchain.agents import create_agent
from langchain_core.tools import tool
@tool
def get_weather(city: str) -> str:
```

### 1-012 · code

```slide
{"layout": "code", "purpose": "เห็นการเรียก agent แล้วอ่านคำตอบ", "from": ["1.2/Worked example"], "sources": [], "snippet": "1.2-b", "lines": [[1, 3]], "highlight": [[2, 2]]}
```

**Title:** ขั้นที่ 2: เรียก agent

**Body:** ส่งข้อความเข้าไปใน `messages` แล้วอ่านข้อความสุดท้าย

**Notice:** โค้ดนี้ยังไม่ได้ทดสอบจริง เพราะต้องใช้ API key

```python
agent = create_agent("openai:gpt-5", tools=[get_weather])
result = agent.invoke({"messages": [{"role": "user", "content": "สวัสดี"}]})
print(result["messages"][-1].content)
```

### 1-013 · output

```slide
{"layout": "output", "purpose": "รู้ว่าผลลัพธ์หน้าตาประมาณไหน", "from": ["1.2/Worked example"], "sources": [], "snippet": "1.2-a"}
```

**Title:** ผลลัพธ์ที่ควรเห็น

**Body:** ผลลัพธ์นี้เป็นตัวอย่างประกอบ ข้อความจริงจะต่างไปบ้าง

```text illustrative
{'messages': [..., AIMessage(content='แดดออกที่ Bangkok')]}
```

### 1-014 · error

```slide
{"layout": "error", "purpose": "แก้ข้อผิดพลาดเรื่อง API key ได้", "from": ["1.2/Common errors and fixes"], "sources": []}
```

**Title:** เจอ AuthenticationError

**Symptom:** รันแล้วได้ error 401 ทันที

**Cause:** ยังไม่ได้ตั้งค่า `OPENAI_API_KEY` หรือ key ไม่ถูกต้อง

**Fix:** ตั้งค่า key ใหม่ แล้วเปิด terminal ใหม่

```text
openai.AuthenticationError: Error code: 401 - {'error': {'message': 'Incorrect API key provided'}}
```

### 1-015 · question

```slide
{"layout": "question", "purpose": "ทบทวนว่า agent เลือก tool อย่างไร", "from": ["1.2/Self-check"], "sources": []}
```

**Question:** agent รู้ได้อย่างไรว่าควรเรียก tool ไหน?

**Body:** ลองตอบในใจก่อน แล้วค่อยไปหน้าถัดไป

**Items:**
- จากชื่อและ docstring ของ tool
- จากลำดับของ tool ในรายการ

### 1-016 · answer

```slide
{"layout": "answer", "purpose": "ยืนยันคำตอบและโยงกลับไปที่โค้ด", "from": ["1.2/Self-check"], "sources": [], "revisit": "1-011"}
```

**Answer:** จากชื่อและ docstring ของ tool

**Why:** ตอนประกาศด้วย `@tool` ชื่อฟังก์ชันและ docstring กลายเป็นคำอธิบายที่ model อ่าน

## Closing

### 1-017 · practice

```slide
{"layout": "practice", "purpose": "ลองสร้าง tool ของตัวเอง", "from": ["Practice material"], "sources": []}
```

**Title:** ลองทำเอง

**Task:** สร้าง tool ชื่อ `get_time` แล้วเปลี่ยน ~~get_weather~~ ในรายการ tool เป็น tool ใหม่

**Items:**
- อย่าลืม docstring
- ลองถามว่า "ตอนนี้กี่โมง"

**Solution:** ทำตามนี้:
1. ประกาศ `get_time` ด้วย `@tool`
2. ส่ง `tools=[get_time]` ให้ `create_agent`

### 1-018 · summary

```slide
{"layout": "summary", "purpose": "ทบทวนวงรอบของ agent", "from": ["Core mental model"], "sources": []}
```

**Title:** สรุป

**Items:**
- agent คือ model ที่เรียก tool เป็นวงรอบ
- `@tool` เปลี่ยนฟังก์ชันให้เป็น tool ✅
- `create_agent` ทำวงรอบให้เรา

### 1-019 · sources

```slide
{"layout": "sources", "purpose": "รู้ว่าจะอ่านต่อที่ไหน", "from": ["Sources"], "sources": []}
```

**Title:** อ่านต่อ

**Items:**
- [LangChain: Agents](https://docs.langchain.com/oss/python/langchain/agents)
- [LangChain: Install](https://docs.langchain.com/oss/python/langchain/install)

## Diagrams

```diagram
{"id": "d-agent-loop", "title": "วงรอบของ agent", "canvas": [16, 8],
 "nodes": [{"id": "n-user", "label": "ผู้ใช้", "concept": "user", "at": [0, 3], "size": [2, 1]},
           {"id": "n-model", "label": "Model", "concept": "model", "at": [6, 1], "size": [3, 1]},
           {"id": "n-tool", "label": "Tool", "concept": "tool", "at": [6, 5], "size": [3, 1]},
           {"id": "n-api", "label": "OpenAI API", "concept": "provider", "at": [12, 1], "size": [3, 2]}],
 "edges": [{"id": "e-ask", "from": "n-user", "to": "n-model", "label": "คำถาม", "style": "solid"},
           {"id": "e-call", "from": "n-model", "to": "n-tool", "label": "tool call", "style": "solid"},
           {"id": "e-result", "from": "n-tool", "to": "n-model", "label": "ผลลัพธ์", "style": "dashed"},
           {"id": "e-answer", "from": "n-model", "to": "n-user", "label": "คำตอบ", "style": "solid"},
           {"id": "e-llm", "from": "n-model", "to": "n-api", "label": "เรียก API", "style": "dashed"},
           {"id": "e-hand", "from": "n-user", "to": "g-agent", "label": "ส่งงาน", "style": "dashed"}],
 "groups": [{"id": "g-agent", "label": "agent", "concept": "agent", "members": ["n-model", "n-tool"]}],
 "badges": [{"id": "b1", "n": 1, "near": "n-model"}, {"id": "b2", "n": 2, "near": "e-call"}, {"id": "b3", "n": 3, "near": "e-result"}],
 "notes": [{"id": "t-loop", "text": "วนจนได้คำตอบ", "near": "e-call"}]}
```

```diagram
{"id": "d-init", "title": "init_chat_model สร้างโมเดลจากชื่อ", "canvas": [16, 4],
 "nodes": [{"id": "n-start", "label": "เริ่ม", "concept": "event", "at": [0, 1], "size": [1, 1]},
           {"id": "n-name", "label": "\"openai:gpt-5\"", "concept": "value", "at": [2, 1], "size": [3, 1]},
           {"id": "n-init", "label": "init_chat_model", "concept": "function", "at": [6, 1], "size": [4, 1]},
           {"id": "n-chat", "label": "model", "concept": "model", "at": [11, 0], "size": [3, 1]},
           {"id": "n-cache", "label": "cache", "concept": "store", "at": [11, 2], "size": [3, 2]}],
 "edges": [{"id": "e-start", "from": "n-start", "to": "n-name", "label": "", "style": "solid"},
           {"id": "e-name", "from": "n-name", "to": "n-init", "label": "", "style": "solid"},
           {"id": "e-make", "from": "n-init", "to": "n-chat", "label": "", "style": "solid"},
           {"id": "e-keep", "from": "n-init", "to": "n-cache", "label": "", "style": "dashed"}],
 "groups": [], "badges": [], "notes": []}
```

## Code listings

### 1.2-a

```listing
{"snippet": "1.2-a", "status": "verified", "reason": ""}
```

```python
from langchain.agents import create_agent
from langchain_core.tools import tool

# A tool is a plain function with a docstring.
@tool
def get_weather(city: str) -> str:
    """Get the weather for a city."""
    return f"แดดออกที่ {city}"

agent = create_agent("openai:gpt-5", tools=[get_weather])
print(agent.invoke({"messages": [{"role": "user", "content": "อากาศที่ Bangkok?"}]}))
```

### 1.2-b

```listing
{"snippet": "1.2-b", "status": "unverified", "reason": "needs an API key"}
```

```python
agent = create_agent("openai:gpt-5", tools=[get_weather])
result = agent.invoke({"messages": [{"role": "user", "content": "สวัสดี"}]})
print(result["messages"][-1].content)
```
