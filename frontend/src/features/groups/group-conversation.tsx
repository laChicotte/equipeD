'use client';

import { SendHorizontal, UsersRound } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { toast } from 'sonner';
import { ErrorState } from '@/components/feedback/states';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import { AttachButton, Attachment, PendingFile } from '@/features/messages/chat-parts';
import { errorMessage } from '@/lib/api';
import { dayKey, formatLongDate, formatTime, fullName } from '@/lib/format';
import type { GroupMessage, GroupSummary, Me } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useGroupMessages, useMarkGroupRead, useSendGroupFile, useSendGroupMessage } from './api';

function byDay(messages: GroupMessage[], tz: string) {
  const days: { key: string; label: string; items: GroupMessage[] }[] = [];
  for (const m of messages) {
    const k = dayKey(m.createdAt, tz);
    const last = days[days.length - 1];
    if (last?.key === k) last.items.push(m);
    else days.push({ key: k, label: formatLongDate(m.createdAt, tz), items: [m] });
  }
  return days;
}

/** Fil de discussion d'un groupe : chaque message porte le nom et la photo de son auteur. */
export function GroupConversation({
  group,
  me,
  className,
}: {
  group: GroupSummary;
  me: Me;
  className?: string;
}) {
  const messages = useGroupMessages(group.id);
  const send = useSendGroupMessage(group.id);
  const sendFile = useSendGroupFile(group.id);
  const markRead = useMarkGroupRead(group.id);
  const [draft, setDraft] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const sending = send.isPending || sendFile.isPending;
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastCount = useRef(0);

  // Lecture : dès qu'un message d'un autre membre arrive alors que le fil est ouvert.
  const latestIncoming = messages.data?.findLast((m) => m.senderId !== me.id);
  const lastMarked = useRef<string | null>(null);
  useEffect(() => {
    const fresh = !!latestIncoming && latestIncoming.id !== lastMarked.current;
    if ((group.unreadCount > 0 || fresh) && !markRead.isPending) {
      lastMarked.current = latestIncoming?.id ?? null;
      markRead.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestIncoming?.id, group.unreadCount]);

  useLayoutEffect(() => {
    const count = messages.data?.length ?? 0;
    if (count !== lastCount.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
    lastCount.current = count;
  }, [messages.data?.length]);

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
    send.mutate(content, { onSuccess: done, onError: (e) => toast.error(errorMessage(e)) });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col overflow-hidden bg-surface', className)}>
      <div
        ref={listRef}
        className="scrollbar-thin flex-1 overflow-y-auto bg-surface-muted/40 px-4 py-5 sm:px-6"
        role="log"
        aria-live="polite"
        aria-label={`Messages du groupe ${group.name}`}
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
              <UsersRound className="size-5" aria-hidden />
            </span>
            <p className="font-semibold">Lancez la discussion du groupe</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              {group.isOwner
                ? 'Présentez le groupe et ses objectifs : tous les membres verront votre message.'
                : 'Présentez-vous aux autres membres du groupe.'}
            </p>
          </div>
        ) : (
          byDay(messages.data, me.timezone).map((day) => (
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
                  const mine = m.senderId === me.id;
                  const prevSame = day.items[i - 1]?.senderId === m.senderId;
                  const nextSame = day.items[i + 1]?.senderId === m.senderId;
                  return (
                    <li
                      key={m.id}
                      className={cn(
                        'flex animate-fade-in gap-2',
                        mine ? 'justify-end' : 'justify-start',
                        !nextSame && 'mb-2',
                      )}
                    >
                      {!mine && (
                        <span className="w-8 shrink-0 self-end">
                          {!nextSame && <Avatar person={m.sender} size="sm" />}
                        </span>
                      )}
                      <div
                        className={cn(
                          'flex max-w-[min(80%,70ch)] flex-col',
                          mine ? 'items-end' : 'items-start',
                        )}
                      >
                        {!mine && !prevSame && (
                          <span className="mb-0.5 px-1 text-[12px] font-semibold text-ink-800">
                            {fullName(m.sender)}
                          </span>
                        )}
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
                            {mine ? 'Vous : ' : `${fullName(m.sender)} : `}
                          </span>
                          {m.file && (
                            <Attachment
                              file={m.file}
                              url={`/api/v1/groups/messages/${m.id}/file`}
                              mine={mine}
                            />
                          )}
                          {m.content && (
                            <p className={cn(m.file && 'px-2 pt-1.5 pb-0.5')}>{m.content}</p>
                          )}
                        </div>
                        {!nextSame && (
                          <span className="mt-1 px-1 text-[11px] text-muted-foreground">
                            {formatTime(m.createdAt, me.timezone)}
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

      {file && <PendingFile file={file} onRemove={() => setFile(null)} />}
      <form
        className="flex items-end gap-1.5 border-t border-border bg-surface p-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <AttachButton onPick={setFile} disabled={sending} />
        <label htmlFor="message-groupe" className="sr-only">
          Votre message au groupe
        </label>
        <textarea
          id="message-groupe"
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
            file ? 'Ajouter une légende (facultatif)…' : `Écrire au groupe « ${group.name} »…`
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
        Visible de tous les membres du groupe · Entrée pour envoyer · Maj + Entrée pour un saut de
        ligne · Trombone pour un fichier ou une photo
      </p>
    </div>
  );
}
