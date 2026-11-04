'use client';

import { BookOpen, Plus } from 'lucide-react';
import { useState } from 'react';
import { EmptyState, ErrorState } from '@/components/feedback/states';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import type { Me, MentorshipSummary } from '@/lib/types';
import { useMentorshipResources } from './api';
import { ResourceCard } from './resource-card';
import { ResourceDialog } from './resource-dialog';

/** Onglet « Ressources » d'un mentorat : partages privés entre les deux participants. */
export function MentorshipResources({ mentorship, me }: { mentorship: MentorshipSummary; me: Me }) {
  const list = useMentorshipResources(mentorship.id);
  const [sharing, setSharing] = useState(false);
  const active = mentorship.status === 'ACTIVE';

  if (list.isError) return <ErrorState error={list.error} onRetry={() => void list.refetch()} />;
  if (list.isPending) return <Skeleton className="h-40" />;

  return (
    <div className="grid gap-5">
      {active && list.data.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={() => setSharing(true)}>
            <Plus aria-hidden />
            Partager une ressource
          </Button>
        </div>
      )}
      {list.data.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Aucune ressource partagée"
          description={`Liens, modèles ou conseils rédigés : partagez avec ${mentorship.counterpart.firstName} ce qui vous fait avancer. Seuls vous deux y avez accès.`}
          action={
            active ? (
              <Button onClick={() => setSharing(true)}>
                <Plus aria-hidden />
                Partager une ressource
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-5 md:grid-cols-2">
          {list.data.map((r) => (
            <li key={r.id}>
              <ResourceCard resource={r} me={me} />
            </li>
          ))}
        </ul>
      )}
      {active && <ResourceDialog open={sharing} onOpenChange={setSharing} mentorshipId={mentorship.id} />}
    </div>
  );
}
