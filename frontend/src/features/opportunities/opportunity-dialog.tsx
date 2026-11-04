'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/misc';
import { useDomains } from '@/features/catalog/api';
import { errorMessage, isApiError } from '@/lib/api';
import { zonedToIso } from '@/lib/format';
import { opportunityTypeLabels } from '@/lib/labels';
import type { OpportunityType } from '@/lib/types';
import { useOpportunityMutations } from './api';

const TYPES = Object.keys(opportunityTypeLabels) as OpportunityType[];

export function OpportunityDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { create } = useOpportunityMutations();
  const domains = useDomains();
  const [form, setForm] = useState({
    type: 'INTERNSHIP' as OpportunityType,
    title: '',
    organization: '',
    description: '',
    location: '',
    isRemote: false,
    url: '',
    deadline: '',
    domainId: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (form.title.trim().length < 5) next.title = 'Le titre doit contenir au moins 5 caractères.';
    if (form.organization.trim().length < 2) next.organization = 'Indiquez la structure.';
    if (form.description.trim().length < 30) next.description = 'Décrivez l’opportunité en 30 caractères au moins.';
    if (form.url.trim() && !/^https:\/\/\S+\.\S+/.test(form.url.trim())) next.url = 'Le lien doit commencer par https://';
    setErrors(next);
    if (Object.keys(next).length) return;

    create.mutate(
      {
        type: form.type,
        title: form.title.trim(),
        organization: form.organization.trim(),
        description: form.description.trim(),
        location: form.location.trim() || undefined,
        isRemote: form.isRemote,
        url: form.url.trim() || undefined,
        deadline: form.deadline ? zonedToIso(form.deadline, '23:59') : undefined,
        domainId: form.domainId || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Opportunité publiée');
          onOpenChange(false);
          setForm((f) => ({ ...f, title: '', organization: '', description: '', location: '', url: '', deadline: '' }));
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
      <DialogContent title="Publier une opportunité" description="Stage, emploi, appel à projets, bourse, formation ou événement : visible par tous.">
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type">
              <NativeSelect value={form.type} onChange={(e) => set('type', e.target.value as OpportunityType)}>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {opportunityTypeLabels[t]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Domaine" optional>
              <NativeSelect value={form.domainId} onChange={(e) => set('domainId', e.target.value)}>
                <option value="">Aucun</option>
                {domains.data?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <Field label="Intitulé" error={errors.title}>
            <Input value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={160} placeholder="Ex. Stage développeur·se web (6 mois)" />
          </Field>
          <Field label="Structure" error={errors.organization}>
            <Input value={form.organization} onChange={(e) => set('organization', e.target.value)} maxLength={120} />
          </Field>
          <Field label="Description" error={errors.description} counter={{ value: form.description.length, min: 30, max: 3000 }}>
            <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={3000} placeholder="Missions, profil recherché, conditions…" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Lieu" optional>
              <Input value={form.location} onChange={(e) => set('location', e.target.value)} maxLength={120} placeholder="Conakry" />
            </Field>
            <Field label="Date limite" optional error={errors.deadline}>
              <Input type="date" value={form.deadline} onChange={(e) => set('deadline', e.target.value)} />
            </Field>
          </div>
          <label className="inline-flex items-center gap-2.5 text-sm font-semibold">
            <Checkbox checked={form.isRemote} onCheckedChange={(v) => set('isRemote', v === true)} />
            Accessible à distance
          </label>
          <Field label="Lien pour candidater" optional error={errors.url}>
            <Input value={form.url} onChange={(e) => set('url', e.target.value)} type="url" inputMode="url" placeholder="https://…" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={create.isPending}>
              Publier
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
