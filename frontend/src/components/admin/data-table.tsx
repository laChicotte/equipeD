'use client';

import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Search,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { normalizeText } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Valeur de tri : la colonne devient triable. */
  sortValue?: (row: T) => string | number | null;
  align?: 'left' | 'right';
  /** Colonne masquée sur les petits écrans (l'information reste dans une autre colonne). */
  hideBelow?: 'sm' | 'md' | 'lg';
  className?: string;
}

interface ServerPagination {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Titre lu par les lecteurs d'écran. */
  caption: string;
  loading?: boolean;
  /** Recherche locale : texte dans lequel chercher pour chaque ligne. */
  searchText?: (row: T) => string;
  searchPlaceholder?: string;
  /** Filtres ou actions affichés à droite de la recherche. */
  toolbar?: ReactNode;
  empty?: ReactNode;
  /** Pagination côté serveur : `rows` est alors la page courante. */
  server?: ServerPagination;
  defaultPageSize?: number;
}

const PAGE_SIZES = [10, 25, 50];

const hide = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell' };

/** Numéros de page avec points de suspension : 1 … 4 5 6 … 12. */
function pageWindow(page: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('…');
    out.push(p);
  });
  return out;
}

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const btn =
    'inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-[13px] font-semibold tabular-nums transition-colors disabled:pointer-events-none disabled:opacity-40';
  return (
    <div className="flex flex-col gap-3 border-t border-border/70 px-4 py-3 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="flex items-center gap-3">
        <span className="tabular-nums">
          {from}–{to} sur {total}
        </span>
        {onPageSizeChange && (
          <label className="hidden items-center gap-2 sm:flex">
            <span>Lignes</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 rounded-md border border-border bg-surface px-2 text-[13px] text-ink-900 outline-none focus:border-teal-600"
            >
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {totalPages > 1 && (
        <nav aria-label="Pagination" className="flex items-center gap-1">
          <button
            type="button"
            className={cn(btn, 'text-ink-900 hover:bg-surface-muted')}
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Page précédente"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          {pageWindow(page, totalPages).map((p, i) =>
            p === '…' ? (
              <span key={`e${i}`} className="px-1" aria-hidden>
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                aria-current={p === page ? 'page' : undefined}
                className={cn(
                  btn,
                  p === page ? 'bg-ink-900 text-white' : 'text-ink-900 hover:bg-surface-muted',
                )}
              >
                {p}
              </button>
            ),
          )}
          <button
            type="button"
            className={cn(btn, 'text-ink-900 hover:bg-surface-muted')}
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Page suivante"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </nav>
      )}
    </div>
  );
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  loading = false,
  searchText,
  searchPlaceholder = 'Rechercher…',
  toolbar,
  empty,
  server,
  defaultPageSize = 10,
}: DataTableProps<T>) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const filtered = useMemo(() => {
    if (server) return rows;
    let out = rows;
    const term = normalizeText(query.trim());
    if (term && searchText) out = out.filter((r) => normalizeText(searchText(r)).includes(term));
    const col = sort && columns.find((c) => c.key === sort.key);
    if (col?.sortValue) {
      const dir = sort!.dir === 'asc' ? 1 : -1;
      out = [...out].sort((a, b) => {
        const va = col.sortValue!(a);
        const vb = col.sortValue!(b);
        if (va === vb) return 0;
        if (va === null) return 1;
        if (vb === null) return -1;
        return (
          (typeof va === 'number' && typeof vb === 'number'
            ? va - vb
            : String(va).localeCompare(String(vb), 'fr')) * dir
        );
      });
    }
    return out;
  }, [rows, query, searchText, sort, columns, server]);

  const totalPages = server
    ? server.totalPages
    : Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = server ? server.page : Math.min(page, totalPages);
  const visible = server ? rows : filtered.slice((current - 1) * pageSize, current * pageSize);

  const toggleSort = (key: string) => {
    setSort((s) =>
      s?.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : null,
    );
    setPage(1);
  };

  return (
    <div className="overflow-hidden rounded-xl bg-surface shadow-card ring-1 ring-border/70">
      {(searchText || toolbar) && (
        <div className="flex flex-col gap-3 border-b border-border/70 p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          {searchText ? (
            <label className="relative block w-full sm:max-w-xs">
              <span className="sr-only">{searchPlaceholder}</span>
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder={searchPlaceholder}
                className="h-10 w-full rounded-md border border-border bg-background pr-3 pl-9 text-[14px] text-ink-900 outline-none transition-colors placeholder:text-muted-foreground focus:border-teal-600 focus:bg-surface focus:ring-3 focus:ring-teal-600/15"
              />
            </label>
          ) : (
            <span />
          )}
          {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
        </div>
      )}

      <div className="relative overflow-x-auto overscroll-x-contain">
        <table className="w-full text-left text-[14px]">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-border/70 bg-surface-muted/50">
              {columns.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={
                      active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined
                    }
                    className={cn(
                      'px-4 py-2.5 text-[12px] font-semibold tracking-wide whitespace-nowrap text-muted-foreground uppercase first:pl-5 last:pr-5',
                      c.align === 'right' && 'text-right',
                      c.hideBelow && hide[c.hideBelow],
                    )}
                  >
                    {c.sortValue && !server ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key)}
                        className={cn(
                          'inline-flex items-center gap-1 uppercase transition-colors hover:text-ink-900',
                          active && 'text-ink-900',
                        )}
                      >
                        {c.header}
                        {active ? (
                          sort!.dir === 'asc' ? (
                            <ArrowUp className="size-3.5" aria-hidden />
                          ) : (
                            <ArrowDown className="size-3.5" aria-hidden />
                          )
                        ) : (
                          <ChevronsUpDown className="size-3.5 opacity-50" aria-hidden />
                        )}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={cn(
                          'px-4 py-4 first:pl-5 last:pr-5',
                          c.hideBelow && hide[c.hideBelow],
                        )}
                      >
                        <span className="block h-4 w-3/4 animate-pulse rounded bg-surface-muted" />
                      </td>
                    ))}
                  </tr>
                ))
              : visible.map((row) => (
                  <tr
                    key={rowKey(row)}
                    className="animate-fade-in transition-colors hover:bg-surface-muted/40"
                  >
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={cn(
                          'px-4 py-3 align-middle first:pl-5 last:pr-5',
                          c.align === 'right' && 'text-right',
                          c.hideBelow && hide[c.hideBelow],
                          c.className,
                        )}
                      >
                        {c.cell(row)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
        {!loading && visible.length === 0 && (
          <div className="px-5 py-12 text-center text-[14px] text-muted-foreground">
            {query ? 'Aucun résultat pour cette recherche.' : (empty ?? 'Aucune donnée.')}
          </div>
        )}
      </div>

      {!loading &&
        (server
          ? server.total > 0 && (
              <Pagination
                page={server.page}
                totalPages={server.totalPages}
                total={server.total}
                pageSize={server.pageSize}
                onPageChange={server.onPageChange}
              />
            )
          : filtered.length > 0 && (
              <Pagination
                page={current}
                totalPages={totalPages}
                total={filtered.length}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(s) => {
                  setPageSize(s);
                  setPage(1);
                }}
              />
            ))}
    </div>
  );
}
