'use client';

import {
  Download,
  FileText,
  Paperclip,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  Video,
  X,
} from 'lucide-react';
import { useRef } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { useCalls, type CallKind } from '@/features/calls/call-provider';
import {
  fileKindLabel,
  formatFileSize,
  isAcceptedFile,
  RESOURCE_FILE_ACCEPT,
  RESOURCE_FILE_MAX_BYTES,
} from '@/features/resources/files';
import { formatTime } from '@/lib/format';
import type { ChatFile, Message, PersonRef } from '@/lib/types';
import { cn } from '@/lib/utils';

const isImage = (mime: string) => ['image/png', 'image/jpeg', 'image/webp'].includes(mime);

/** Aperçu d'un dernier message pour les listes de conversations. */
export function previewText(last: {
  content: string;
  callId?: string | null;
  file?: { fileName: string; mimeType: string } | null;
}) {
  if (last.callId) return last.content;
  if (last.file) {
    const label = isImage(last.file.mimeType) ? 'Photo' : last.file.fileName;
    return last.content ? `📎 ${label} · ${last.content}` : `📎 ${label}`;
  }
  return last.content;
}

/** Bouton trombone : choix d'un fichier, contrôlé avant l'envoi (format, 10 Mo). */
export function AttachButton({
  onPick,
  disabled,
}: {
  onPick: (file: File) => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={RESOURCE_FILE_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          if (!isAcceptedFile(file.name)) {
            toast.error('Format non accepté : PDF, Word, Excel, PowerPoint, texte, CSV ou image.');
          } else if (file.size > RESOURCE_FILE_MAX_BYTES) {
            toast.error(`Ce fichier pèse ${formatFileSize(file.size)} : 10 Mo au maximum.`);
          } else if (file.size === 0) {
            toast.error('Ce fichier est vide.');
          } else onPick(file);
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Joindre un fichier ou une photo"
        disabled={disabled}
        onClick={() => ref.current?.click()}
        className="text-muted-foreground"
      >
        <Paperclip aria-hidden />
      </Button>
    </>
  );
}

/** Fichier choisi, en attente d'envoi (le texte saisi servira de légende). */
export function PendingFile({ file, onRemove }: { file: File; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-3 border-t border-border bg-surface-muted/60 px-4 py-2.5">
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-ink-900 text-amber-400">
        <Paperclip className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold text-ink-900">{file.name}</span>
        <span className="text-[12px] text-muted-foreground">
          {fileKindLabel(file.name)} · {formatFileSize(file.size)} · le texte saisi servira de
          légende
        </span>
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Retirer le fichier"
        onClick={onRemove}
      >
        <X aria-hidden />
      </Button>
    </div>
  );
}

/** Pièce jointe dans une bulle : photo affichée, document téléchargeable. */
export function Attachment({ file, url, mine }: { file: ChatFile; url: string; mine: boolean }) {
  if (isImage(file.mimeType)) {
    return (
      <a
        href={url}
        download={file.fileName}
        className="block"
        title={`Télécharger ${file.fileName}`}
      >
        {/* Image servie par l'API (même origine, accès vérifié) : pas d'optimisation next/image. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${url}?inline=1`}
          alt={file.fileName}
          loading="lazy"
          className="max-h-72 w-auto max-w-full rounded-[10px] object-contain"
        />
      </a>
    );
  }
  return (
    <a
      href={url}
      download={file.fileName}
      className={cn(
        'flex min-w-[220px] items-center gap-3 rounded-[10px] px-3 py-2.5 transition-colors',
        mine ? 'bg-white/10 hover:bg-white/15' : 'bg-surface-muted hover:bg-ink-50',
      )}
    >
      <span
        className={cn(
          'inline-flex size-10 shrink-0 items-center justify-center rounded-md',
          mine ? 'bg-white/15 text-amber-300' : 'bg-ink-900 text-amber-400',
        )}
      >
        <FileText className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold">{file.fileName}</span>
        <span className={cn('text-[12px]', mine ? 'text-ink-100' : 'text-muted-foreground')}>
          {fileKindLabel(file.fileName)} · {formatFileSize(file.size)}
        </span>
      </span>
      <Download className="size-4 shrink-0 opacity-80" aria-hidden />
      <span className="sr-only">Télécharger</span>
    </a>
  );
}

/** Compte rendu d'appel au milieu du fil (« Appel vidéo · 3 min », « Appel audio manqué »). */
export function CallLog({
  message,
  meId,
  tz,
  onCallBack,
}: {
  message: Message;
  meId: string;
  tz: string;
  onCallBack?: (kind: CallKind) => void;
}) {
  const call = message.call!;
  const outgoing = message.senderId === meId;
  const missed = call.status !== 'ENDED';
  const Icon = missed && !outgoing ? PhoneMissed : outgoing ? PhoneOutgoing : PhoneIncoming;
  const kindLabel = call.kind === 'VIDEO' ? 'Appel vidéo' : 'Appel audio';
  // Côté appelant, un appel non décroché s'affiche « sans réponse » plutôt que « manqué ».
  const label =
    outgoing && call.status !== 'ENDED' && call.status !== 'DECLINED'
      ? `${kindLabel} sans réponse`
      : message.content;
  return (
    <li className="my-2 flex justify-center">
      <span
        className={cn(
          'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px]',
          missed && !outgoing
            ? 'border-danger-700/20 bg-danger-50 text-danger-700'
            : 'border-border bg-surface text-ink-800',
        )}
      >
        <Icon className="size-4" aria-hidden />
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">· {formatTime(message.createdAt, tz)}</span>
        {onCallBack && (
          <button
            type="button"
            onClick={() => onCallBack(call.kind)}
            className="ml-1 font-semibold text-teal-700 hover:underline"
          >
            Rappeler
          </button>
        )}
      </span>
    </li>
  );
}

/** Boutons d'appel audio et vidéo d'une conversation privée. */
export function CallButtons({
  mentorshipId,
  peer,
  disabled,
}: {
  mentorshipId: string;
  peer: PersonRef;
  disabled?: boolean;
}) {
  const { startCall, available, state } = useCalls();
  const busy = state.phase !== 'idle';
  const off = disabled || !available || busy;
  const hint = disabled
    ? 'Appels indisponibles pour cette conversation'
    : !available
      ? 'Connexion temps réel en cours…'
      : busy
        ? 'Un appel est déjà en cours'
        : null;
  const label = (kind: CallKind) =>
    kind === 'AUDIO'
      ? 'Appel audio · léger, adapté aux connexions mobiles'
      : 'Appel vidéo · consomme davantage de données';
  const button = (kind: CallKind) => (
    <Button
      type="button"
      variant={kind === 'AUDIO' ? 'soft' : 'ghost'}
      size={kind === 'AUDIO' ? 'sm' : 'icon-sm'}
      disabled={off}
      onClick={() => startCall(mentorshipId, kind, peer)}
      aria-label={label(kind)}
      className="text-teal-800"
    >
      {kind === 'VIDEO' ? (
        <Video aria-hidden />
      ) : (
        <>
          <Phone aria-hidden />
          <span className="hidden sm:inline">Audio</span>
        </>
      )}
    </Button>
  );
  return (
    <span className="inline-flex items-center gap-1">
      {hint ? (
        <Tooltip content={hint}>
          <span className="inline-flex items-center gap-1">
            {button('AUDIO')}
            {button('VIDEO')}
          </span>
        </Tooltip>
      ) : (
        <>
          <Tooltip content={label('AUDIO')}>{button('AUDIO')}</Tooltip>
          <Tooltip content={label('VIDEO')}>{button('VIDEO')}</Tooltip>
        </>
      )}
    </span>
  );
}
