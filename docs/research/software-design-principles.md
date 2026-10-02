# หลักการออกแบบ Software ที่ใช้ได้ทุกส่วน (Research Digest)

- **สถานะ:** เอกสารอ้างอิง (reference) ไม่ใช่ ADR และไม่ใช่การตัดสินใจของ repo นี้
- **วันที่ค้นคว้า:** 2026-10-01
- **วิธีการ:** รวบรวมจากงานต้นฉบับและบทความของผู้เชี่ยวชาญ แล้วกรองเป็นแนวทาง ตรวจแหล่งผ่านการเปิดอ่านหรือค้นหาในรอบนั้น (ดู [ข้อจำกัด](#ข้อจำกัดของการศึกษา))
- **คำถามตั้งต้น:** Atomic Design (สร้างส่วนเล็กแล้วประกอบกัน) ใช้กับ software ส่วนอื่นได้ไหม และมีแนวทางใดที่ใช้ได้กับงาน software ทุกส่วน

## 1. หลักเดียว และกฎตัดสิน

**หลักเดียว:** ควบคุมระยะทางของ ripple effect (การเปลี่ยนที่หนึ่งต้องไม่ลามไปทั่ว) และภาระความคิดของคนอ่าน Atomic, Separation of Concerns, modules, layers, services เป็นเครื่องมือของเป้าหมายนี้

**กฎตัดสินว่าจะแยกหรือไม่:** แยกเมื่อ **ประโยชน์** (กักการเปลี่ยน, ทำงานคู่ขนาน, ทดสอบแยก) มากกว่า **ต้นทุน** (interface, ที่ต้องอ่านเพิ่ม, โหมดล้มเหลวใหม่) ถ้าไม่ชัด ให้รวมไว้ก่อน

## 2. Atomic Design ใช้นอก UI ได้แค่ไหน

- ต้นฉบับ (Brad Frost) เป็น **mental model ไม่ใช่กระบวนการเป็นขั้นตอน** และบอกเองว่าชื่อชั้นปรับได้ ([ch.2](https://atomicdesign.bradfrost.com/chapter-2/))
- ส่วนที่ใช้ได้นอก UI คือ **การประกอบเป็นชั้น โดยชั้นบนพึ่งชั้นล่างเท่านั้น**
- การเทียบกับโค้ด (เป็นการเทียบของผู้ค้นคว้า ไม่ใช่มาตรฐาน): utility pure → ฟังก์ชันที่ต่อกัน → service → orchestration ที่ต่อกับ I/O
- ตัวคุมไม่ให้แยกเล็กเกินคือหลัก 6 (interface ลึก) และหลัก 10 (สร้าง abstraction ช้า)
- Separation of Concerns เป็นเกณฑ์ว่า "แยกอะไร" ส่วนการประกอบเป็นชั้นเป็นวิธีต่อ ทั้งสองใช้คู่กัน

## 3. หลักการ 13 ข้อ (4 กลุ่ม)

### A. ตัดตรงไหน
1. **ตัดตามสิ่งที่จะเปลี่ยน** (Parnas 1972) ถามว่า "ถ้า X เปลี่ยน แก้กี่ที่"
2. **ตัดให้ตรงภาษาโดเมนและทีม** (DDD Bounded Context, Conway/mirroring)
3. **ตัดเส้นแบ่งที่ย้ายยาก (service, package ที่ publish) ทีหลัง หลังเห็นของจริง** ภายใน process เดียวตัดผิดแล้วแก้ง่ายกว่า (Fowler, Monolith First)

### B. ต่อกันอย่างไร
4. **dependency ไหลทางเดียว ไม่เป็นวง ชี้ไปหาสิ่งที่นิ่งกว่า** (Parnas 1979 "uses relation", Martin ADP/SDP) ให้ A ใช้ B ได้เมื่อครบ 4 ข้อ: A ง่ายขึ้นมาก, B ไม่ซับซ้อนขึ้นมากเมื่อไม่ใช้ A, มี subset ที่มี B ไม่มี A ที่ใช้ได้, ไม่มี subset ที่มี A ไม่มี B ที่ใช้ได้
5. **เริ่มจาก minimal subset ที่ใช้ได้จริง แล้วเพิ่มทีละ increment** (Parnas 1979)
6. **interface เล็ก ข้างในลึก ชิ้นต่อกันโดยไม่พัน** (Ousterhout, Hickey) การแยกเล็กลงไม่ใช่ความดีในตัว (Martin และ Ousterhout ยอมรับตรงกันว่าแยกเกินได้)

### C. พฤติกรรมที่ขอบ
7. **interface คือสัญญา ไม่ใช่แค่ signature** ระบุ precondition, postcondition, invariant และเขียนคอมเมนต์ในจุดที่โค้ดบอกเองไม่ได้ (Meyer, Liskov)
8. **เปิดเผยพฤติกรรมให้น้อยที่สุดเท่าที่จำเป็น และเปลี่ยนแบบเพิ่ม ไม่ใช่แก้ความหมายเดิม** (Hyrum's Law, Hickey accretion)
9. **แกนตัดสินใจเป็น pure ล้อมด้วยขอบ I/O** (Bernhardt, Cockburn, Moseley & Marks) และอย่าคิดว่า event-driven ตัดการพึ่งพา มันย้ายไปอยู่ที่ schema ของ event และเวลา/ลำดับ

### D. วิวัฒนาการและการตรวจสอบ
10. **สร้าง abstraction ช้า ย้อนกลับได้ ระวัง "ซ้ำโดยบังเอิญ"** (Metz, Rule of Three)
11. **เข้าใจก่อนลบ** (Chesterton's fence)
12. **ทดสอบที่พฤติกรรม ไม่ผูกกับโครงสร้างภายใน** เพื่อให้ refactor ได้ (Beck, Test Desiderata)
13. **ตรวจกฎโครงสร้างอัตโนมัติ** (Ford, fitness functions) เช่น ห้าม import ย้อนทิศหรือเป็นวง ใช้ตัวชี้วัด (เช่น Cognitive Complexity) เป็นสัญญาณเตือน ไม่ใช่ตัวตัดสิน

## 4. Anti-patterns

| อาการ | หลักที่เกี่ยวข้อง |
|---|---|
| แก้ที่เดียวต้องตามแก้อีกหลายที่ | 1, 4 (information spreading) |
| import เป็นวง | 4 (Parnas: "ไม่มีอะไรทำงานจนกว่าทุกอย่างจะทำงาน") |
| ฟังก์ชัน/คลาสจิ๋วจำนวนมากที่ต้องรู้ลำดับการเรียก | 6 (shallow modules, classitis) |
| abstraction เต็มไปด้วย flag และ if | 10 (wrong abstraction) |
| แยก service ก่อนรู้เส้นแบ่ง | 3 |
| ใช้ event แล้วคิดว่า decoupled | 9 |
| test พังทุกครั้งที่ refactor | 12 |
| ผู้ใช้พึ่งพฤติกรรมที่ไม่ได้สัญญา | 8 |
| ลบของที่ไม่เข้าใจ | 11 |

## 5. ความน่าเชื่อถือของหลักฐาน

| ระดับ | หลักการ | เหตุผล |
|---|---|---|
| **แข็ง** | 1, 2, 4 | Parnas เทียบการออกแบบ 2 แบบกับเกณฑ์เดียวกัน, Conway/mirroring มีงานเชิงประจักษ์ (MacCormack, Baldwin, Rusnak), เหตุผลเชิงโครงสร้างเป็นที่ยอมรับ |
| **ปานกลาง** | 7, 13 | contract มีทฤษฎีรองรับ, coupling สัมพันธ์กับ defect (Basili, Briand) และ loose coupling สัมพันธ์กับการส่งมอบ (DORA) แต่เป็นความสัมพันธ์จากสหสัมพันธ์/แบบสำรวจ ไม่ใช่เหตุและผล, Cognitive Complexity สัมพันธ์กับความเข้าใจโค้ดระดับปานกลาง (r ≈ 0.40) |
| **อ่อน** (heuristic ที่ผู้เชี่ยวชาญส่วนใหญ่เห็นพ้อง) | 3, 5, 6, 8, 9, 10, 11, 12 | มาจากประสบการณ์และกรณีศึกษา ไม่มีการทดลองควบคุม Fowler เองเรียก "design stamina hypothesis" ว่าเป็น conjecture เพราะวัด productivity และคุณภาพ design ไม่ได้ |
| **ยังเถียงกัน** | ความยาวฟังก์ชัน, คอมเมนต์ vs ชื่อ, TDD วนถี่ vs เป็นก้อน, SOLID vs CUPID, microservices-first | ผู้เชี่ยวชาญเห็นต่างกันเอง เลือกตามบริบทและตรวจกับโปรเจกต์จริง |

## 6. ข้อวิจารณ์แนวคิดคลาสสิก (ไม่ควรยึดตรงๆ)

- **"cohesion สูง coupling ต่ำ"**: ถูกวิจารณ์ว่าขัดกันเองและคลุมเครือ (Kirwan) และการเพิ่ม cohesion โดยไม่คิดต้นทุน interface อาจเป็นอันตราย (Homay) ให้ใช้คำถาม "ripple ลามไกลแค่ไหน" แทน
- **SOLID**: ยังเถียงกัน (North เสนอ CUPID, มีผู้โต้ว่าเขาบิดเบือนบางส่วน) ใช้ส่วนที่ซ้ำกับหลักข้างบนก็พอ
- **สัดส่วน essential/accidental ของ Brooks**: ใช้เป็นแว่นตรวจได้ แต่ตัวเลขถูกท้าทาย (Dan Luu)
- **Rule of Three**: เป็น heuristic ของผู้ปฏิบัติ ไม่พบงานทดลองที่พิสูจน์ตัวเลข 3
- **Microservices**: ผลเปรียบเทียบประสิทธิภาพและการบำรุงรักษากับ monolith ไม่ตรงกันและขึ้นกับบริบท Fowler ระบุเองว่าคำแนะนำ monolith-first ยัง "tentative" และกรณีศึกษา Carbon Health เป็นกรณีเดียว
- **โค้ดจาก AI**: GitClear (211 ล้านบรรทัด) รายงานว่าสัดส่วนโค้ดที่ถูก refactor ลดลงและโค้ดซ้ำเพิ่มขึ้นในช่วง 2020-2024 แต่เป็นรายงานของบริษัทเครื่องมือ เป็นความสัมพันธ์เชิงเวลา และงานอื่นรายงานผลต่างกัน อ่านเป็นสัญญาณ ไม่ใช่ข้อพิสูจน์

## 7. ข้อจำกัดของการศึกษา

- หลายแหล่งอ่านผ่านบทสรุปหรือบทความรอง: Parnas 1979 (สรุปโดย Acolyer), Clean Architecture, Brooks, Constantine
- Parnas 1972 อ่านฉบับเต็มผ่านตัวสรุปอัตโนมัติของเครื่องมือค้นเว็บ ไม่ได้อ่านเองทุกบรรทัด
- งาน "On a 'Buzzword': Hierarchical Structure" (Parnas 1974) ได้เพียงบทคัดย่อ ไม่ได้ใช้เป็นหลักฐาน
- กรณีศึกษา (Carbon Health, Amazon Prime Video) เป็นตัวอย่างเดี่ยว
- ยังไม่ครอบคลุมเชิงลึก: การออกแบบข้อมูล/schema evolution, concurrency และ error handling เชิงสถาปัตยกรรม, security by design, observability, งานวิจัยหลังปี 2020 ส่วนใหญ่

## 8. แหล่งอ้างอิง

**ต้นฉบับและงานวิชาการ**
- Parnas 1972, [On the Criteria To Be Used in Decomposing Systems into Modules](https://wstomv.win.tue.nl/edu/2ip30/references/criteria_for_modularization.pdf)
- Parnas 1979, [Designing Software for Ease of Extension and Contraction](https://blog.acolyer.org/2016/10/31/designing-software-for-ease-of-extension-and-contraction/) (สรุปโดย Acolyer)
- Parnas 1974, [On a 'Buzzword': Hierarchical Structure](https://link.springer.com/chapter/10.1007/978-3-642-48354-7_21) (บทคัดย่อ)
- Dijkstra, [On the role of scientific thought (EWD447)](https://www.cs.utexas.edu/~EWD/transcriptions/EWD04xx/EWD447.html)
- Stevens, Myers, Constantine 1974, [Structured Design](https://www.semanticscholar.org/paper/Structured-design-Stevens-Myers/7a5da77e5be0ac7e790936959974e7265df7e51b)
- Meyer, [Design by Contract](https://se.inf.ethz.ch/~meyer/publications/old/dbc_chapter.pdf)
- Brooks 1986, [No Silver Bullet](https://worrydream.com/refs/Brooks_1986_-_No_Silver_Bullet.pdf)
- Moseley & Marks, [Out of the Tar Pit](https://curtclifton.net/papers/MoseleyMarks06a.pdf)
- Baldwin & Clark, [Design Rules, Vol. I](https://www.researchgate.net/publication/227458384_Design_Rules_Volume_I_The_Power_of_Modularity)
- MacCormack, Baldwin, Rusnak, [Test of the Mirroring Hypothesis](https://www.researchgate.net/publication/5092420_Exploring_the_Duality_Between_Product_and_Organizational_Architectures_A_Test_of_the_Mirroring_Hypothesis)
- [Coupling/cohesion vs fault-proneness (survey)](https://arxiv.org/pdf/1201.3078)
- Barón, Wyrich, Wagner, [Cognitive Complexity validation](https://dl.acm.org/doi/10.1145/3382494.3410636)
- [Lehman's laws, empirical review](https://oa.upm.es/20813/1/herraiz_csur.pdf)
- [Incidents During Microservice Decomposition (Carbon Health)](https://arxiv.org/pdf/2505.09813)
- [Team Topologies evidence assessment](https://arxiv.org/pdf/2302.00033)

**ผู้เชี่ยวชาญและหนังสือ (ผ่านบทสรุป)**
- Frost, [Atomic Design ch.2](https://atomicdesign.bradfrost.com/chapter-2/)
- Ousterhout, [A Philosophy of Software Design (สรุป)](https://www.briansnotes.io/book/a-philosophy-of-software-design/)
- Ousterhout & Martin, [aposd-vs-clean-code](https://github.com/johnousterhout/aposd-vs-clean-code)
- Hickey, [Simple Made Easy (notes)](https://dev.to/sylwiavargas/talk-notes-simple-made-easy-by-rich-hickey-2011-39oo), [Spec-ulation (notes)](https://blog.ezyang.com/2016/12/thoughts-about-spec-ulation-rich-hickey/)
- Metz, [The Wrong Abstraction](https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction)
- Fowler, [Design Stamina Hypothesis](https://martinfowler.com/bliki/DesignStaminaHypothesis.html), [Bounded Context](https://martinfowler.com/bliki/BoundedContext.html), [Monolith First](https://martinfowler.com/bliki/MonolithFirst.html)
- Bernhardt, [Functional Core / Imperative Shell (อธิบาย)](https://dev.to/gabrielanhaia/functional-core-imperative-shell-in-go-where-side-effects-belong-3c8n)
- Cockburn, [Hexagonal architecture](https://en.wikipedia.org/wiki/Hexagonal_architecture_(software))
- Martin, [Acyclic Dependencies Principle](https://en.wikipedia.org/wiki/Acyclic_dependencies_principle)
- Ford et al., [Building Evolutionary Architectures](https://www.thoughtworks.com/content/dam/thoughtworks/documents/books/bk_building_evolutionary_architectures_en.pdf)
- Beck, [Test Desiderata](https://kentbeck.github.io/TestDesiderata/)
- Wright, [Hyrum's Law](https://nordicapis.com/what-does-hyrums-law-mean-for-api-design/)
- [DORA: loosely coupled teams](https://dora.dev/capabilities/loosely-coupled-teams/)
- [Event-driven ≠ loosely coupled (EIP)](https://www.enterpriseintegrationpatterns.com/ramblings/eventdriven_coupling.html)

**ข้อวิจารณ์**
- Kirwan, [Coupling and cohesion: failed concepts](https://www.edmundkirwan.com/general/c-and-c.html)
- Homay, [The Mythical Good Software](https://arxiv.org/html/2507.09596v1)
- Luu, [Against essential and accidental complexity](https://danluu.com/essential-complexity/)
- North, [CUPID vs SOLID (สรุป)](https://www.nogginbox.co.uk/blog/cupid)
- GitClear, [AI code quality 2025](https://www.gitclear.com/ai_assistant_code_quality_2025_research)
- [Rule of Three](https://en.wikipedia.org/wiki/Rule_of_three_(computer_programming))
