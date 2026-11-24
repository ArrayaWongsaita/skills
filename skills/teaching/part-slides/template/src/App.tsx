import { lazy, Suspense, useEffect, useMemo } from 'react';
import { CheckPage } from './check/CheckPage';
import { Home } from './components/Home';
import { course } from './course';
import { listParts, type PartEntry } from './parts';
import { loadProgress } from './progress';
import { useRoute } from './router';

function PartView({ entry }: { entry: PartEntry }) {
  const Part = useMemo(() => lazy(entry.load), [entry]);
  return (
    <Suspense fallback={null}>
      <Part />
    </Suspense>
  );
}

export function App() {
  const route = useRoute();
  const parts = useMemo(listParts, []);
  const entry = route.name === 'home' ? undefined : parts.find((part) => part.meta.part === route.part);
  const language = entry?.meta.language ?? parts[0]?.meta.language ?? 'en';

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = entry ? `${entry.meta.title} · ${course.title}` : course.title;
  }, [language, entry]);

  if (!entry) {
    const progress = Object.fromEntries(parts.map((part) => [part.meta.part, loadProgress(part.meta.course, part.meta.part)]));
    return <Home course={course} parts={parts.map((part) => part.meta)} progress={progress} />;
  }
  if (route.name === 'check') return <CheckPage key={entry.meta.part} entry={entry} />;
  return <PartView key={entry.meta.part} entry={entry} />;
}
