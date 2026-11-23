## Closing

### 1-030 · assemble

```slide
{"layout": "assemble", "purpose": "เห็นภาพรวมทั้ง Part: แต่ละบทเติมส่วนไหนของ agent", "from": ["Core mental model"], "sources": [], "assembles": "part", "labels": [{"chapter": "1.1", "elements": ["n-model"]}, {"chapter": "1.2", "elements": ["n-tool", "e-call", "e-result"]}]}
```

**Title:** ประกอบร่างทั้ง Part

**Body:** บทแรกให้โมเดล บทที่สองเพิ่ม tool กับวงรอบเรียก tool ทั้งหมดรวมกันเป็น agent ตัวแรกของเรา

```visual
{"kind": "diagram", "diagram": "d-agent-loop", "show": ["n-user", "n-model", "n-tool", "e-ask", "e-call", "e-result", "e-answer", "g-agent"], "new": [], "highlight": [], "dim": []}
```

### 1-031 · summary

```slide
{"layout": "summary", "purpose": "ทบทวนภาพรวมทั้ง Part ในภาพเดียว", "from": ["Core mental model"], "sources": []}
```

**Title:** สรุป: agent คือ model + tool + วงรอบ

**Items:**
- agent = โมเดล + tool + วงรอบ
- วงรอบคือ คิด → เรียก tool → อ่านผล จนได้คำตอบ

```visual
{"kind": "diagram", "diagram": "d-agent-loop", "show": ["n-user", "n-model", "e-ask", "e-answer", "n-tool", "e-call", "e-result", "g-agent"], "new": [], "highlight": [], "dim": []}
```

### 1-032 · practice

```slide
{"layout": "practice", "purpose": "ลองต่อยอด agent ด้วยตัวเอง", "from": ["Practice material"], "sources": []}
```

**Title:** ลองทำเอง: เพิ่ม tool ตัวที่สอง

**Task:** เพิ่ม tool `get_time(city)` แล้วถามคำถามที่ต้องใช้ทั้งสอง tool

**Items:**
- เริ่มจากโค้ดของ `get_weather` แล้วประกาศ tool ใหม่ด้วย `@tool`
- อย่าลืมใส่ docstring
- ใส่ tool ใหม่ในรายการ `tools`

### 1-033 · focus

```slide
{"layout": "focus", "purpose": "เชื่อมไป Part 2 ที่จะเปิดดูข้างใน agent", "from": ["Bridge to next part"], "sources": []}
```

**Title:** ต่อไป: เปิดดูข้างใน agent

**Body:** Part 2 จะเปิดดูข้างในกรอบ agent นี้ด้วย StateGraph

```visual
{"kind": "diagram", "diagram": "d-agent-loop", "show": ["n-user", "n-model", "e-ask", "e-answer", "n-tool", "e-call", "e-result", "g-agent"], "new": [], "highlight": ["g-agent"], "dim": []}
```

### 1-034 · sources

```slide
{"layout": "sources", "purpose": "บอกแหล่งอ่านต่อและแหล่งอ้างอิงของ Part นี้", "from": ["Further reading", "Sources"], "sources": ["https://docs.langchain.com/oss/python/releases/langchain-v1", "https://docs.langchain.com/oss/python/langchain/overview"]}
```

**Title:** อ่านต่อและแหล่งอ้างอิง

**Items:**
- อ่านต่อ: [LangChain v1 release notes](https://docs.langchain.com/oss/python/releases/langchain-v1)
- แหล่งอ้างอิง: [LangChain overview](https://docs.langchain.com/oss/python/langchain/overview)
