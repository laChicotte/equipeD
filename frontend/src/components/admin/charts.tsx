'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Palette catégorielle validée (validate_palette.js, surface blanche) : vert, terracotta, bleu,
 * ambre, toujours dans cet ordre. L'ambre a un contraste faible : chaque graphique affiche donc
 * ses valeurs dans la légende ou en libellé, jamais par la couleur seule.
 */
export const SERIES = ['#2f8a63', '#c0502a', '#2a78d6', '#d4922a'] as const;
export const ACCENT = '#c0502a';
const GRID = '#ece6dc';
const MUTED_LINE = '#b8c6be';

export interface Point {
  day: string;
  count: number;
}

const nf = new Intl.NumberFormat('fr-FR');
export const formatNumber = (n: number) => nf.format(n);
const dayLong = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(iso));
const dayShort = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(iso),
  );

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Graduations « propres » : 0, 5, 10… jusqu'à couvrir le maximum. */
function niceTicks(max: number, count = 3): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}

/* ── Courbe d'activité (une série) ────────────────────────────────────────── */

export function TrendChart({
  points,
  label,
  unit,
  color = ACCENT,
  height = 220,
}: {
  points: Point[];
  label: string;
  unit: string;
  color?: string;
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const m = { top: 12, right: 16, bottom: 26, left: 36 };
  const w = Math.max(0, width - m.left - m.right);
  const h = height - m.top - m.bottom;
  const ticks = niceTicks(Math.max(...points.map((p) => p.count), 0));
  const top = ticks[ticks.length - 1] || 1;
  const x = (i: number) => (points.length <= 1 ? 0 : (i / (points.length - 1)) * w);
  const y = (v: number) => h - (v / top) * h;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.count)}`).join('');
  const area = `${line}L${x(points.length - 1)},${h}L0,${h}Z`;
  const total = points.reduce((s, p) => s + p.count, 0);
  const last = points.length - 1;
  const shown = active ?? null;

  const onMove = (clientX: number, rect: DOMRect) => {
    const rel = clientX - rect.left - m.left;
    const i = Math.round((rel / Math.max(1, w)) * last);
    setActive(Math.min(last, Math.max(0, i)));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') setActive((a) => Math.min(last, (a ?? -1) + 1));
    else if (e.key === 'ArrowLeft') setActive((a) => Math.max(0, (a ?? last + 1) - 1));
    else if (e.key === 'Escape') setActive(null);
    else return;
    e.preventDefault();
  };

  const xLabels = [0, Math.floor(last / 2), last];

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && points.length > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${label} : ${formatNumber(total)} ${unit} sur ${points.length} jours. Flèches gauche et droite pour lire chaque jour.`}
          tabIndex={0}
          onKeyDown={onKey}
          onBlur={() => setActive(null)}
          onPointerMove={(e) => onMove(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerLeave={() => setActive(null)}
          className="touch-pan-y overflow-visible outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <g transform={`translate(${m.left},${m.top})`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={0} x2={w} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
                <text
                  x={-8}
                  y={y(t)}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-muted-foreground text-[11px] tabular-nums"
                >
                  {formatNumber(t)}
                </text>
              </g>
            ))}
            {xLabels.map((i, k) => (
              <text
                key={i}
                x={x(i)}
                y={h + 18}
                textAnchor={k === 0 ? 'start' : k === 2 ? 'end' : 'middle'}
                className="fill-muted-foreground text-[11px]"
              >
                {k === 2 ? 'Aujourd’hui' : dayShort(points[i].day)}
              </text>
            ))}
            <path d={area} fill={color} fillOpacity={0.1} />
            <path
              d={line}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {shown !== null && (
              <line x1={x(shown)} x2={x(shown)} y1={0} y2={h} stroke="#9aa8a0" strokeWidth={1} />
            )}
            {(() => {
              const i = shown ?? last;
              return (
                <circle
                  cx={x(i)}
                  cy={y(points[i].count)}
                  r={4.5}
                  fill={color}
                  stroke="#fff"
                  strokeWidth={2}
                />
              );
            })()}
          </g>
        </svg>
      )}
      {shown !== null && width > 0 && (
        <div
          className="pointer-events-none absolute top-0 z-10 animate-fade-in rounded-md bg-ink-950 px-2.5 py-1.5 text-white shadow-raised"
          style={{
            left: Math.min(Math.max(m.left + x(shown) - 70, 0), width - 140),
            width: 140,
          }}
        >
          <p className="text-[15px] font-semibold tabular-nums">
            {formatNumber(points[shown].count)}{' '}
            <span className="text-[12px] font-normal text-ink-100">{unit}</span>
          </p>
          <p className="text-[11px] text-ink-100 capitalize">{dayLong(points[shown].day)}</p>
        </div>
      )}
    </div>
  );
}

/* ── Mini-courbe des cartes de chiffres ───────────────────────────────────── */

export function Sparkline({ points, color = ACCENT }: { points: Point[]; color?: string }) {
  const W = 120;
  const H = 32;
  const max = Math.max(1, ...points.map((p) => p.count));
  const x = (i: number) => (points.length <= 1 ? 0 : (i / (points.length - 1)) * (W - 4)) + 2;
  const y = (v: number) => H - 3 - (v / max) * (H - 6);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.count)}`).join('');
  const last = points.length - 1;
  if (points.length === 0) return null;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden className="shrink-0">
      <path d={d} fill="none" stroke={MUTED_LINE} strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={x(last)} cy={y(points[last].count)} r={3} fill={color} />
    </svg>
  );
}

/* ── Légende ──────────────────────────────────────────────────────────────── */

export function Legend({
  items,
}: {
  items: { label: string; color: string; value?: ReactNode }[];
}) {
  return (
    <ul className="grid gap-2 text-[13px]">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-2.5">
          <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: it.color }} />
          <span className="min-w-0 flex-1 truncate text-muted-foreground">{it.label}</span>
          {it.value !== undefined && (
            <span className="font-semibold text-ink-900 tabular-nums">{it.value}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

/* ── Anneau (parts d'un tout) ─────────────────────────────────────────────── */

export function DonutChart({
  data,
  centerLabel,
  size = 168,
}: {
  data: { label: string; value: number }[];
  centerLabel: string;
  size?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  const stroke = 20;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const gap = total > 0 && data.filter((d) => d.value > 0).length > 1 ? 0.03 : 0; // ~2px
  // Angle de départ de chaque part : somme des parts précédentes (calcul pur, sans réassignation).
  const starts = data.map(
    (_, i) =>
      -Math.PI / 2 +
      data.slice(0, i).reduce((a, d) => a + (total ? (d.value / total) * Math.PI * 2 : 0), 0),
  );
  const arcs = data.map((d, i) => {
    const sweep = total ? (d.value / total) * Math.PI * 2 : 0;
    const start = starts[i] + gap / 2;
    const end = starts[i] + sweep - gap / 2;
    if (d.value === 0 || end <= start) return null;
    const large = end - start > Math.PI ? 1 : 0;
    const p = (a: number) => `${c + r * Math.cos(a)},${c + r * Math.sin(a)}`;
    const path =
      sweep >= Math.PI * 2 - 0.0001
        ? `M${c},${c - r}A${r},${r} 0 1 1 ${c - 0.01},${c - r}`
        : `M${p(start)}A${r},${r} 0 ${large} 1 ${p(end)}`;
    return { path, i };
  });
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0);
  const focus = hover !== null ? data[hover] : null;

  return (
    <div className="@container">
      <div className="flex flex-col items-center gap-5 @[25rem]:flex-row">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg
            width={size}
            height={size}
            role="img"
            aria-label={`${centerLabel} : ${data.map((d) => `${d.label} ${d.value}`).join(', ')}`}
          >
            <circle cx={c} cy={c} r={r} fill="none" stroke={GRID} strokeWidth={stroke} />
            {arcs.map(
              (a) =>
                a && (
                  <path
                    key={a.i}
                    d={a.path}
                    fill="none"
                    stroke={SERIES[a.i % SERIES.length]}
                    strokeWidth={hover === a.i ? stroke + 4 : stroke}
                    className="cursor-default transition-[stroke-width,opacity] duration-150"
                    opacity={hover !== null && hover !== a.i ? 0.45 : 1}
                    onPointerEnter={() => setHover(a.i)}
                    onPointerLeave={() => setHover(null)}
                  />
                ),
            )}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="font-display text-[26px] leading-none font-semibold text-ink-900">
              {formatNumber(focus ? focus.value : total)}
            </span>
            <span className="mt-1 max-w-[96px] text-[11px] leading-tight text-muted-foreground">
              {focus ? `${focus.label} · ${pct(focus.value)} %` : centerLabel}
            </span>
          </div>
        </div>
        <div className="w-full min-w-0 flex-1">
          <Legend
            items={data.map((d, i) => ({
              label: d.label,
              color: SERIES[i % SERIES.length],
              value: (
                <>
                  {formatNumber(d.value)}
                  <span className="ml-1.5 font-normal text-muted-foreground">{pct(d.value)} %</span>
                </>
              ),
            }))}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Barres groupées horizontales (plusieurs mesures de même unité) ──────── */

export function GroupedBars({
  rows,
  series,
}: {
  rows: { label: string; values: number[]; note?: ReactNode }[];
  series: string[];
}) {
  const max = Math.max(1, ...rows.flatMap((r) => r.values));
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-x-5 gap-y-1.5 text-[12px] text-muted-foreground">
        {series.map((s, i) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px]" style={{ background: SERIES[i] }} />
            {s}
          </span>
        ))}
      </div>
      <ul className="grid gap-x-8 gap-y-4 @container sm:grid-cols-2">
        {rows.map((r) => (
          <li key={r.label} className="grid content-start gap-1.5">
            <p className="flex items-center gap-2 text-[13px] font-medium text-ink-900">
              <span className="truncate">{r.label}</span>
              {r.note}
            </p>
            <div className="grid gap-[3px]">
              {r.values.map((v, i) => (
                <div
                  key={series[i]}
                  className="group flex items-center gap-2"
                  title={`${series[i]} : ${v}`}
                >
                  <span className="h-2 flex-1">
                    <span
                      className="block h-2 rounded-r-[4px] transition-[width] duration-500 ease-out"
                      style={{
                        width: v === 0 ? 0 : `max(4px, ${(v / max) * 100}%)`,
                        background: SERIES[i],
                      }}
                    />
                  </span>
                  <span className="w-8 text-right text-[12px] font-semibold text-ink-900 tabular-nums">
                    {v}
                  </span>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Entonnoir : du premier contact au certificat ─────────────────────────── */

export function FunnelChart({ steps }: { steps: { label: string; value: number }[] }) {
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <ol className="grid gap-3.5">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].value : null;
        const rate = prev ? Math.round((s.value / prev) * 100) : null;
        return (
          <li key={s.label}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
              <span className="text-muted-foreground">{s.label}</span>
              <span className="flex items-baseline gap-2">
                {rate !== null && (
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {rate} % de l’étape précédente
                  </span>
                )}
                <span className="font-semibold text-ink-900 tabular-nums">
                  {formatNumber(s.value)}
                </span>
              </span>
            </div>
            <div className="h-3 rounded-full bg-surface-muted">
              <div
                className={cn('h-3 rounded-full transition-[width] duration-500 ease-out')}
                style={{
                  width: s.value === 0 ? 0 : `max(6px, ${(s.value / max) * 100}%)`,
                  background: ACCENT,
                  opacity: 1 - i * 0.15,
                }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
