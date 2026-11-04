'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { useDomains } from '@/features/catalog/api';
import { errorMessage, isApiError } from '@/lib/api';
import { resourceKindLabels } from '@/lib/labels';
import type { ResourceKind } from '@/lib/types';
import { useCreateResource } from './api';

const KINDS = Object.keys(resourceKindLabels) as ResourceKind[];

/** Publication dans la bibliothèque, ou partage privé dans un mentorat si `mentorshipId` est fourni. */
export function ResourceDialog({
  open,
  onOpenChange,
  mentorshipId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mentorshipId?: string;
}) {
  const create = useCreateResource(mentorshipId);
  const domains = useDomains();
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<ResourceKind>('ADVICE');
  const [domainId, setDomainId] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const reset = () => {
    setTitle('');
    setKind('ADVICE');
    setDomainId('');
    setUrl('');
    setDescription('');
    setErrors({});
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (title.trim().length < 3) next.title = 'Le titre doit contenir au moins 3 caractères.';
    if (url.trim() && !/^https:\/\/\S+\.\S+/.test(url.trim())) next.url = 'Le lien doit commencer par https://';
    if (!url.trim() && !description.trim()) next.url = 'Ajoutez un lien ou un contenu rédigé.';
    setErrors(next);
    if (Object.keys(next).length) return;

    create.mutate(
      {
        title: title.trim(),
        kind,
        domainId: domainId || undefined,
        url: url.trim() || undefined,
        description: description.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success(mentorshipId ? 'Ressource partagée' : 'Ressource publiée dans la bibliothèque');
          reset();
          onOpenChange(false);
        },
        onError: (err) => {
          if (isApiError(err) && err.details.length) {
            setErrors(Object.fromEntries(err.details.map((d) => [d.field, d.messages[0]])));
            return;
          }
          toast.error(errorMessage(err));
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={mentorshipId ? 'Partager une ressource' : 'Publier une ressource'}
        description={
          mentorshipId
            ? 'Visible uniquement des deux participants de ce mentorat.'
            : 'Visible par tous les visiteurs dans la bibliothèque publique.'
        }
      >
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <Field label="Titre" error={errors.title}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="Ex. Préparer un entretien technique" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type">
              <NativeSelect value={kind} onChange={(e) => setKind(e.target.value as ResourceKind)}>
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {resourceKindLabels[k]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Domaine" optional>
              <NativeSelect value={domainId} onChange={(e) => setDomainId(e.target.value)}>
                <option value="">Aucun</option>
                {domains.data?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <Field label="Lien" optional error={errors.url} hint="Adresse https d’un article, d’une vidéo ou d’un document.">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} type="url" inputMode="url" placeholder="https://…" />
          </Field>
          <Field
            label="Conseil ou présentation"
            optional
            error={errors.description}
            counter={{ value: description.length, max: 2000 }}
          >
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} placeholder="Ce qu’il faut retenir, pourquoi c’est utile…" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={create.isPending}>
              {mentorshipId ? 'Partager' : 'Publier'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
