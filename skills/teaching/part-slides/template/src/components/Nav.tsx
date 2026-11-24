import { formatRoute } from '../router';
import { t } from '../strings';

type Props = { language: string; index: number; total: number; onPrev: () => void; onNext: () => void };

export function Nav({ language, index, total, onPrev, onNext }: Props) {
  return (
    <nav className="rs-nav">
      <a className="rs-nav-home" href={formatRoute({ name: 'home' })}>
        {t(language, 'home')}
      </a>
      <div className="rs-nav-pager">
        <button type="button" aria-label={t(language, 'prev')} disabled={index <= 0} onClick={onPrev}>
          ‹
        </button>
        <span aria-live="polite">
          {index + 1} / {total}
        </span>
        <button type="button" aria-label={t(language, 'next')} disabled={index >= total - 1} onClick={onNext}>
          ›
        </button>
      </div>
    </nav>
  );
}
