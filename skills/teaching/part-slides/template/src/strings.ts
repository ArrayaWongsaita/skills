// Interface text. Thai and English ship with the template; other languages fall back to English.
const en = {
  copyLines: 'Copy these lines',
  copyAll: 'Copy the full program',
  copy: 'Copy',
  copied: 'Copied ✓',
  copyFailed: 'Could not copy: select the text instead',
  prev: 'Previous slide',
  next: 'Next slide',
  home: 'All parts',
  revisit: 'Go back to slide {n}',
  slides: '{n} slides',
  readTo: 'Read to slide {n}',
  notStarted: 'Not started',
  homeSubtitle: 'Choose a part to start reading',
  illustrative: 'Illustrative output',
  scrollHint: 'Scroll for more',
  opening: 'Opening',
  closing: 'Closing',
  sources: 'Sources',
  symptom: 'Symptom',
  cause: 'Cause',
  fix: 'Fix',
  why: 'Why',
  hints: 'Hints',
  solution: 'Show the solution',
  unit: 'Unit {n}/{m}',
  phaseKnow: 'Know it',
  phaseParts: 'Parts',
  phaseExample: 'Examples',
  phaseWatchout: 'Watch out',
  phaseCheck: 'Check',
  nextTopic: 'Next topic {n}/{m}',
};

export type StringKey = keyof typeof en;

const th: Record<StringKey, string> = {
  copyLines: 'คัดลอกส่วนนี้',
  copyAll: 'คัดลอกโปรแกรมเต็ม',
  copy: 'คัดลอก',
  copied: 'คัดลอกแล้ว ✓',
  copyFailed: 'คัดลอกไม่ได้ ให้เลือกข้อความแทน',
  prev: 'หน้าก่อน',
  next: 'หน้าถัดไป',
  home: 'ทุก Part',
  revisit: 'กลับไปดูหน้า {n}',
  slides: '{n} หน้า',
  readTo: 'อ่านถึงหน้า {n}',
  notStarted: 'ยังไม่เริ่ม',
  homeSubtitle: 'เลือก Part ที่จะเริ่มอ่าน',
  illustrative: 'ผลลัพธ์ตัวอย่าง',
  scrollHint: 'เลื่อนดูต่อ',
  opening: 'เปิดบท',
  closing: 'ปิดบท',
  sources: 'แหล่งที่มา',
  symptom: 'อาการ',
  cause: 'สาเหตุ',
  fix: 'วิธีแก้',
  why: 'เพราะ',
  hints: 'คำใบ้',
  solution: 'ดูเฉลย',
  unit: 'เรื่อง {n}/{m}',
  phaseKnow: 'รู้จัก',
  phaseParts: 'ส่วนประกอบ',
  phaseExample: 'ตัวอย่าง',
  phaseWatchout: 'ระวัง',
  phaseCheck: 'ทบทวน',
  nextTopic: 'หัวข้อถัดไป {n}/{m}',
};

const languages: Record<string, Record<StringKey, string>> = { en, th };

export function t(language: string, key: StringKey, vars: Record<string, string | number> = {}): string {
  const text = (languages[language.toLowerCase().split('-')[0]] ?? en)[key];
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

/** The number in a slide id such as `1-025`, for "slide 25". */
export function slideNumber(id: string): number | null {
  const match = /^\d+-(\d+)$/.exec(id);
  return match ? Number(match[1]) : null;
}
