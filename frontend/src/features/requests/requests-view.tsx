'use client';

import { ArrowRight, Check, Inbox, MapPin, MessagesSquare, Search, Send, Target, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState, ErrorState, PageHeader } from '@/components/feedback/states';
import { StatusBadge } from '@/components/feedback/status-badge';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/input';
import { Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc';
import { useMe } from '@/features/auth/api';
import { errorMessage } from '@/lib/api';
import { formatRelative, fullName } from '@/lib/format';
import { modalityLabels, situationLabels } from '@/lib/labels';
import type { MentorshipRequest } from '@/lib/types';
import { useCancelRequest, useDecideRequest, useRequests } from './api';

function DecisionDialog({
  request,
  action,
  onClose,
}: {
  request: MentorshipRequest;
  action: 'accept' | 'decline';
  onClose: () => void;
}) {
  const decide = useDecideRequest();
  const router = useRouter();
  const [note, setNote] = useState('');
  const accept = action === 'accept';
  const name = request.mentee.firstName;

  const submit = () => {
    decide.mutate(
      { id: request.id, action, note: note.trim() || undefined },
      {
        onSuccess: (res) => {
          if (accept) {
            toast.success(`Vous accompagnez désormais ${name}`, {
              description: 'La conversation privée est ouverte.',
              action: res.mentorship
                ? { label: 'Ouvrir', onClick: () => router.push(`/mentorats/${res.mentorship!.id}`) }
                : undefined,
            });
          } else {
            toast.success('Demande déclinée.');
          }
          onClose();
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title={accept ? `Accepter la demande de ${name}` : `Décliner la demande de ${name}`}
        description={
          accept
            ? 'Un espace de mentorat avec conversation privée sera créé.'
            : 'Un mot bienveillant aide le mentoré à rebondir.'
        }
      >
        <Field label={accept ? 'Message de bienvenue' : 'Explication'} optional counter={{ value: note.length, max: 500 }}>
          <Textarea
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder={
              accept
                ? 'Ex. : Ravie de vous accompagner ! Commençons par un premier échange.'
                : 'Ex. : Mon agenda est complet ce mois-ci, je vous conseille de contacter…'
            }
          />
        </Field>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant={accept ? 'accent' : 'danger'} onClick={submit} loading={decide.isPending}>
            {!decide.isPending && (accept ? <Check aria-hidden /> : <X aria-hidden />)}
            {accept ? 'Accepter' : 'Décliner'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RequestItem({ request, box }: { request: MentorshipRequest; box: 'inbox' | 'sent' }) {
  const [decision, setDecision] = useState<'accept' | 'decline' | null>(null);
  const cancel = useCancelRequest();
  const person = box === 'inbox' ? request.mentee : request.mentor;
  const profile = request.mentee.menteeProfile;

  return (
    <Card className="p-5 transition-shadow hover:shadow-raised sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <Avatar person={person} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold tracking-tight">
                {box === 'sent' ? (
                  <Link href={`/mentors/${request.mentor.id}`} className="hover:underline">
                    {fullName(person)}
                  </Link>
                ) : (
                  fullName(person)
                )}
              </h3>
              <p className="text-sm text-muted-foreground">
                {box === 'inbox'
                  ? [profile && situationLabels[profile.situation], profile?.city].filter(Boolean).join(' · ')
                  : request.mentor.mentorProfile?.headline}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{formatRelative(request.createdAt)}</span>
              <StatusBadge kind="request" status={request.status} />
            </div>
          </div>

          <div className="mt-4 rounded-md border border-border bg-surface-muted/60 p-4">
            <p className="flex items-start gap-2 text-sm font-semibold">
              <Target className="mt-0.5 size-4 shrink-0 text-teal-700" aria-hidden />
              {request.goal}
            </p>
            <p className="mt-2 max-w-[70ch] text-sm leading-relaxed whitespace-pre-line text-foreground/85">
              {request.message}
            </p>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {request.domain && <Badge tone="teal">{request.domain.name}</Badge>}
            {box === 'inbox' && profile && (
              <Badge tone="outline">
                <MapPin aria-hidden />
                {modalityLabels[profile.preferredModality]}
              </Badge>
            )}
            {box === 'inbox' &&
              profile?.desiredSkills.slice(0, 4).map((s) => (
                <Badge key={s} tone="neutral">
                  {s}
                </Badge>
              ))}
          </div>

          {request.decisionNote && (
            <p className="mt-3 border-l-2 border-teal-600 pl-3 text-sm text-muted-foreground italic">
              « {request.decisionNote} »
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {box === 'inbox' && request.status === 'PENDING' && (
              <>
                <Button variant="accent" size="sm" onClick={() => setDecision('accept')}>
                  <Check aria-hidden />
                  Accepter
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setDecision('decline')}>
                  Décliner
                </Button>
              </>
            )}
            {box === 'sent' && request.status === 'PENDING' && (
              <Button
                variant="danger-ghost"
                size="sm"
                loading={cancel.isPending}
                onClick={() =>
                  cancel.mutate(request.id, {
                    onSuccess: () => toast.success('Demande annulée.'),
                    onError: (e) => toast.error(errorMessage(e)),
                  })
                }
              >
                Annuler la demande
              </Button>
            )}
            {request.mentorship && request.status === 'ACCEPTED' && (
              <Button asChild size="sm">
                <Link href={`/mentorats/${request.mentorship.id}`}>
                  <MessagesSquare aria-hidden />
                  Ouvrir l’espace de mentorat
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
      {decision && <DecisionDialog request={request} action={decision} onClose={() => setDecision(null)} />}
    </Card>
  );
}

function RequestList({ box, filter }: { box: 'inbox' | 'sent'; filter: 'PENDING' | 'ALL' }) {
  const q = useRequests(box);
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  if (q.isPending)
    return (
      <div className="grid gap-4">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  const items = filter === 'PENDING' ? q.data.filter((r) => r.status === 'PENDING') : q.data;
  if (items.length === 0) {
    return box === 'inbox' ? (
      <EmptyState
        icon={Inbox}
        title={filter === 'PENDING' ? 'Aucune demande en attente' : 'Aucune demande pour l’instant'}
        description="Les demandes des mentorés apparaîtront ici. Un profil complet et des créneaux publiés attirent plus de demandes."
        action={
          <Button asChild variant="secondary">
            <Link href="/disponibilites">Publier des créneaux</Link>
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={Send}
        title={filter === 'PENDING' ? 'Aucune demande en attente' : 'Aucune demande pour l’instant'}
        description="Trouvez un mentor qui correspond à votre objectif et envoyez-lui une demande motivée."
        action={
          <Button asChild>
            <Link href="/mentors">
              <Search aria-hidden />
              Explorer les mentors
            </Link>
          </Button>
        }
      />
    );
  }
  return (
    <ul className="grid gap-4">
      {items.map((r) => (
        <li key={r.id}>
          <RequestItem request={r} box={box} />
        </li>
      ))}
    </ul>
  );
}

export function RequestsView() {
  const { data: me } = useMe();
  if (!me) return null;
  const box = me.role === 'MENTOR' ? 'inbox' : 'sent';
  return (
    <>
      <PageHeader
        title={box === 'inbox' ? 'Demandes reçues' : 'Mes demandes'}
        description={
          box === 'inbox'
            ? 'Prenez connaissance des objectifs de chaque mentoré avant de répondre.'
            : 'Suivez l’état de vos demandes d’accompagnement.'
        }
        actions={
          box === 'sent' ? (
            <Button asChild variant="secondary">
              <Link href="/mentors">
                Trouver un mentor
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          ) : undefined
        }
      />
      <Tabs defaultValue="PENDING">
        <TabsList>
          <TabsTrigger value="PENDING">En attente</TabsTrigger>
          <TabsTrigger value="ALL">Toutes</TabsTrigger>
        </TabsList>
        <TabsContent value="PENDING">
          <RequestList box={box} filter="PENDING" />
        </TabsContent>
        <TabsContent value="ALL">
          <RequestList box={box} filter="ALL" />
        </TabsContent>
      </Tabs>
    </>
  );
}
