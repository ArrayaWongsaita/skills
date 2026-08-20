# Technical Teaching Storytelling

- Category / หมวด: `teaching`
- Skill source / source ของ skill: [`SKILL.md`](../../../skills/teaching/technical-teaching-storytelling/SKILL.md)
- Install source / source สำหรับติดตั้ง: `ArrayaWongsaita/skills`

## ภาษาไทย / Thai

### มีไว้ทำอะไร

ช่วย AI Agent ออกแบบ ปรับปรุง หรือตรวจบทเรียนด้าน Programming และ Software Engineering ด้วย Problem-Driven Learning และ Storytelling เพื่อให้ผู้เรียนเห็นปัญหาก่อน เข้าใจว่าทำไม Concept จึงเกิดขึ้น ทดลองใช้ และรู้ว่าเมื่อไรควรหรือไม่ควรใช้

### ควรใช้เมื่อไร

- ออกแบบ Lesson Plan, Tutorial, Workshop หรือ Course Module ด้านเทคนิค
- เตรียม Live Coding และ Hands-on Lab
- อธิบาย Concept ให้เห็น Motivation, Failure Mode และ Trade-off
- ปรับบทเรียนที่เริ่มด้วย Definition หรือ Syntax ให้เป็น Problem-Driven
- Review เนื้อหาการสอนว่าเชื่อม `Problem → Concept → Solution` ชัดเจนหรือไม่

รองรับหัวข้อ เช่น Backend, Frontend, Database, DevOps, System Design, Architecture, Testing, Security และ Distributed Systems

### ไม่ควรใช้เมื่อไร

ไม่ควรบังคับใช้ Storytelling แบบยาวกับคำถามเชิงข้อเท็จจริงสั้น ๆ, API lookup หรือคำขอที่ต้องการเพียง Syntax เฉพาะจุด หาก Concept ง่าย ให้ย่อ Framework เหลือเฉพาะส่วนที่ช่วยให้เข้าใจจริง

### วิธีทำงานหลัก

Skill จะวิเคราะห์ Learning Objective, Prerequisites, ปัญหาจริง, Naive Attempt, Failure, ข้อจำกัด, Demo ขั้นต่ำ, Practice และ Mental Model ก่อนออกแบบบทเรียน จากนั้นใช้ลำดับหลัก:

```text
Hook → Context → Problem → Naive Attempt → Failure → Question
     → Concept → Solution → Demo → Practice → Reflect
```

บทเรียนใช้ภาษาไทยเป็นหลักและคง Technical Terms ภาษาอังกฤษ เลือก Storytelling Framework ตามประเภทหัวข้อ ปรับความลึกตามระดับผู้เรียน และตรวจว่าความล้มเหลวที่ใช้สอนเกิดขึ้นได้จริง ไม่ได้สร้างขึ้นเพื่อบังคับใช้ Technology

### ตัวอย่าง prompt

```text
ใช้ $technical-teaching-storytelling ออกแบบบทเรียน Live Coding 90 นาทีเรื่อง Dependency Injection ใน NestJS สำหรับผู้เรียนระดับ Intermediate พร้อม Failure Demo, Hands-on Lab 3 ระดับ และ Reflection Questions
```

### ติดตั้ง

```bash
npx skills add ArrayaWongsaita/skills --skill technical-teaching-storytelling
```

### ไฟล์ที่เกี่ยวข้อง

- `SKILL.md` — หลักการ, workflow, audience adaptation และ technical guardrails
- `references/lesson-blueprint.md` — playbook แบบเต็ม, framework selection, output template และตัวอย่าง Dependency Injection/Kafka
- `agents/openai.yaml` — metadata สำหรับ Codex UI และ implicit invocation

## English / ภาษาอังกฤษ

### Purpose

Helps an AI agent design, revise, or review programming and software-engineering instruction with problem-driven storytelling. Learners encounter a realistic problem first, discover why a concept exists, apply it, and reason about when it is or is not appropriate.

### Use it when

- Designing technical lesson plans, tutorials, workshops, or course modules
- Preparing live-coding sessions and hands-on labs
- Explaining a concept through its motivation, failure mode, and trade-offs
- Reworking definition-first or syntax-first material into problem-driven instruction
- Reviewing whether a lesson clearly connects `Problem → Concept → Solution`

It supports backend, frontend, databases, DevOps, system design, architecture, testing, security, distributed systems, and related technical concepts.

### Do not use it when

Do not force a long story onto a short factual question, API lookup, or narrow syntax request. For a simple concept, compress the framework to only the stages that improve understanding.

### Main workflow

The skill first determines the learning objective, prerequisites, realistic problem, naive attempt, concrete failure, remaining limits, smallest demo, progressive practice, and desired mental model. It then uses:

```text
Hook → Context → Problem → Naive Attempt → Failure → Question
     → Concept → Solution → Demo → Practice → Reflect
```

Lessons default to Thai while preserving English technical terms. The skill selects a storytelling pattern appropriate to the topic, adapts depth to the audience, and verifies that each failure is technically plausible rather than invented to justify a technology.

### Example prompt

```text
Use $technical-teaching-storytelling to design a 90-minute live-coding lesson about Dependency Injection in NestJS for intermediate learners, including a failure demo, a three-level hands-on lab, and reflection questions.
```

### Install

```bash
npx skills add ArrayaWongsaita/skills --skill technical-teaching-storytelling
```

### Related files

- `SKILL.md` — principles, workflow, audience adaptation, and technical guardrails
- `references/lesson-blueprint.md` — expanded playbook, framework selection, output template, and Dependency Injection/Kafka examples
- `agents/openai.yaml` — Codex UI metadata and implicit-invocation policy
