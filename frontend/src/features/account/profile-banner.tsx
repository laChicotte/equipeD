'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, ImageMinus, ImagePlus } from 'lucide-react';
import { useRef, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/misc';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

const WIDTH = 1500;
const HEIGHT = 500;

/** Recadre au centre en 3:1 et réduit (JPEG) : envoi léger, affichage net. */
async function cropBanner(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const target = WIDTH / HEIGHT;
  let sw = bitmap.width;
  let sh = bitmap.width / target;
  if (sh > bitmap.height) {
    sh = bitmap.height;
    sw = sh * target;
  }
  const sx = (bitmap.width - sw) / 2;
  const sy = (bitmap.height - sh) / 2;
  const scale = Math.min(1, WIDTH / sw);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  canvas.getContext('2d')!.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('banner'))), 'image/jpeg', 0.82),
  );
}

export const bannerUrl = (p: { id: string; bannerUpdatedAt?: string | null }) =>
  p.bannerUpdatedAt
    ? `/api/v1/users/${p.id}/banner?v=${encodeURIComponent(p.bannerUpdatedAt)}`
    : null;

/**
 * Bannière du profil : l'image choisie par la personne, sinon le motif de la plateforme.
 * Modifiable par son propriétaire (`editable`).
 */
export function ProfileBanner({
  person,
  editable = false,
  className,
  children,
}: {
  person: { id: string; bannerUpdatedAt?: string | null };
  editable?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const save = useMutation({
    mutationFn: (image: Blob) => api('/profile/me/banner', { method: 'PUT', body: image }),
    onSuccess: () => {
      void qc.invalidateQueries();
      toast.success('Bannière mise à jour');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => api('/profile/me/banner', { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries();
      toast.success('Bannière retirée');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const url = bannerUrl(person);

  return (
    <div className={cn('relative isolate overflow-hidden bg-ink-900', className)}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
      ) : (
        <>
          <div className="pattern-kente absolute inset-0 -z-10 opacity-[0.14]" aria-hidden />
          <div
            className="absolute -top-10 right-0 -z-10 size-40 rounded-full bg-amber-400/30 blur-3xl"
            aria-hidden
          />
        </>
      )}
      {children}
      {editable && (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Modifier la bannière"
              className="absolute top-2 right-2 inline-flex size-8 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm transition-colors hover:bg-black/55 disabled:opacity-60"
              disabled={save.isPending || remove.isPending}
            >
              <Camera className="size-4" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => input.current?.click()}>
                <ImagePlus aria-hidden />
                {url ? 'Changer la bannière' : 'Ajouter une bannière'}
              </DropdownMenuItem>
              {url && (
                <DropdownMenuItem onSelect={() => remove.mutate()}>
                  <ImageMinus aria-hidden />
                  Retirer la bannière
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              cropBanner(f)
                .then((blob) => save.mutate(blob))
                .catch(() => toast.error('Image illisible : choisissez un JPEG, PNG ou WebP.'));
            }}
          />
        </>
      )}
    </div>
  );
}
