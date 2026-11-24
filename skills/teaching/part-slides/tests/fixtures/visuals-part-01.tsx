// The Part's own drawing: a row of boxes, one of them marked.
import { roleColour, SketchRect } from '../components';

export function Strip({ values, mark }: { values: string[]; mark?: number }) {
  return (
    <svg className="rs-figure" viewBox="0 0 460 120" role="img" aria-label={values.join(', ')}>
      {values.map((value, i) => (
        <g key={value}>
          <SketchRect seedKey={`strip/${i}`} x={12 + i * 146} y={30} w={130} h={60} rounded stroke={i === mark ? roleColour('accent') : '#2b2b2b'} strokeWidth={i === mark ? 3 : 1.6} />
          <text x={12 + i * 146 + 65} y={60} textAnchor="middle" dominantBaseline="central" fontSize={22}>{value}</text>
        </g>
      ))}
    </svg>
  );
}
