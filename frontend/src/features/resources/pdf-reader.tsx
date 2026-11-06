'use client';

import { LoaderCircle, Minus, Plus } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { cn } from '@/lib/utils';

type Status = 'loading' | 'ready' | 'error';

/**
 * Liseuse PDF (pdf.js) : fonctionne aussi sur Android, où le navigateur ne sait pas afficher
 * un PDF dans une page. Les pages sont dessinées au fil du défilement (économie de mémoire).
 */
export function PdfReader({
  url,
  onPageChange,
}: {
  url: string;
  onPageChange?: (n: number) => void;
}) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [progress, setProgress] = useState(0);
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let loaded: PDFDocumentProxy | null = null;
    void (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString();
        const task = pdfjs.getDocument({ url, isEvalSupported: false });
        task.onProgress = ({ loaded: l, total }: { loaded: number; total: number }) => {
          if (total) setProgress(Math.round((l / total) * 100));
        };
        loaded = await task.promise;
        if (cancelled) return void loaded.destroy();
        setDoc(loaded);
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
      void loaded?.destroy();
    };
  }, [url]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      {status === 'loading' && (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
          <LoaderCircle className="size-6 animate-spin" aria-hidden />
          <p className="text-[14px]">Chargement du document{progress ? ` · ${progress} %` : '…'}</p>
        </div>
      )}
      {status === 'error' && (
        <p className="py-24 text-center text-[14px] text-muted-foreground">
          Ce document ne peut pas être affiché ici. Téléchargez-le pour le lire.
        </p>
      )}
      {doc && width > 0 && (
        <>
          <div className="sticky top-2 z-10 mb-3 flex justify-end">
            <div className="inline-flex items-center gap-1 rounded-full bg-ink-900/90 p-1 text-white shadow-raised backdrop-blur">
              <button
                type="button"
                aria-label="Dézoomer"
                disabled={zoom <= 0.6}
                onClick={() => setZoom((z) => Math.max(0.6, Math.round((z - 0.2) * 10) / 10))}
                className="inline-flex size-8 items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-40"
              >
                <Minus className="size-4" aria-hidden />
              </button>
              <span className="w-12 text-center text-[12px] tabular-nums">
                {Math.round(zoom * 100)} %
              </span>
              <button
                type="button"
                aria-label="Zoomer"
                disabled={zoom >= 2.5}
                onClick={() => setZoom((z) => Math.min(2.5, Math.round((z + 0.2) * 10) / 10))}
                className="inline-flex size-8 items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-40"
              >
                <Plus className="size-4" aria-hidden />
              </button>
            </div>
          </div>
          <div className={cn('grid justify-center gap-4', zoom > 1 && 'overflow-x-auto')}>
            {Array.from({ length: doc.numPages }, (_, i) => (
              <PdfPage
                key={i}
                doc={doc}
                pageNumber={i + 1}
                width={Math.round(Math.min(width, 900) * zoom)}
                onVisible={onPageChange}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PdfPage({
  doc,
  pageNumber,
  width,
  onVisible,
}: {
  doc: PDFDocumentProxy;
  pageNumber: number;
  width: number;
  onVisible?: (n: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(1.414);
  const [near, setNear] = useState(pageNumber <= 2);

  // Proportions de la page dès le départ : la mise en page ne saute pas au défilement.
  useEffect(() => {
    let alive = true;
    void doc.getPage(pageNumber).then((p) => {
      const v = p.getViewport({ scale: 1 });
      if (alive) setRatio(v.height / v.width);
    });
    return () => {
      alive = false;
    };
  }, [doc, pageNumber]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setNear(true);
        if (e.intersectionRatio > 0.5) onVisible?.(pageNumber);
      },
      { rootMargin: '600px 0px', threshold: [0, 0.5] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [pageNumber, onVisible]);

  const draw = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const page = await doc.getPage(pageNumber);
    const base = page.getViewport({ scale: 1 });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const viewport = page.getViewport({ scale: (width / base.width) * dpr });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const task = page.render({ canvas, viewport });
    await task.promise.catch(() => undefined);
  }, [doc, pageNumber, width]);

  useEffect(() => {
    if (near) void draw();
  }, [near, draw]);

  return (
    <div
      ref={boxRef}
      className="overflow-hidden rounded-sm bg-white shadow-card ring-1 ring-border/70"
      style={{ width, height: Math.round(width * ratio) }}
      aria-label={`Page ${pageNumber}`}
    >
      {near && <canvas ref={canvasRef} className="block h-full w-full" />}
    </div>
  );
}
