'use client';

import { ArrowLeft, Download } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { ErrorState } from '@/components/feedback/states';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import { isReadable, resourceViewUrl, useResource } from './api';
import { formatFileSize, resourceFileUrl } from './files';
import { PdfReader } from './pdf-reader';

/** Lecture d'un document de la bibliothèque dans la plateforme. */
export function ResourceReader() {
  const { id } = useParams<{ id: string }>();
  const q = useResource(id);
  const [page, setPage] = useState(1);

  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  if (q.isPending) return <Skeleton className="mx-auto h-[70vh] max-w-[900px]" />;
  const r = q.data;

  return (
    <div className="mx-auto max-w-[960px]">
      <div className="sticky top-16 z-20 -mx-4 mb-4 flex items-center gap-3 border-b border-border/70 bg-background/95 px-4 py-2.5 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-4">
        <Button asChild variant="ghost" size="icon-sm" aria-label="Retour à la fiche">
          <Link href={`/ressources/${r.id}`}>
            <ArrowLeft aria-hidden />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[15px] font-semibold text-ink-900">{r.title}</p>
          {r.file?.mimeType === 'application/pdf' && (
            <p className="text-[12px] text-muted-foreground tabular-nums">Page {page}</p>
          )}
        </div>
        {r.file && (
          <Button asChild variant="secondary" size="sm">
            <a href={resourceFileUrl(r.id)} download={r.file.fileName}>
              <Download aria-hidden />
              <span className="hidden sm:inline">Télécharger</span>
              <span className="text-[12px] opacity-70">{formatFileSize(r.file.size)}</span>
            </a>
          </Button>
        )}
      </div>

      {!isReadable(r.file) ? (
        <p className="py-16 text-center text-muted-foreground">
          Ce document se lit après téléchargement.
        </p>
      ) : r.file!.mimeType === 'application/pdf' ? (
        <PdfReader url={resourceViewUrl(r.id)} onPageChange={setPage} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resourceViewUrl(r.id)}
          alt={r.title}
          className="mx-auto max-h-[85vh] rounded-lg shadow-card"
        />
      )}
    </div>
  );
}
