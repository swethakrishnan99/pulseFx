import { useId, useState } from "react";

const W = 320, PL = 38, PR = 8, PT = 8;

const monthShort = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
const dayShort = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
const dayMonth = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export default function RateChart({ points, period, label, onHover, compact = false }) {
  const H = compact ? 118 : 150;
  const PB = compact ? 20 : 22;
  const gid = useId();
  const [hover, setHover] = useState(null);
  const n = points.length;
  if (n < 2) return <p className="text-xs text-gray-400 py-10 text-center">Not enough data to draw this chart.</p>;

  const vals = points.map((p) => p.value);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const pad = (hi - lo) * 0.15 || hi * 0.01;
  const min = lo - pad;
  const max = hi + pad;
  const x = (i) => PL + (i / (n - 1)) * (W - PL - PR);
  const y = (v) => PT + (1 - (v - min) / (max - min)) * (H - PT - PB);

  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)} ${H - PB} L${x(0).toFixed(1)} ${H - PB} Z`;

  const digits = hi - lo > 0.08 ? 2 : 3;
  const yTicks = [hi, (hi + lo) / 2, lo];
  const monthYear = (d) => `${monthShort(d)} \u2019${d.slice(2, 4)}`;
  const xFmt = period === "D" ? dayShort : period === "W" ? dayMonth : period === "Y" ? monthYear : monthShort;
  const xIdx = [0, Math.round((n - 1) / 3), Math.round(((n - 1) * 2) / 3), n - 1];

  function move(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.max(0, Math.min(n - 1, Math.round(((rel - PL) / (W - PL - PR)) * (n - 1))));
    setHover(i);
    onHover?.(points[i]);
  }
  function leave() {
    setHover(null);
    onHover?.(null);
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={label}
      className="w-full h-auto block touch-none"
      onMouseMove={move}
      onMouseLeave={leave}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00AF8E" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#00AF8E" stopOpacity="0" />
        </linearGradient>
      </defs>

      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)} stroke="#e5e7eb" strokeWidth="0.6" strokeDasharray="2 3" />
          <text x={PL - 5} y={y(t) + 3} textAnchor="end" fontSize="8.5" fill="#6b7280">{t.toFixed(digits)}</text>
        </g>
      ))}

      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke="#00AF8E" strokeWidth="1.6" strokeLinejoin="round" />

      {xIdx.map((idx, i) => (
        <text
          key={i}
          x={x(idx)}
          y={H - 6}
          fontSize="8.5"
          fill="#6b7280"
          textAnchor={i === 0 ? "start" : i === xIdx.length - 1 ? "end" : "middle"}
        >
          {xFmt(points[idx].date)}
        </text>
      ))}

      {hover !== null && (
        <g>
          <line x1={x(hover)} x2={x(hover)} y1={PT} y2={H - PB} stroke="#00785f" strokeWidth="0.8" />
          <circle cx={x(hover)} cy={y(points[hover].value)} r="3" fill="#00785f" stroke="#fff" strokeWidth="1.2" />
        </g>
      )}
    </svg>
  );
}