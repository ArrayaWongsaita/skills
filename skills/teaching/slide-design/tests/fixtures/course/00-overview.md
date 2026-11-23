---
template: "course-research/overview@1"
course: "langchain-langgraph"
title: "LangChain และ LangGraph สำหรับผู้เริ่มต้น"
research_date: "2026-11-22"
versions: {"langchain": "1.5.2", "langgraph": "1.2.24"}
---
# LangChain และ LangGraph สำหรับผู้เริ่มต้น

## Scope

ผู้เรียนเขียน Python ได้ เรียนด้วยตัวเองแบบ self-paced เนื้อหาเป็นภาษาไทย

## Learning outcomes

- **O1** สร้าง agent ที่เรียกใช้ tool ได้ด้วย create_agent
- **O2** สร้าง StateGraph ที่มี node และ edge ได้
- **O3** แยกโค้ดแบบเก่าก่อน 1.0 ออกจากแบบปัจจุบันได้

## Part map

| # | Title | Outcomes | Prerequisite parts | Summary |
|---|---|---|---|---|
| 1 | Agent ตัวแรกด้วย create_agent | O1, O3 | — | เรียกโมเดลและสร้าง agent ที่ใช้ tool |
| 2 | เปิดดูข้างในด้วย StateGraph | O2 | 1 | สร้างกราฟเองทีละ node |

## Prerequisite map

- Part 1 → Part 2 (Strong: ลำดับในเอกสารทางการ)

## Glossary

| Term | Meaning | English term |
|---|---|---|
| เอเจนต์ | โมเดลที่ตัดสินใจเรียก tool เองเป็นวงรอบ | Agent |

## Freshness

อ้างอิง langchain 1.5.2 และ langgraph 1.2.24 ค้นคว้าเมื่อ 2026-11-22

## Out of scope and further reading

- LangSmith ([Docs](https://docs.langchain.com/langsmith/home))
