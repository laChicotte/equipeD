'use client';

import { CalendarDays, CalendarPlus, History, Search } from 'lucide-react';
import Link from 'next/link';
import { EmptyState, ErrorState, PageHeader } from '@/components/feedback/states';
import { Button } from '@/components/ui/button';
import { Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc';
import { useMe } from '@/features/auth/api';
import { useMyWorkshops } from '@/features/groups/api';
import { WorkshopCard } from '@/features/groups/workshops';
import type { Me } from '@/lib/types';
import { useSessions } from './api';
import { SessionCard } from './session-card';

function SessionList({ scope, me }: { scope: 'upcoming' | 'past'; me: Me }) {
  const q = useSessions(scope);
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  if (q.isPending)
    return (
      <div className="grid gap-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    );
  const items = scope === 'past' ? [...q.data].reverse() : q.data;
  if (items.length === 0) {
    return scope === 'upcoming' ? (
      <EmptyState
        icon={CalendarDays}
        title="Aucune séance à venir"
        description={
          me.role === 'MENTOR'
            ? 'Publiez des créneaux : vos mentorés pourront réserver une séance.'
            : 'Réservez un créneau libre depuis l’espace de mentorat de votre mentor.'
        }
        action={
          <Button asChild variant="secondary">
            {me.role === 'MENTOR' ? (
              <Link href="/disponibilites">
                <CalendarPlus aria-hidden />
                Gérer mes créneaux
              </Link>
            ) : (
              <Link href="/mentorats">
                <Search aria-hidden />
                Mes mentorats
              </Link>
            )}
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={History}
        title="Aucune séance passée"
        description="L’historique de vos séances apparaîtra ici."
      />
    );
  }
  return (
    <ul className="grid gap-3">
      {items.map((s) => (
        <li key={s.id}>
          <SessionCard session={s} me={me} />
        </li>
      ))}
    </ul>
  );
}

/** Ateliers à venir de tous mes groupes (masqué s'il n'y en a aucun). */
function UpcomingWorkshops({ me }: { me: Me }) {
  const q = useMyWorkshops('upcoming');
  if (!q.data || q.data.length === 0) return null;
  return (
    <section aria-labelledby="titre-ateliers" className="mb-8">
      <h2 id="titre-ateliers" className="mb-3 text-base font-semibold tracking-tight">
        Ateliers de groupe à venir
      </h2>
      <ul className="grid gap-3">
        {q.data.map((w) => (
          <li key={w.id}>
            <WorkshopCard workshop={w} me={me} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SessionsView() {
  const { data: me } = useMe();
  if (!me) return null;
  return (
    <>
      <PageHeader
        title="Séances"
        description={
          me.role === 'MENTOR'
            ? 'Confirmez les séances demandées et partagez un lien de réunion externe.'
            : 'Retrouvez vos séances confirmées et celles en attente de confirmation.'
        }
      />
      <UpcomingWorkshops me={me} />
      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">À venir</TabsTrigger>
          <TabsTrigger value="past">Passées</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming">
          <SessionList scope="upcoming" me={me} />
        </TabsContent>
        <TabsContent value="past">
          <SessionList scope="past" me={me} />
        </TabsContent>
      </Tabs>
    </>
  );
}
