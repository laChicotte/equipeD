'use client';

import { CheckCheck, Check, Lock, MessagesSquare, SendHorizontal } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { toast } from 'sonner';
import { ErrorState } from '@/components/feedback/states';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import { errorMessage } from '@/lib/api';
import { dayKey, formatLongDate, formatTime } from '@/lib/format';
import type { Me, Message, MentorshipSummary } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useMarkRead, useMessages, useSendMessage } from './api';

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

export function Conversation({ mentorship, me }: { mentorship: MentorshipSummary; me: Me }) {
  const messages = useMessages(mentorship.id);
  const send = useSendMessage(mentorship.id);
  const markRead = useMarkRead(mentorship.id);
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastCount = useRef(0);
  const active = mentorship.status === 'ACTIVE';
  const other = mentorship.counterpart;

  // Accusés de lecture : marque comme lus les messages reçus non lus.
  const unreadIncoming = messages.data?.some((m) => m.senderId !== me.id && !m.readAt) ?? false;
  useEffect(() => {
    if (unreadIncoming && !markRead.isPending) markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadIncoming, messages.dataUpdatedAt]);

  // Défile vers le bas à l'arrivée de nouveaux messages.
  useLayoutEffect(() => {
    const count = messages.data?.length ?? 0;
    if (count !== lastCount.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
    lastCount.current = count;
  }, [messages.data?.length]);

  const submit = () => {
    const content = draft.trim();
    if (!content || send.isPending) return;
    send.mutate(content, {
      onSuccess: () => {
        setDraft('');
        textareaRef.current?.focus();
      },
      onError: (e) => toast.error(errorMessage(e)),
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="flex h-[min(68dvh,640px)] min-h-[420px] flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-card">
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
      </div>

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
            <span className="mb-3 inline-flex size-12 items-center justify-center rounded-full bg-teal-50 text-teal-700">
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
                <span className="text-xs font-medium text-muted-foreground capitalize">{day.label}</span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <ul className="grid gap-1.5">
                {day.items.map((m, i) => {
                  const mine = m.senderId === me.id;
                  const nextSame = day.items[i + 1]?.senderId === m.senderId;
                  return (
                    <li key={m.id} className={cn('flex animate-fade-in', mine ? 'justify-end' : 'justify-start', !nextSame && 'mb-2')}>
                      <div className={cn('max-w-[min(80%,70ch)]', mine ? 'items-end' : 'items-start', 'flex flex-col')}>
                        <p
                          className={cn(
                            'rounded-[14px] px-3.5 py-2 text-[15px] leading-relaxed break-words whitespace-pre-wrap',
                            mine
                              ? 'rounded-br-[4px] bg-ink-900 text-white'
                              : 'rounded-bl-[4px] border border-border bg-surface text-foreground',
                          )}
                        >
                          <span className="sr-only">{mine ? 'Vous : ' : `${other.firstName} : `}</span>
                          {m.content}
                        </p>
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
      </div>

      {active ? (
        <form
          className="flex items-end gap-2 border-t border-border bg-surface p-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
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
            placeholder={`Écrire à ${other.firstName}…`}
            className="max-h-40 min-h-11 flex-1 resize-none rounded-md border border-border bg-surface px-3.5 py-2.5 text-[15px] leading-relaxed outline-none transition-[border-color,box-shadow] focus-visible:border-accent focus-visible:shadow-focus"
          />
          <Button type="submit" size="icon" aria-label="Envoyer" disabled={!draft.trim()} loading={send.isPending}>
            {!send.isPending && <SendHorizontal aria-hidden />}
          </Button>
        </form>
      ) : (
        <p className="border-t border-border bg-surface-muted px-4 py-3 text-center text-sm text-muted-foreground">
          Ce mentorat est terminé : la conversation est en lecture seule.
        </p>
      )}
      {active && (
        <p className="hidden bg-surface px-4 pb-2 text-[11px] text-muted-foreground sm:block">
          Entrée pour envoyer · Maj + Entrée pour un saut de ligne
        </p>
      )}
    </div>
  );
}
