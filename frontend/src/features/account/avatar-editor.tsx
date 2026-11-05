'use client';

import { Camera, ImagePlus, Minus, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { toast } from 'sonner';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { useMe } from '@/features/auth/api';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAccountMutations } from './api';

/** Taille du cadre de recadrage à l'écran et de l'image envoyée. */
const VIEW = 280;
const OUTPUT = 512;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;

interface Loaded {
  url: string;
  img: HTMLImageElement;
}

function clampOffset(x: number, y: number, img: HTMLImageElement, zoom: number) {
  const base = Math.max(VIEW / img.naturalWidth, VIEW / img.naturalHeight);
  const w = img.naturalWidth * base * zoom;
  const h = img.naturalHeight * base * zoom;
  const mx = Math.max(0, (w - VIEW) / 2);
  const my = Math.max(0, (h - VIEW) / 2);
  return { x: Math.min(mx, Math.max(-mx, x)), y: Math.min(my, Math.max(-my, y)) };
}

/** Recadrage carré dans le navigateur : l'API ne reçoit qu'une image légère (≈ 50 à 150 Ko). */
function exportSquare(
  img: HTMLImageElement,
  zoom: number,
  offset: { x: number; y: number },
): Promise<Blob> {
  const scale = Math.max(VIEW / img.naturalWidth, VIEW / img.naturalHeight) * zoom;
  const left = VIEW / 2 - (img.naturalWidth * scale) / 2 + offset.x;
  const top = VIEW / 2 - (img.naturalHeight * scale) / 2 + offset.y;
  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT;
  canvas.height = OUTPUT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Canvas indisponible'));
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, OUTPUT, OUTPUT);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, -left / scale, -top / scale, VIEW / scale, VIEW / scale, 0, 0, OUTPUT, OUTPUT);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Export impossible'))),
      'image/jpeg',
      0.88,
    ),
  );
}

function CropDialog({ source, onClose }: { source: Loaded; onClose: () => void }) {
  const { uploadAvatar } = useAccountMutations();
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const base = Math.max(VIEW / source.img.naturalWidth, VIEW / source.img.naturalHeight);
  const w = source.img.naturalWidth * base * zoom;
  const h = source.img.naturalHeight * base * zoom;

  const setZoomClamped = (z: number) => {
    const next = Math.min(3, Math.max(1, z));
    setZoom(next);
    setOffset((o) => clampOffset(o.x, o.y, source.img, next));
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const d = drag.current;
    setOffset(clampOffset(d.ox + e.clientX - d.x, d.oy + e.clientY - d.y, source.img, zoom));
  };
  const endDrag = () => {
    drag.current = null;
  };

  const save = async () => {
    try {
      const blob = await exportSquare(source.img, zoom, offset);
      uploadAvatar.mutate(blob, {
        onSuccess: () => {
          toast.success('Photo de profil mise à jour');
          onClose();
        },
        onError: (e) => toast.error(errorMessage(e)),
      });
    } catch {
      toast.error('Impossible de préparer cette image. Essayez une autre photo.');
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title="Recadrer votre photo"
        description="Faites glisser l’image pour la placer, puis ajustez le zoom."
      >
        <div className="grid justify-items-center gap-5">
          <div
            className="relative cursor-grab touch-none overflow-hidden rounded-[30%] bg-ink-950 select-none active:cursor-grabbing"
            style={{ width: VIEW, height: VIEW }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            role="img"
            aria-label="Aperçu du recadrage"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={source.url}
              alt=""
              draggable={false}
              className="pointer-events-none absolute max-w-none"
              style={{
                width: w,
                height: h,
                left: VIEW / 2 - w / 2 + offset.x,
                top: VIEW / 2 - h / 2 + offset.y,
              }}
            />
          </div>
          <div className="flex w-full max-w-[300px] items-center gap-3">
            <button
              type="button"
              onClick={() => setZoomClamped(zoom - 0.2)}
              className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-muted"
              aria-label="Dézoomer"
            >
              <Minus className="size-4" />
            </button>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoomClamped(Number(e.target.value))}
              aria-label="Zoom"
              className="h-1.5 flex-1 cursor-pointer accent-teal-600"
            />
            <button
              type="button"
              onClick={() => setZoomClamped(zoom + 0.2)}
              className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-muted"
              aria-label="Zoomer"
            >
              <Plus className="size-4" />
            </button>
          </div>
          <p className="text-center text-[13px] text-muted-foreground">
            Visible par les personnes avec qui vous êtes en relation. Pour un mentor publié, visible
            sur sa fiche publique.
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="button" onClick={() => void save()} loading={uploadAvatar.isPending}>
            Enregistrer la photo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Sélecteur de fichier + recadrage, réutilisable (carte de profil, page compte). */
export function useAvatarPicker() {
  const input = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<Loaded | null>(null);

  useEffect(
    () => () => {
      if (source) URL.revokeObjectURL(source.url);
    },
    [source],
  );

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      toast.error('Formats acceptés : JPEG, PNG ou WebP.');
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      toast.error('Cette image est trop lourde (15 Mo au maximum).');
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => setSource({ url, img });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      toast.error('Impossible de lire cette image.');
    };
    img.src = url;
  };

  const element = (
    <>
      <input
        ref={input}
        type="file"
        accept={ACCEPTED.join(',')}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {source && <CropDialog source={source} onClose={() => setSource(null)} />}
    </>
  );

  return { open: () => input.current?.click(), element };
}

/** Avatar cliquable avec pastille appareil photo, façon réseau social. */
export function EditableAvatar({
  className,
  size = 'xl',
}: {
  className?: string;
  size?: 'lg' | 'xl';
}) {
  const { data: me } = useMe();
  const picker = useAvatarPicker();
  if (!me) return null;
  return (
    <span className={cn('relative inline-flex', className)}>
      <button
        type="button"
        onClick={picker.open}
        className="group relative rounded-[30%] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
        aria-label={
          me.avatarUpdatedAt ? 'Changer ma photo de profil' : 'Ajouter une photo de profil'
        }
      >
        <Avatar person={me} size={size} className="ring-4 ring-surface" />
        <span className="absolute inset-0 flex items-center justify-center rounded-[30%] bg-ink-950/0 text-white opacity-0 transition group-hover:bg-ink-950/45 group-hover:opacity-100">
          <Camera className="size-5" aria-hidden />
        </span>
        <span className="absolute -right-1 -bottom-1 inline-flex size-7 items-center justify-center rounded-full bg-teal-600 text-white ring-2 ring-surface">
          <Camera className="size-3.5" aria-hidden />
        </span>
      </button>
      {picker.element}
    </span>
  );
}

/** Section « Photo de profil » de la page Mon compte. */
export function AvatarSection() {
  const { data: me } = useMe();
  const picker = useAvatarPicker();
  const { removeAvatar } = useAccountMutations();
  if (!me) return null;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <Avatar person={me} size="xl" className="size-24 text-3xl" />
      <div className="grid gap-2">
        <p className="text-[14px] text-muted-foreground">
          JPEG, PNG ou WebP. Recadrée en carré dans votre navigateur.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={picker.open}>
            <ImagePlus aria-hidden />
            {me.avatarUpdatedAt ? 'Changer la photo' : 'Ajouter une photo'}
          </Button>
          {me.avatarUpdatedAt && (
            <Button
              type="button"
              variant="secondary"
              loading={removeAvatar.isPending}
              onClick={() =>
                removeAvatar.mutate(undefined, {
                  onSuccess: () => toast.success('Photo retirée'),
                  onError: (e) => toast.error(errorMessage(e)),
                })
              }
            >
              <Trash2 aria-hidden />
              Retirer
            </Button>
          )}
        </div>
      </div>
      {picker.element}
    </div>
  );
}
