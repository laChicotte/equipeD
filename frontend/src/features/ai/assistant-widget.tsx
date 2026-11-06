'use client';

import { ArrowUp, MessageCircleQuestion, RotateCcw, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { errorMessage } from '@/lib/api';
import type { Role } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useMe } from '@/features/auth/api';
import { useAiAvailable, useAssistant, type AssistantAnswer } from './api';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
  links?: AssistantAnswer['links'];
  error?: boolean;
}

type AssistantRole = Role | 'VISITOR';

const SUGGESTIONS: Record<AssistantRole, string[]> = {
  VISITOR: [
    'C’est quoi TalentsConnect ?',
    'Comment trouver un mentor ?',
    'Est-ce gratuit ?',
    'Comment devenir mentor ?',
  ],
  MENTEE: [
    'Comment trouver un mentor ?',
    'Comment réserver une séance ?',
    'Que se passe-t-il à la fin d’un mentorat ?',
    'Comment devenir mentor ?',
  ],
  MENTOR: [
    'C’est quoi un créneau ?',
    'Comment confirmer une séance ?',
    'Comment obtenir le badge Profil vérifié ?',
    'Comment créer un groupe ?',
  ],
  ADMIN: [
    'Comment valider une candidature de mentor ?',
    'Comment aider quelqu’un qui a oublié son mot de passe ?',
    'Que montre la page Pilotage ?',
  ],
};

/** Assistant de la plateforme : répond aux questions sur son fonctionnement, à partir du guide intégré. */
export function AssistantWidget({ role }: { role: AssistantRole }) {
  const available = useAiAvailable();
  const pathname = usePathname();
  const assistant = useAssistant();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [turns, assistant.isPending]);

  if (!available) return null;

  const ask = (text: string) => {
    const q = text.trim();
    if (q.length < 2 || assistant.isPending) return;
    const history = turns
      .filter((t) => !t.error)
      .slice(-8)
      .map(({ role: r, content }) => ({ role: r, content }));
    setTurns((t) => [...t, { role: 'user', content: q }]);
    setQuestion('');
    assistant.mutate(
      { question: q.slice(0, 600), history, page: pathname },
      {
        onSuccess: (data) =>
          setTurns((t) => [...t, { role: 'assistant', content: data.answer, links: data.links }]),
        onError: (error) =>
          setTurns((t) => [...t, { role: 'assistant', content: errorMessage(error), error: true }]),
      },
    );
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    ask(question);
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Poser une question à l’assistant"
          className={cn(
            'fixed right-4 z-40 inline-flex h-12 items-center gap-2 rounded-full bg-ink-900 pr-4 pl-3.5 text-sm font-semibold text-white shadow-raised transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:bottom-6 print:hidden',
            // Au-dessus de la barre d'onglets mobile ; l'administration n'en a pas.
            // L'administration et les pages publiques n'ont pas de barre d'onglets.
            role === 'ADMIN' || role === 'VISITOR' ? 'bottom-6' : 'bottom-24',
            // Dans la messagerie, le bouton masquerait la zone de saisie sur mobile.
            pathname.startsWith('/messages') && 'hidden lg:inline-flex',
          )}
        >
          <MessageCircleQuestion className="size-5 text-amber-400" aria-hidden />
          <span className="hidden sm:inline">Une question ?</span>
        </button>
      )}

      {open && (
        <section
          role="dialog"
          aria-label="Assistant de la plateforme"
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-2xl bg-surface shadow-raised ring-1 ring-border/70 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:h-[560px] sm:max-h-[calc(100dvh-2rem)] sm:w-[380px] sm:rounded-2xl print:hidden"
        >
          <header className="flex items-center gap-3 border-b border-border/70 px-4 py-3">
            <span className="inline-flex size-9 items-center justify-center rounded-full bg-ink-900">
              <MessageCircleQuestion className="size-[18px] text-amber-400" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-[15px] font-semibold text-ink-900">Assistant</p>
              <p className="text-xs text-muted-foreground">
                Questions sur l’utilisation de TalentsConnect
              </p>
            </div>
            {turns.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setTurns([]);
                  assistant.reset();
                }}
                aria-label="Nouvelle conversation"
                title="Nouvelle conversation"
                className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-muted"
              >
                <RotateCcw className="size-4" aria-hidden />
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fermer l’assistant"
              className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-muted"
            >
              <X className="size-5" aria-hidden />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
            {turns.length === 0 && (
              <div>
                <p className="text-sm text-foreground">
                  Bonjour, je réponds à vos questions sur le fonctionnement de la plateforme :
                  demandes, séances, messagerie, compte…
                </p>
                <ul className="mt-3 flex flex-col items-start gap-2">
                  {SUGGESTIONS[role].map((s) => (
                    <li key={s}>
                      <button
                        type="button"
                        onClick={() => ask(s)}
                        className="rounded-full border border-border bg-surface px-3 py-1.5 text-left text-[13px] font-medium text-ink-900 hover:border-border-strong hover:bg-surface-muted"
                      >
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {turns.map((t, i) =>
              t.role === 'user' ? (
                <p
                  key={i}
                  className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-ink-900 px-3.5 py-2 text-sm whitespace-pre-line text-white"
                >
                  {t.content}
                </p>
              ) : (
                <div key={i} className="max-w-[92%]">
                  <p
                    className={cn(
                      'rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm whitespace-pre-line',
                      t.error ? 'bg-danger-50 text-danger-700' : 'bg-surface-muted text-foreground',
                    )}
                  >
                    {t.content}
                  </p>
                  {!!t.links?.length && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {t.links.map((l) => (
                        <Link
                          key={l.href}
                          href={l.href}
                          onClick={() => setOpen(false)}
                          className="rounded-full bg-accent-soft px-3 py-1 text-[13px] font-semibold text-teal-800 hover:bg-teal-100"
                        >
                          {l.label} →
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ),
            )}
            {assistant.isPending && (
              <p className="w-fit rounded-2xl rounded-bl-md bg-surface-muted px-3.5 py-2.5 text-sm text-muted-foreground">
                L’assistant écrit…
              </p>
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={submit}
            className="border-t border-border/70 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          >
            <div className="flex items-end gap-2">
              <label htmlFor="assistant-question" className="sr-only">
                Votre question
              </label>
              <textarea
                id="assistant-question"
                ref={inputRef}
                rows={1}
                maxLength={600}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    ask(question);
                  }
                }}
                placeholder="Posez votre question…"
                className="max-h-28 min-h-11 flex-1 resize-none rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-ring"
              />
              <button
                type="submit"
                disabled={question.trim().length < 2 || assistant.isPending}
                aria-label="Envoyer la question"
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-55"
              >
                <ArrowUp className="size-5" aria-hidden />
              </button>
            </div>
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
              Réponses générées automatiquement à partir du guide de la plateforme : elles peuvent
              contenir des erreurs. N’écrivez pas d’informations personnelles.
            </p>
          </form>
        </section>
      )}
    </>
  );
}

/** Pages publiques (accueil, annuaire, connexion…) : l'assistant aide aussi les visiteurs. */
export function PublicAssistant() {
  const { data: me } = useMe();
  return <AssistantWidget role={me?.role ?? 'VISITOR'} />;
}
