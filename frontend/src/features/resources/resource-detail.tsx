'use client';

import {
  ArrowLeft,
  ArrowUpRight,
  BookOpenText,
  CalendarDays,
  Download,
  FileText,
  Globe2,
  Hourglass,
  ImagePlus,
  MessageCircleQuestion,
  Reply,
  ShieldCheck,
  ShieldX,
  Star,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { ErrorState } from '@/components/feedback/states';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/misc';
import { useMe } from '@/features/auth/api';
import { errorMessage, isApiError } from '@/lib/api';
import { formatDate, formatRelative, fullName } from '@/lib/format';
import { resourceKindLabels, resourceLicensePublicLabels, roleLabels } from '@/lib/labels';
import type { ResourceDetail, ResourceThread } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  isReadable,
  useRateResource,
  useResource,
  useResourceComments,
  useResourceDiscussion,
  useResourceReviews,
  useSetCover,
} from './api';
import { fileKindLabel, formatFileSize, resourceFileUrl } from './files';
import { KIND_ICONS, ResourceCover } from './resource-card';
import { shrinkCover } from './resource-dialog';

const panel = 'rounded-xl bg-surface shadow-card ring-1 ring-border/70';

/* ── Étoiles ──────────────────────────────────────────────────────────────── */

export function Stars({ value, size = 'size-4' }: { value: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            size,
            n <= Math.round(value)
              ? 'fill-amber-400 text-amber-400'
              : 'fill-none text-border-strong',
          )}
        />
      ))}
    </span>
  );
}

function StarInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  const labels = ['Décevant', 'Moyen', 'Bien', 'Très bien', 'Excellent'];
  const shown = hover || value;
  return (
    <div className="flex items-center gap-3">
      <div
        role="radiogroup"
        aria-label="Votre note"
        className="inline-flex"
        onPointerLeave={() => setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} sur 5 : ${labels[n - 1]}`}
            onPointerEnter={() => setHover(n)}
            onClick={() => onChange(n)}
            className="p-0.5 transition-transform hover:scale-110"
          >
            <Star
              className={cn(
                'size-7',
                n <= shown ? 'fill-amber-400 text-amber-400' : 'fill-none text-border-strong',
              )}
              aria-hidden
            />
          </button>
        ))}
      </div>
      {shown > 0 && <span className="text-[13px] text-muted-foreground">{labels[shown - 1]}</span>}
    </div>
  );
}

/* ── Couverture modifiable ────────────────────────────────────────────────── */

function CoverEditor({ resource }: { resource: ResourceDetail }) {
  const input = useRef<HTMLInputElement>(null);
  const setCover = useSetCover(resource.id);
  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        className="mt-3 w-full"
        loading={setCover.isPending}
        onClick={() => input.current?.click()}
      >
        <ImagePlus aria-hidden />
        {resource.cover ? 'Changer la couverture' : 'Ajouter une couverture'}
      </Button>
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
          shrinkCover(f)
            .then((blob) =>
              setCover.mutate(blob, {
                onSuccess: () => toast.success('Couverture mise à jour'),
                onError: (err) => toast.error(errorMessage(err)),
              }),
            )
            .catch(() => toast.error('Image illisible : choisissez un JPEG, PNG ou WebP.'));
        }}
      />
    </>
  );
}

/* ── Avis ─────────────────────────────────────────────────────────────────── */

function Reviews({ resource }: { resource: ResourceDetail }) {
  const { data: me } = useMe();
  const reviews = useResourceReviews(resource.id);
  const rate = useRateResource(resource.id);
  const [rating, setRating] = useState(resource.myReview?.rating ?? 0);
  const [comment, setComment] = useState(resource.myReview?.comment ?? '');
  const canRate = !!me && !resource.isAuthor && resource.status === 'PUBLISHED';
  const counts = [5, 4, 3, 2, 1].map((n) => ({
    n,
    count: reviews.data?.filter((r) => r.rating === n).length ?? 0,
  }));
  const total = resource.rating.count;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!rating) return;
    rate.mutate(
      { rating, comment: comment.trim() || undefined },
      {
        onSuccess: () =>
          toast.success(resource.myReview ? 'Avis mis à jour' : 'Merci pour votre avis'),
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  return (
    <section aria-labelledby="titre-avis" className={cn(panel, 'p-5 sm:p-6')}>
      <h2 id="titre-avis" className="font-display text-[18px] font-semibold text-ink-900">
        Avis des lecteurs
      </h2>
      <div className="mt-4 grid gap-6 md:grid-cols-[200px_minmax(0,1fr)]">
        <div>
          <p className="font-display text-[40px] leading-none font-semibold text-ink-900">
            {resource.rating.average === null
              ? '—'
              : resource.rating.average.toLocaleString('fr-FR')}
          </p>
          <div className="mt-2">
            <Stars value={resource.rating.average ?? 0} />
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {total === 0 ? 'Pas encore d’avis' : `${total} avis`}
          </p>
          {total > 0 && (
            <ul className="mt-3 grid gap-1">
              {counts.map((c) => (
                <li key={c.n} className="flex items-center gap-2 text-[12px] text-muted-foreground">
                  <span className="w-3 tabular-nums">{c.n}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                    <span
                      className="block h-full rounded-full bg-amber-400"
                      style={{ width: `${(c.count / total) * 100}%` }}
                    />
                  </span>
                  <span className="w-4 text-right tabular-nums">{c.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid content-start gap-5">
          {canRate ? (
            <form
              onSubmit={submit}
              className="grid gap-3 rounded-lg bg-background/70 p-4 ring-1 ring-border/60"
            >
              <p className="text-[14px] font-semibold text-ink-900">
                {resource.myReview ? 'Votre avis' : 'Donnez votre avis'}
              </p>
              <StarInput value={rating} onChange={setRating} />
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={1000}
                rows={2}
                placeholder="Ce qui vous a aidé, à qui vous le conseillez… (facultatif)"
              />
              <div>
                <Button type="submit" size="sm" disabled={!rating} loading={rate.isPending}>
                  {resource.myReview ? 'Mettre à jour' : 'Publier mon avis'}
                </Button>
              </div>
            </form>
          ) : !me ? (
            <p className="text-[14px] text-muted-foreground">
              <Link
                href={`/connexion?next=/ressources/${resource.id}`}
                className="font-semibold text-teal-700 hover:underline"
              >
                Connectez-vous
              </Link>{' '}
              pour noter cette ressource.
            </p>
          ) : null}

          {reviews.isPending ? (
            <Skeleton className="h-20" />
          ) : (
            <ul className="divide-y divide-border/60">
              {(reviews.data ?? [])
                .filter((r) => r.comment)
                .map((r) => (
                  <li key={r.id} className="flex gap-3 py-3">
                    <Avatar person={r.user} size="sm" />
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-x-2 text-[14px]">
                        <span className="font-semibold text-ink-900">{fullName(r.user)}</span>
                        <Stars value={r.rating} size="size-3.5" />
                        <span className="text-[12px] text-muted-foreground">
                          {formatRelative(r.updatedAt)}
                        </span>
                      </p>
                      <p className="mt-1 text-[14px] whitespace-pre-line text-foreground">
                        {r.comment}
                      </p>
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

/* ── Questions et discussion ──────────────────────────────────────────────── */

function Message({
  c,
  canDelete,
  onDelete,
  onReply,
}: {
  c: ResourceThread | ResourceThread['replies'][number];
  canDelete: boolean;
  onDelete: () => void;
  onReply?: () => void;
}) {
  return (
    <div className="flex gap-3">
      <Avatar person={c.author} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px]">
          <span className="font-semibold text-ink-900">{fullName(c.author)}</span>
          {c.isResourceAuthor ? (
            <Badge tone="amber">A partagé la ressource</Badge>
          ) : (
            c.author.role !== 'MENTEE' && (
              <span className="text-[12px] text-muted-foreground">{roleLabels[c.author.role]}</span>
            )
          )}
          <span className="text-[12px] text-muted-foreground">{formatRelative(c.createdAt)}</span>
        </p>
        <p className="mt-1 text-[14px] leading-relaxed whitespace-pre-line text-foreground">
          {c.content}
        </p>
        <div className="mt-1.5 flex gap-3 text-[13px]">
          {onReply && (
            <button
              type="button"
              onClick={onReply}
              className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:underline"
            >
              <Reply className="size-3.5" aria-hidden />
              Répondre
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-danger-700"
            >
              <Trash2 className="size-3.5" aria-hidden />
              Supprimer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Discussion({ resource }: { resource: ResourceDetail }) {
  const { data: me } = useMe();
  const thread = useResourceComments(resource.id);
  const { post, remove } = useResourceDiscussion(resource.id);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const isStaffOrAuthor = resource.canEdit;

  const send = (content: string, parentId?: string, done?: () => void) =>
    post.mutate(
      { content: content.trim(), parentId },
      {
        onSuccess: () => {
          done?.();
          toast.success(parentId ? 'Réponse publiée' : 'Question publiée');
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  const del = (id: string) =>
    remove.mutate(id, { onError: (err) => toast.error(errorMessage(err)) });

  return (
    <section
      id="discussion"
      aria-labelledby="titre-discussion"
      className={cn(panel, 'scroll-mt-24 p-5 sm:p-6')}
    >
      <h2 id="titre-discussion" className="font-display text-[18px] font-semibold text-ink-900">
        Questions et discussion
      </h2>
      <p className="mt-1 text-[14px] text-muted-foreground">
        Posez vos questions à {fullName(resource.author)} ou partagez votre expérience. Les échanges
        sont visibles de tous : n’y écrivez pas d’informations personnelles.
      </p>

      {me ? (
        resource.status === 'PUBLISHED' && (
          <form
            className="mt-4 grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim().length >= 2) send(text, undefined, () => setText(''));
            }}
          >
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder={
                resource.isAuthor
                  ? 'Ajoutez une précision pour les lecteurs…'
                  : 'Votre question ou votre retour sur cette ressource…'
              }
            />
            <div>
              <Button
                type="submit"
                size="sm"
                disabled={text.trim().length < 2}
                loading={post.isPending && !replyTo}
              >
                <MessageCircleQuestion aria-hidden />
                Publier
              </Button>
            </div>
          </form>
        )
      ) : (
        <p className="mt-4 rounded-lg bg-background/70 px-4 py-3 text-[14px] text-muted-foreground ring-1 ring-border/60">
          <Link
            href={`/connexion?next=/ressources/${resource.id}%23discussion`}
            className="font-semibold text-teal-700 hover:underline"
          >
            Connectez-vous
          </Link>{' '}
          pour poser une question.
        </p>
      )}

      <div className="mt-6">
        {thread.isPending ? (
          <Skeleton className="h-24" />
        ) : (thread.data ?? []).length === 0 ? (
          <p className="text-[14px] text-muted-foreground">Aucune question pour l’instant.</p>
        ) : (
          <ul className="grid gap-5">
            {thread.data!.map((c) => (
              <li key={c.id} className="animate-fade-in">
                <Message
                  c={c}
                  canDelete={!!me && (me.id === c.author.id || isStaffOrAuthor)}
                  onDelete={() => del(c.id)}
                  onReply={me ? () => setReplyTo(replyTo === c.id ? null : c.id) : undefined}
                />
                {(c.replies.length > 0 || replyTo === c.id) && (
                  <div className="mt-3 ml-11 grid gap-4 border-l-2 border-border/70 pl-4">
                    {c.replies.map((r) => (
                      <Message
                        key={r.id}
                        c={r}
                        canDelete={!!me && (me.id === r.author.id || isStaffOrAuthor)}
                        onDelete={() => del(r.id)}
                      />
                    ))}
                    {replyTo === c.id && (
                      <form
                        className="grid gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (reply.trim().length >= 2)
                            send(reply, c.id, () => {
                              setReply('');
                              setReplyTo(null);
                            });
                        }}
                      >
                        <Textarea
                          autoFocus
                          value={reply}
                          onChange={(e) => setReply(e.target.value)}
                          maxLength={2000}
                          rows={2}
                          placeholder={`Répondre à ${c.author.firstName}…`}
                        />
                        <div className="flex gap-2">
                          <Button
                            type="submit"
                            size="sm"
                            disabled={reply.trim().length < 2}
                            loading={post.isPending}
                          >
                            Répondre
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setReplyTo(null)}
                          >
                            Annuler
                          </Button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/* ── Fiche ────────────────────────────────────────────────────────────────── */

export function ResourceDetailView() {
  const { id } = useParams<{ id: string }>();
  const q = useResource(id);

  if (q.isError) {
    if (isApiError(q.error) && q.error.statusCode === 404) {
      return (
        <div className="mx-auto max-w-lg py-16 text-center">
          <p className="font-display text-[20px] font-semibold text-ink-900">
            Ressource introuvable
          </p>
          <p className="mt-2 text-muted-foreground">
            Elle a peut-être été retirée de la bibliothèque.
          </p>
          <Button asChild variant="secondary" className="mt-6">
            <Link href="/ressources">Retour à la bibliothèque</Link>
          </Button>
        </div>
      );
    }
    return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  }
  if (q.isPending) {
    return (
      <div className="mx-auto grid max-w-[1100px] gap-6 md:grid-cols-[300px_minmax(0,1fr)]">
        <Skeleton className="h-[420px] rounded-xl" />
        <Skeleton className="h-[420px] rounded-xl" />
      </div>
    );
  }

  const r = q.data;
  const Icon = KIND_ICONS[r.kind];
  const readable = isReadable(r.file);

  return (
    <div className="mx-auto grid max-w-[1100px] animate-fade-in gap-6">
      <Link
        href="/ressources"
        className="inline-flex w-fit items-center gap-1.5 text-[14px] font-semibold text-muted-foreground hover:text-ink-900"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Bibliothèque
      </Link>

      {r.status === 'PENDING' && (
        <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-[14px] text-[#7a4a0f]">
          <Hourglass className="size-4" aria-hidden />
          En attente de validation par l’équipe : visible seulement par vous et l’équipe.
        </p>
      )}
      {r.status === 'REJECTED' && (
        <p className="flex items-center gap-2 rounded-xl bg-danger-50 px-4 py-3 text-[14px] text-danger-700">
          <ShieldX className="size-4" aria-hidden />
          Non publiée{r.reviewNote ? ` : ${r.reviewNote}` : '.'}
        </p>
      )}

      <div className="grid items-start gap-6 md:grid-cols-[300px_minmax(0,1fr)]">
        <div className="md:sticky md:top-24">
          <ResourceCover resource={r} className="h-[380px] rounded-xl ring-1 ring-border/70" />
          {r.canEdit && <CoverEditor resource={r} />}
        </div>

        <div className={cn(panel, 'p-5 sm:p-7')}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-teal-800">
              <Icon className="size-4" aria-hidden />
              {resourceKindLabels[r.kind]}
            </span>
            {r.domain && <Badge tone="teal">{r.domain.name}</Badge>}
          </div>
          <h1 className="mt-3 font-display text-[28px] leading-tight font-semibold tracking-[-0.02em] text-ink-900 sm:text-[34px]">
            {r.title}
          </h1>
          {r.workAuthor && (
            <p className="mt-1 text-[16px] text-muted-foreground">de {r.workAuthor}</p>
          )}

          <a href="#titre-avis" className="mt-3 inline-flex items-center gap-2 text-[14px]">
            <Stars value={r.rating.average ?? 0} />
            <span className="font-semibold text-ink-900">
              {r.rating.average === null ? '' : r.rating.average.toLocaleString('fr-FR')}
            </span>
            <span className="text-muted-foreground">
              {r.rating.count === 0 ? 'Pas encore d’avis' : `${r.rating.count} avis`}
            </span>
          </a>

          <div className="mt-6 flex flex-wrap gap-3">
            {readable && (
              <Button asChild size="lg">
                <Link href={`/ressources/${r.id}/lire`}>
                  <BookOpenText aria-hidden />
                  Lire en ligne
                </Link>
              </Button>
            )}
            {r.file && (
              <Button asChild size="lg" variant={readable ? 'secondary' : 'primary'}>
                <a href={resourceFileUrl(r.id)} download={r.file.fileName}>
                  <Download aria-hidden />
                  Télécharger
                  <span className="text-[12px] font-medium opacity-70">
                    {fileKindLabel(r.file.fileName)} · {formatFileSize(r.file.size)}
                  </span>
                </a>
              </Button>
            )}
            {!r.file && r.url && (
              <Button asChild size="lg">
                <a href={r.url} target="_blank" rel="noopener noreferrer">
                  {r.kind === 'PODCAST' ? 'Écouter' : 'Ouvrir la ressource'}
                  <ArrowUpRight aria-hidden />
                </a>
              </Button>
            )}
            <Button asChild size="lg" variant="ghost">
              <a href="#discussion">
                <MessageCircleQuestion aria-hidden />
                Poser une question
              </a>
            </Button>
          </div>

          {r.description && (
            <div className="mt-7 border-t border-border/70 pt-6">
              <h2 className="text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
                Présentation
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed whitespace-pre-line text-foreground">
                {r.description}
              </p>
            </div>
          )}

          <dl className="mt-7 grid gap-x-6 gap-y-3 border-t border-border/70 pt-6 text-[14px] sm:grid-cols-2">
            {r.language && (
              <div className="flex items-center gap-2">
                <Globe2 className="size-4 text-muted-foreground" aria-hidden />
                <dt className="sr-only">Langue</dt>
                <dd>{r.language}</dd>
              </div>
            )}
            {r.license && (
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-muted-foreground" aria-hidden />
                <dt className="sr-only">Droits</dt>
                <dd>{resourceLicensePublicLabels[r.license]}</dd>
              </div>
            )}
            {r.file && (
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-muted-foreground" aria-hidden />
                <dt className="sr-only">Téléchargements</dt>
                <dd>
                  {r.downloadCount} téléchargement{r.downloadCount > 1 ? 's' : ''}
                </dd>
              </div>
            )}
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
              <dt className="sr-only">Publiée le</dt>
              <dd>Partagée le {formatDate(r.createdAt)}</dd>
            </div>
          </dl>

          <div className="mt-7 flex items-center gap-3 rounded-lg bg-background/70 p-4 ring-1 ring-border/60">
            <Avatar person={r.author} />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-muted-foreground">Partagée par</p>
              <p className="truncate font-semibold text-ink-900">{fullName(r.author)}</p>
              {r.author.mentorProfile?.headline && (
                <p className="truncate text-[13px] text-muted-foreground">
                  {r.author.mentorProfile.headline}
                </p>
              )}
            </div>
            {r.author.role === 'MENTOR' && (
              <Button asChild size="sm" variant="secondary">
                <Link href={`/mentors/${r.author.id}`}>Voir le profil</Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      <Reviews key={`${r.id}-${r.myReview?.rating ?? 0}`} resource={r} />
      <Discussion resource={r} />
    </div>
  );
}
