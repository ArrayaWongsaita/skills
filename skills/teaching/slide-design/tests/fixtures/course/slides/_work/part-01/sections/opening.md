## Opening

### 1-001 · cover

```slide
{"layout": "cover", "purpose": "บอกว่า Part นี้จะพาไปสร้างอะไร", "from": ["Real-world task"], "sources": []}
```

**Title:** Agent ตัวแรกด้วย `create_agent`

**Body:** ใน Part นี้เราจะสร้างผู้ช่วยตอบคำถามสภาพอากาศ 🌤️ ตั้งแต่บรรทัดแรก

### 1-002 · focus

```slide
{"layout": "focus", "purpose": "เห็นภาพผู้ช่วยจากข้างนอกก่อน: ถามเข้าไป คำตอบออกมา", "from": ["Real-world task"], "sources": []}
```

**Title:** ผู้ช่วยรับคำถามแล้วส่งคำตอบกลับ

**Body:** ผู้ใช้ถามว่า "อากาศที่กรุงเทพเป็นอย่างไร" แล้วได้คำตอบกลับมา ตอนนี้ให้ดูแค่สองฝั่งนี้ก่อน ข้างในทำงานอย่างไรเราจะค่อย ๆ เปิดดู

```visual
{"kind": "diagram", "diagram": "d-agent-loop", "show": ["n-user", "n-model", "e-ask", "e-answer"], "new": ["n-user", "n-model", "e-ask", "e-answer"], "highlight": [], "dim": []}
```

### 1-003 · map

```slide
{"layout": "map", "purpose": "เห็นเส้นทางของ Part ก่อนเริ่ม: มีบทไหน แต่ละบทมีเรื่องอะไร", "from": ["Objectives"], "sources": []}
```

**Title:** เส้นทางของ Part นี้

### 1-004 · objectives

```slide
{"layout": "objectives", "purpose": "รู้ว่าจบ Part นี้แล้วจะทำอะไรได้", "from": ["Objectives"], "sources": []}
```

**Title:** จบ Part นี้แล้วคุณจะทำได้

**Items:**
1. สร้าง agent ที่เรียกใช้ tool ได้
2. บอกได้ว่าโค้ดไหนเป็นแบบก่อน 1.0

### 1-005 · setup

```slide
{"layout": "setup", "purpose": "เตรียมเครื่องให้พร้อมรันโค้ดใน Part นี้", "from": ["Prerequisites and setup"], "sources": []}
```

**Title:** เตรียมเครื่องก่อนเริ่ม

**Items:**
- ใช้ Python 3.12
- ติดตั้งแพ็กเกจตามเวอร์ชันที่คอร์สนี้ทดสอบแล้ว ด้วยคำสั่งด้านล่าง

```text
pip install langchain==1.5.2 langgraph==1.2.24 langchain-openai==1.8.5
```

### 1-006 · terms

```slide
{"layout": "terms", "purpose": "รู้จักคำว่า Agent ก่อนใช้ในสไลด์ถัดไป", "from": ["Key terms"], "sources": []}
```

**Title:** คำที่ต้องรู้ก่อน

**Items:**
- Agent (เอเจนต์): โมเดลที่ตัดสินใจเรียก tool เองเป็นวงรอบ

### 1-007 · steps

```slide
{"layout": "steps", "purpose": "เห็นวงรอบของ agent ครบทั้งสามขั้น", "from": ["Core mental model"], "sources": []}
```

**Title:** ข้างใน agent คือวงรอบสามขั้น

**Items:**
1. คิด: model อ่านคำถามแล้วตัดสินใจว่าต้องใช้ tool ไหม
2. เรียก tool: model ขอให้เรียก tool ที่เลือก
3. อ่านผล: model อ่านผลจาก tool แล้ววนคิดต่อจนได้คำตอบ

```visual
{"kind": "diagram", "diagram": "d-agent-loop", "show": ["n-user", "n-model", "n-tool", "e-ask", "e-call", "e-result", "e-answer", "g-agent", "b1", "b2", "b3"], "new": ["n-tool", "e-call", "e-result", "g-agent", "b1", "b2", "b3"], "highlight": [], "dim": []}
```
