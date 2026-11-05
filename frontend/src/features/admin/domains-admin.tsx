'use client';

import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { DomainIcon } from '@/components/domain-icon';
import { ErrorState, PageHeader } from '@/components/feedback/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/misc';
import { errorMessage, isApiError } from '@/lib/api';
import type { AdminDomain } from '@/lib/types';
import { useAdminDomainMutations, useAdminDomains } from './api';

const ICONS = ['rocket', 'code', 'compass', 'book-open', 'landmark', 'sparkles', 'graduation-cap'];

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function DomainDialog({
  domain,
  open,
  onOpenChange,
}: {
  domain?: AdminDomain;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { create, update } = useAdminDomainMutations();
  const [name, setName] = useState(domain?.name ?? '');
  const [slug, setSlug] = useState(domain?.slug ?? '');
  const [description, setDescription] = useState(domain?.description ?? '');
  const [icon, setIcon] = useState(domain?.icon ?? 'compass');
  const [topics, setTopics] = useState(domain?.topics.join(', ') ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const pending = create.isPending || update.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const topicList = topics
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const onError = (err: unknown) => {
      if (isApiError(err) && err.details.length) {
        setErrors(Object.fromEntries(err.details.map((d) => [d.field, d.messages[0]])));
        return;
      }
      toast.error(errorMessage(err));
    };
    const onSuccess = () => {
      toast.success(domain ? 'Domaine mis à jour' : 'Domaine créé');
      onOpenChange(false);
    };
    if (domain) {
      update.mutate(
        { id: domain.id, patch: { name, description, icon, topics: topicList } },
        { onSuccess, onError },
      );
    } else {
      create.mutate(
        { slug: slug || slugify(name), name, description, icon, topics: topicList },
        { onSuccess, onError },
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={domain ? 'Modifier le domaine' : 'Nouveau domaine'}>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <Field label="Nom" error={errors.name}>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          </Field>
          {!domain && (
            <Field
              label="Identifiant d’URL"
              hint={`Minuscules et tirets. Proposé : ${slugify(name) || '—'}`}
              error={errors.slug}
            >
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder={slugify(name)}
                maxLength={80}
              />
            </Field>
          )}
          <Field
            label="Description"
            error={errors.description}
            counter={{ value: description.length, min: 10, max: 500 }}
          >
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
            <Field label="Icône">
              <NativeSelect value={icon} onChange={(e) => setIcon(e.target.value)}>
                {ICONS.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field
              label="Thématiques"
              optional
              hint="Séparées par des virgules."
              error={errors.topics}
            >
              <Input value={topics} onChange={(e) => setTopics(e.target.value)} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={pending}>
              {domain ? 'Enregistrer' : 'Créer le domaine'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DomainsAdmin() {
  const list = useAdminDomains();
  const { update } = useAdminDomainMutations();
  const [editing, setEditing] = useState<AdminDomain | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Domaines"
        description="Le catalogue d’accompagnement. Un domaine désactivé disparaît du site sans perdre son historique."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden />
            Nouveau domaine
          </Button>
        }
      />
      {list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : list.isPending ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="overflow-x-auto rounded-lg bg-surface ring-1 ring-border">
          <table className="w-full min-w-[720px] border-collapse text-left text-[14px]">
            <thead>
              <tr className="border-b border-border text-[13px] text-muted-foreground">
                <th className="px-5 py-3 font-semibold">Domaine</th>
                <th className="px-5 py-3 text-right font-semibold">Mentors</th>
                <th className="px-5 py-3 text-right font-semibold">Mentorés</th>
                <th className="px-5 py-3 text-right font-semibold">Ressources</th>
                <th className="px-5 py-3 font-semibold">État</th>
                <th className="px-5 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((d) => (
                <tr key={d.id} className="border-b border-border last:border-b-0">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex size-9 shrink-0 items-center justify-center bg-ink-900 text-amber-400">
                        <DomainIcon name={d.icon} className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-ink-900">{d.name}</p>
                        <p className="text-[13px] text-muted-foreground">/{d.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right tabular-nums">{d._count.mentors}</td>
                  <td className="px-5 py-4 text-right tabular-nums">{d._count.mentees}</td>
                  <td className="px-5 py-4 text-right tabular-nums">{d._count.resources}</td>
                  <td className="px-5 py-4">
                    <Badge tone={d.isActive ? 'success' : 'neutral'}>
                      {d.isActive ? 'Actif' : 'Désactivé'}
                    </Badge>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(d)}>
                        <Pencil aria-hidden />
                        Modifier
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={update.isPending && update.variables?.id === d.id}
                        onClick={() =>
                          update.mutate(
                            { id: d.id, patch: { isActive: !d.isActive } },
                            {
                              onSuccess: () =>
                                toast.success(
                                  d.isActive ? 'Domaine désactivé' : 'Domaine réactivé',
                                ),
                              onError: (e) => toast.error(errorMessage(e)),
                            },
                          )
                        }
                      >
                        {d.isActive ? 'Désactiver' : 'Réactiver'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {creating && <DomainDialog open onOpenChange={setCreating} />}
      {editing && (
        <DomainDialog
          key={editing.id}
          domain={editing}
          open
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}
    </div>
  );
}
