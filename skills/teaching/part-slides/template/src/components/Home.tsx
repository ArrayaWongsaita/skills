import type { Progress } from '../progress';
import { iconUrl } from '../icon';
import { formatRoute } from '../router';
import { slideNumber, t } from '../strings';
import { SketchLine, SketchRect } from './sketch';
import type { PartMeta } from './types';

type Props = { course: { slug: string; title: string }; parts: PartMeta[]; progress: Record<number, Progress> };

export function Home({ course, parts, progress }: Props) {
  const language = parts[0]?.language ?? 'en';
  return (
    <main className="rs-home">
      <header>
        {iconUrl ? <img className="rs-home-icon" src={iconUrl} alt="" draggable={false} /> : null}
        <h1>{course.title}</h1>
        <p className="rs-muted">{t(language, 'homeSubtitle')}</p>
      </header>
      <ul className="rs-cards">
        {parts.map((part) => {
          const furthest = progress[part.part]?.furthest;
          const reached = furthest ? slideNumber(furthest) : null;
          const share = reached ? Math.min(1, reached / Math.max(1, part.slideCount)) : 0;
          return (
            <li key={part.part}>
              <a className="rs-card" href={formatRoute({ name: 'part', part: part.part })}>
                <svg className="rs-card-frame" viewBox="0 0 300 170" preserveAspectRatio="none" aria-hidden="true">
                  <SketchRect seedKey={`home/${part.slug}`} x={4} y={4} w={292} h={162} stroke="#2b2b2b" strokeWidth={1.4} />
                </svg>
                <span className="rs-card-kicker">Part {part.part}</span>
                <span className="rs-card-title">{part.title}</span>
                <span className="rs-muted">{t(part.language, 'slides', { n: part.slideCount })}</span>
                <span className="rs-muted">{reached ? t(part.language, 'readTo', { n: reached }) : t(part.language, 'notStarted')}</span>
                {reached ? (
                  <svg className="rs-card-progress" data-progress={share.toFixed(2)} viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true">
                    <SketchLine seedKey={`progress/${part.slug}`} x1={1} y1={3} x2={1 + share * 98} y2={3} stroke="#4a86c5" strokeWidth={2.2} roughness={0.6} />
                  </svg>
                ) : null}
              </a>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
