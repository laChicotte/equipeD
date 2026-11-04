'use client';

import { CalendarCheck2, CheckCheck, ExternalLink, MapPin, Star, Video, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/feedback/status-badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { errorMessage, isApiError } from '@/lib/api';
import { formatTime, fullName } from '@/lib/format';
import { modalityLabels } from '@/lib/labels';
import type { Me, Session } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useNow } from '@/hooks/use-now';
import { useSessionAction, useSessionFeedback } from './api';

function Stars({ value, size = 'size-4' }: { value: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${value} sur 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn(size, n <= value ? 'fill-amber-400 text-amber-400' : 'text-ink-100')} aria-hidden />
      ))}
    </span>
  );
}

const RATING_LABELS = ['', 'Décevante', 'Moyenne', 'Utile', 'Très utile', 'Excellente'];

function FeedbackDialog({ session, onClose }: { session: Session; onClose: () => void }) {
  const feedback = useSessionFeedback();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const shown = hover || rating;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Évaluer la séance" description={session.topic}>
        <div className="grid gap-5">
          <div>
            <p className="text-sm font-semibold">Votre note</p>
            <div className="mt-2 flex items-center gap-3">
              <div className="flex gap-1" role="radiogroup" aria-label="Note de 1 à 5" onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={rating === n}
                    aria-label={`${n} sur 5 : ${RATING_LABELS[n]}`}
                    onMouseEnter={() => setHover(n)}
                    onClick={() => setRating(n)}
                    className="rounded-sm p-1 transition-transform hover:scale-110"
                  >
                    <Star className={cn('size-8', n <= shown ? 'fill-amber-400 text-amber-400' : 'text-ink-100')} aria-hidden />
                  </button>
                ))}
              </div>
              <span className="text-sm font-semibold text-muted-foreground">{RATING_LABELS[shown]}</span>
            </div>
          </div>
          <Field label="Commentaire" optional counter={{ value: comment.length, max: 1000 }}>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} placeholder="Ce qui vous a aidé, ce qui pourrait être amélioré…" />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            disabled={!rating}
            loading={feedback.isPending}
            onClick={() =>
              feedback.mutate(
                { id: session.id, rating, comment: comment.trim() || undefined },
                {
                  onSuccess: () => {
                    toast.success('Merci pour votre évaluation');
                    onClose();
                  },
                  onError: (e) => toast.error(errorMessage(e)),
                },
              )
            }
          >
            Envoyer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmDialog({ session, onClose }: { session: Session; onClose: () => void }) {
  const action = useSessionAction();
  const [meetingUrl, setMeetingUrl] = useState('');
  const [location, setLocation] = useState('');
  const [urlError, setUrlError] = useState<string>();
  const [locError, setLocError] = useState<string>();

  const submit = () => {
    const url = meetingUrl.trim();
    if (url && !/^https:\/\/\S+\.\S+/.test(url)) {
      setUrlError('Le lien doit commencer par https://');
      return;
    }
    setUrlError(undefined);
    setLocError(undefined);
    action.mutate(
      {
        id: session.id,
        action: 'confirm',
        body: { meetingUrl: url || undefined, location: location.trim() || undefined },
      },
      {
        onSuccess: () => {
          toast.success('Séance confirmée', { description: `${session.mentee.firstName} est informé·e.` });
          onClose();
        },
        onError: (e) => {
          if (isApiError(e) && e.details.length) {
            for (const d of e.details) {
              if (d.field === 'meetingUrl') setUrlError(d.messages[0]);
              if (d.field === 'location') setLocError(d.messages[0]);
            }
            return;
          }
          toast.error(errorMessage(e));
        },
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title="Confirmer la séance"
        description={`${session.topic} — avec ${fullName(session.mentee)}`}
      >
        <div className="grid gap-5">
          <Field
            label="Lien de réunion externe"
            optional
            error={urlError}
            hint="Google Meet, Zoom, Jitsi… La visioconférence se fait dans l’outil de votre choix."
          >
            <Input
              type="url"
              inputMode="url"
              placeholder="https://meet.jit.si/talents-connectes-…"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
            />
          </Field>
          <Field label="Lieu" optional error={locError} hint="Pour une séance en présentiel.">
            <Input placeholder="Ex. : CCFG, Conakry" value={location} onChange={(e) => setLocation(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="accent" onClick={submit} loading={action.isPending}>
            {!action.isPending && <CalendarCheck2 aria-hidden />}
            Confirmer la séance
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SessionCard({ session, me, showMentorshipLink = true }: { session: Session; me: Me; showMentorshipLink?: boolean }) {
  const action = useSessionAction();
  const [confirming, setConfirming] = useState(false);
  const [rating, setRating] = useState(false);
  const isMentor = me.id === session.mentorId;
  const other = isMentor ? session.mentee : session.mentor;
  const start = new Date(session.startsAt);
  const now = useNow();
  const started = now > 0 && start.getTime() <= now;
  const active = session.status === 'REQUESTED' || session.status === 'CONFIRMED';
  const tz = me.timezone;
  const ended = session.status === 'COMPLETED' || (session.status === 'CONFIRMED' && now > 0 && new Date(session.endsAt).getTime() <= now);
  const myFeedback = session.feedbacks?.find((f) => f.authorId === me.id);
  const otherFeedback = session.feedbacks?.find((f) => f.authorId !== me.id);

  const run = (kind: 'cancel' | 'complete', success: string) =>
    action.mutate(
      { id: session.id, action: kind },
      { onSuccess: () => toast.success(success), onError: (e) => toast.error(errorMessage(e)) },
    );

  const month = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: tz }).format(start);
  const day = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', timeZone: tz }).format(start);
  const weekday = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', timeZone: tz }).format(start);

  return (
    <article
      className={cn(
        'flex flex-col gap-4 rounded-lg border bg-surface p-4 sm:flex-row sm:items-center sm:p-5',
        session.status === 'CANCELLED' ? 'border-border opacity-75' : 'border-border',
      )}
    >
      <div className="flex items-center gap-4 sm:contents">
        <div
          className={cn(
            'flex w-16 shrink-0 flex-col items-center rounded-md py-2 text-center',
            session.status === 'CONFIRMED' ? 'bg-ink-900 text-white' : 'bg-surface-muted text-foreground',
          )}
        >
          <span className={cn('text-xs font-semibold first-letter:uppercase', session.status === 'CONFIRMED' ? 'text-teal-200' : 'text-muted-foreground')}>
            {month}
          </span>
          <span className="text-2xl leading-none font-semibold">{day}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold tracking-tight">{session.topic}</h3>
            <StatusBadge kind="session" status={session.status} />
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            <span className="capitalize">{weekday}</span> · {formatTime(session.startsAt, tz)} – {formatTime(session.endsAt, tz)} · avec{' '}
            <span className="font-medium text-foreground">{fullName(other)}</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
            {session.modality && <span>{modalityLabels[session.modality]}</span>}
            {session.meetingUrl && (
              <a
                href={session.meetingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
              >
                <Video className="size-3.5" aria-hidden />
                Salle de visio (service externe)
                <ExternalLink className="size-3" aria-hidden />
              </a>
            )}
            {session.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden />
                {session.location}
              </span>
            )}
            {myFeedback && (
              <span className="inline-flex items-center gap-1.5">
                Votre note <Stars value={myFeedback.rating} size="size-3.5" />
              </span>
            )}
            {otherFeedback && (
              <span className="inline-flex items-center gap-1.5">
                Note de {other.firstName} <Stars value={otherFeedback.rating} size="size-3.5" />
              </span>
            )}
            {showMentorshipLink && (
              <Link href={`/mentorats/${session.mentorshipId}`} className="font-medium text-accent hover:underline">
                Espace de mentorat
              </Link>
            )}
          </div>
        </div>
      </div>
      {ended && !myFeedback && (
        <div className="flex shrink-0 sm:justify-end">
          <Button variant="secondary" size="sm" onClick={() => setRating(true)}>
            <Star aria-hidden />
            Évaluer la séance
          </Button>
        </div>
      )}
      {active && (
        <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
          {isMentor && session.status === 'REQUESTED' && (
            <Button variant="accent" size="sm" onClick={() => setConfirming(true)}>
              <CalendarCheck2 aria-hidden />
              Confirmer
            </Button>
          )}
          {isMentor && session.status === 'CONFIRMED' && started && (
            <Button variant="secondary" size="sm" loading={action.isPending} onClick={() => run('complete', 'Séance marquée comme terminée.')}>
              <CheckCheck aria-hidden />
              Marquer terminée
            </Button>
          )}
          {session.status === 'CONFIRMED' && session.meetingUrl && !started && (
            <Button asChild variant="soft" size="sm">
              <a href={session.meetingUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden />
                Rejoindre
              </a>
            </Button>
          )}
          {!started && (
            <Button
              variant="danger-ghost"
              size="sm"
              loading={action.isPending && action.variables?.action === 'cancel'}
              onClick={() => run('cancel', 'Séance annulée. Le créneau est de nouveau libre.')}
            >
              <X aria-hidden />
              {isMentor && session.status === 'REQUESTED' ? 'Refuser' : 'Annuler'}
            </Button>
          )}
        </div>
      )}
      {confirming && <ConfirmDialog session={session} onClose={() => setConfirming(false)} />}
      {rating && <FeedbackDialog session={session} onClose={() => setRating(false)} />}
    </article>
  );
}
