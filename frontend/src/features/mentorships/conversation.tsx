'use client';

import { CheckCheck, Check, Lock, MessagesSquare, SendHorizontal } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { toast } from 'sonner';
import { ErrorState } from '@/components/feedback/states';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import { useCalls } from '@/features/calls/call-provider';
import {
  AttachButton,
  Attachment,
  CallButtons,
  CallLog,
  PendingFile,
  PendingMessages,
} from '@/features/messages/chat-parts';
import { enqueueMessage, newClientId, useOutbox } from '@/features/offline/outbox';
import { errorMessage, isApiError } from '@/lib/api';
import { isOnline, useOnline } from '@/lib/connectivity';
import { dayKey, formatLongDate, formatTime } from '@/lib/format';
import type { Me, Message, MentorshipSummary } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useMarkRead, useMessages, useSendFileMessage, useSendMessage } from './api';

function groupMessages(messages: Message[], tz: string) {
  const days: { key: string; label: string; items: Message[] }[] = [];
  for (const m of messages) {
    const k = dayKey(m.createdAt, tz);
    const last = days[days.length - 1];
    if (last?.key === k) last.items.push(m);
    else days.push({ key: k, label: formatLongDate(m.createdAt, tz), items: [m] });
  }
  return days;
}

export function Conversation({
  mentorship,
  me,
  className,
  hideHeader = false,
}: {
  mentorship: MentorshipSummary;
  me: Me;
  className?: string;
  hideHeader?: boolean;
}) {
  const messages = useMessages(mentorship.id);
  const send = useSendMessage(mentorship.id);
  const sendFile = useSendFileMessage(mentorship.id);
  const markRead = useMarkRead(mentorship.id);
  const { startCall, available } = useCalls();
  const [draft, setDraft] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastCount = useRef(0);
  // La conversation reste ouverte après la clôture : seul un mentorat annulé la ferme.
  const active = mentorship.status !== 'CANCELLED';
  const other = mentorship.counterpart;
  const sending = send.isPending || sendFile.isPending;
  const online = useOnline();
  const waiting = useOutbox().filter((e) => e.threadId === mentorship.id).length;

  // Accusés de lecture : marque comme lus les messages reçus non lus.
  const unreadIncoming = messages.data?.some((m) => m.senderId !== me.id && !m.readAt) ?? false;
  useEffect(() => {
    if (online && unreadIncoming && !markRead.isPending) markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadIncoming, messages.dataUpdatedAt]);

  // Défile vers le bas à l'arrivée de nouveaux messages.
  useLayoutEffect(() => {
    const count = (messages.data?.length ?? 0) + waiting;
    if (count !== lastCount.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
    lastCount.current = count;
  }, [messages.data?.length, waiting]);

  const done = () => {
    setDraft('');
    setFile(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    textareaRef.current?.focus();
  };

  const submit = () => {
    const content = draft.trim();
    if (sending) return;
    if (file) {
      sendFile.mutate(
        { file, content: content || undefined },
        { onSuccess: done, onError: (e) => toast.error(errorMessage(e)) },
      );
      return;
    }
    if (!content) return;
    // Sans réseau, le message attend sur l'appareil et part tout seul au retour de la connexion.
    const clientId = newClientId();
    const queue = () => {
      enqueueMessage({
        clientId,
        kind: 'direct',
        threadId: mentorship.id,
        userId: me.id,
        content,
      });
      done();
    };
    if (!isOnline()) return queue();
    send.mutate(
      { content, clientId },
      {
        onSuccess: done,
        onError: (e) =>
          isApiError(e) && e.code === 'NETWORK_ERROR' ? queue() : toast.error(errorMessage(e)),
      },
    );
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div
      className={cn(
        'flex h-[min(68dvh,640px)] min-h-[420px] flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-card',
        className,
      )}
    >
      {!hideHeader && (
        <div className="flex items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
          <Avatar person={other} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {other.firstName} {other.lastName}
            </p>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="size-3" aria-hidden />
              Conversation privée · visible de vous deux uniquement
            </p>
          </div>
          <CallButtons mentorshipId={mentorship.id} peer={other} disabled={!active} />
        </div>
      )}

      <div
        ref={listRef}
        className="scrollbar-thin flex-1 overflow-y-auto bg-surface-muted/40 px-4 py-5 sm:px-6"
        role="log"
        aria-live="polite"
        aria-label={`Messages avec ${other.firstName}`}
      >
        {messages.isError ? (
          <ErrorState error={messages.error} onRetry={() => void messages.refetch()} />
        ) : messages.isPending ? (
          <div className="grid gap-3">
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="ml-auto h-12 w-1/2" />
            <Skeleton className="h-16 w-3/5" />
          </div>
        ) : messages.data.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="mb-3 inline-flex items-center justify-center text-muted-foreground">
              <MessagesSquare className="size-5" aria-hidden />
            </span>
            <p className="font-semibold">Démarrez la conversation</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              {me.role === 'MENTOR'
                ? `Souhaitez la bienvenue à ${other.firstName} et proposez un premier échange.`
                : `Présentez-vous à ${other.firstName} et partagez vos attentes.`}
            </p>
          </div>
        ) : (
          groupMessages(messages.data, me.timezone).map((day) => (
            <div key={day.key} className="mb-4">
              <div className="my-4 flex items-center gap-3" role="separator">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs font-medium text-muted-foreground capitalize">
                  {day.label}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <ul className="grid gap-1.5">
                {day.items.map((m, i) => {
                  if (m.call) {
                    return (
                      <CallLog
                        key={m.id}
                        message={m}
                        meId={me.id}
                        tz={me.timezone}
                        onCallBack={
                          active && available
                            ? (kind) => startCall(mentorship.id, kind, other)
                            : undefined
                        }
                      />
                    );
                  }
                  const mine = m.senderId === me.id;
                  const next = day.items[i + 1];
                  const nextSame = next?.senderId === m.senderId && !next.call;
                  return (
                    <li
                      key={m.id}
                      className={cn(
                        'flex animate-fade-in',
                        mine ? 'justify-end' : 'justify-start',
                        !nextSame && 'mb-2',
                      )}
                    >
                      <div
                        className={cn(
                          'flex max-w-[min(80%,70ch)] flex-col',
                          mine ? 'items-end' : 'items-start',
                        )}
                      >
                        <div
                          className={cn(
                            'rounded-[14px] text-[15px] leading-relaxed break-words whitespace-pre-wrap',
                            m.file ? 'p-1.5' : 'px-3.5 py-2',
                            mine
                              ? 'rounded-br-[4px] bg-ink-900 text-white'
                              : 'rounded-bl-[4px] border border-border bg-surface text-foreground',
                          )}
                        >
                          <span className="sr-only">
                            {mine ? 'Vous : ' : `${other.firstName} : `}
                          </span>
                          {m.file && (
                            <Attachment
                              file={m.file}
                              url={`/api/v1/messages/${m.id}/file`}
                              mine={mine}
                            />
                          )}
                          {m.content && (
                            <p className={cn(m.file && 'px-2 pt-1.5 pb-0.5')}>{m.content}</p>
                          )}
                        </div>
                        {!nextSame && (
                          <span className="mt-1 flex items-center gap-1 px-1 text-[11px] text-muted-foreground">
                            {formatTime(m.createdAt, me.timezone)}
                            {mine &&
                              (m.readAt ? (
                                <>
                                  <CheckCheck className="size-3.5 text-teal-700" aria-hidden />
                                  <span className="sr-only">Lu</span>
                                </>
                              ) : (
                                <>
                                  <Check className="size-3.5" aria-hidden />
                                  <span className="sr-only">Envoyé</span>
                                </>
                              ))}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
        <PendingMessages kind="direct" threadId={mentorship.id} />
      </div>

      {active ? (
        <>
          {file && <PendingFile file={file} onRemove={() => setFile(null)} />}
          <form
            className="flex items-end gap-1.5 border-t border-border bg-surface p-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <AttachButton onPick={setFile} disabled={sending || !online} />
            <label htmlFor="message" className="sr-only">
              Votre message
            </label>
            <textarea
              id="message"
              ref={textareaRef}
              rows={1}
              value={draft}
              maxLength={2000}
              onChange={(e) => {
                setDraft(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
              }}
              onKeyDown={onKeyDown}
              placeholder={
                file ? 'Ajouter une légende (facultatif)…' : `Écrire à ${other.firstName}…`
              }
              className="max-h-40 min-h-11 flex-1 resize-none rounded-md border border-border bg-surface px-3.5 py-2.5 text-[15px] leading-relaxed outline-none transition-[border-color,box-shadow] focus-visible:border-accent focus-visible:shadow-focus"
            />
            <Button
              type="submit"
              size="icon"
              aria-label="Envoyer"
              disabled={!draft.trim() && !file}
              loading={sending}
            >
              {!sending && <SendHorizontal aria-hidden />}
            </Button>
          </form>
          <p className="hidden bg-surface px-4 pb-2 text-[11px] text-muted-foreground sm:block">
            Entrée pour envoyer · Maj + Entrée pour un saut de ligne · Trombone pour un fichier ou
            une photo (10 Mo)
          </p>
        </>
      ) : (
        <p className="border-t border-border bg-surface-muted px-4 py-3 text-center text-sm text-muted-foreground">
          Ce mentorat a été annulé : la conversation est fermée.
        </p>
      )}
    </div>
  );
}
