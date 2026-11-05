'use client';

import { Check, Crown, LogOut, Search, Trash2, UserMinus, UserPlus } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { toast } from 'sonner';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ConfirmButton } from '@/components/ui/confirm';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/misc';
import { errorMessage } from '@/lib/api';
import { fullName } from '@/lib/format';
import type { GroupCandidate, GroupDetail, Me } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useGroup, useGroupCandidates, useGroupMutations } from './api';

const roleLabel = { MENTOR: 'Mentor', MENTEE: 'Mentoré·e', ADMIN: 'Équipe' };

/** Sélection de personnes : les mentorés du mentor d'abord, puis les mentors de la plateforme. */
function MemberPicker({
  groupId,
  selected,
  onToggle,
}: {
  groupId: string | null;
  selected: Map<string, GroupCandidate>;
  onToggle: (c: GroupCandidate) => void;
}) {
  const [q, setQ] = useState('');
  const term = useDeferredValue(q.trim());
  const candidates = useGroupCandidates(groupId, term);

  return (
    <div className="grid gap-2">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <label htmlFor="recherche-membre" className="sr-only">
          Rechercher une personne
        </label>
        <Input
          id="recherche-membre"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un mentoré ou un mentor"
          className="h-10 pl-9 text-[14px]"
        />
      </div>
      <ul
        className="scrollbar-thin max-h-64 divide-y divide-border/60 overflow-y-auto rounded-md border border-border"
        aria-label="Personnes que vous pouvez ajouter"
      >
        {candidates.isPending ? (
          Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="p-3">
              <Skeleton className="h-9" />
            </li>
          ))
        ) : candidates.isError ? (
          <li className="p-4 text-center text-[13px] text-danger-700">
            {errorMessage(candidates.error)}
          </li>
        ) : candidates.data.length === 0 ? (
          <li className="p-4 text-center text-[13px] text-muted-foreground">
            {term
              ? 'Aucune personne ne correspond à cette recherche.'
              : 'Personne à ajouter pour l’instant : vos mentorés et les mentors publiés apparaissent ici.'}
          </li>
        ) : (
          candidates.data.map((c) => {
            const checked = selected.has(c.id);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onToggle(c)}
                  aria-pressed={checked}
                  className={cn(
                    'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
                    checked ? 'bg-teal-50/70' : 'hover:bg-background',
                  )}
                >
                  <Avatar person={c} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-ink-900">
                      {fullName(c)}
                    </span>
                    <span className="block truncate text-[12px] text-muted-foreground">
                      {c.relation}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'inline-flex size-5 shrink-0 items-center justify-center rounded-[6px] border',
                      checked ? 'border-teal-600 bg-teal-600 text-white' : 'border-border-strong',
                    )}
                    aria-hidden
                  >
                    {checked && <Check className="size-3.5" />}
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
      {selected.size > 0 && (
        <p className="text-[13px] text-muted-foreground" aria-live="polite">
          {selected.size} personne{selected.size > 1 ? 's' : ''} sélectionnée
          {selected.size > 1 ? 's' : ''} : {[...selected.values()].map(fullName).join(', ')}
        </p>
      )}
    </div>
  );
}

function useSelection() {
  const [selected, setSelected] = useState(new Map<string, GroupCandidate>());
  const toggle = (c: GroupCandidate) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(c.id)) next.delete(c.id);
      else next.set(c.id, c);
      return next;
    });
  return { selected, toggle, reset: () => setSelected(new Map()) };
}

/** Création d'un groupe par un mentor. */
export function CreateGroupDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (groupId: string) => void;
}) {
  const { create } = useGroupMutations();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | undefined>();
  const { selected, toggle, reset } = useSelection();

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setName('');
      setDescription('');
      setError(undefined);
      reset();
    }
  };

  const submit = () => {
    if (name.trim().length < 2) {
      setError('Donnez un nom au groupe (2 caractères au moins).');
      return;
    }
    create.mutate(
      {
        name: name.trim(),
        description: description.trim() || undefined,
        memberIds: [...selected.keys()],
      },
      {
        onSuccess: (group) => {
          toast.success(`Groupe « ${group.name} » créé`);
          close(false);
          onCreated(group.id);
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        title="Nouveau groupe"
        description="Accompagnez plusieurs personnes ensemble : vos mentorés, actuels ou anciens, et d’autres mentors."
        className="sm:max-w-xl"
      >
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Field label="Nom du groupe" error={error} counter={{ value: name.length, max: 80 }}>
            <Input
              value={name}
              maxLength={80}
              onChange={(e) => {
                setName(e.target.value);
                setError(undefined);
              }}
              placeholder="Ex. Promo développement web 2026"
            />
          </Field>
          <Field
            label="Objectif du groupe"
            optional
            counter={{ value: description.length, max: 500 }}
          >
            <Textarea
              value={description}
              maxLength={500}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ce que vous allez travailler ensemble"
              className="min-h-20"
            />
          </Field>
          <div className="grid gap-1.5">
            <p className="text-sm font-semibold text-foreground">Membres</p>
            <MemberPicker groupId={null} selected={selected} onToggle={toggle} />
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => close(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={create.isPending}>
              Créer le groupe
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddMembers({ group, onDone }: { group: GroupDetail; onDone: () => void }) {
  const { addMembers } = useGroupMutations();
  const { selected, toggle, reset } = useSelection();
  return (
    <div className="grid gap-3">
      <MemberPicker groupId={group.id} selected={selected} onToggle={toggle} />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onDone}>
          Annuler
        </Button>
        <Button
          size="sm"
          disabled={selected.size === 0}
          loading={addMembers.isPending}
          onClick={() =>
            addMembers.mutate(
              { id: group.id, userIds: [...selected.keys()] },
              {
                onSuccess: () => {
                  toast.success(
                    selected.size > 1 ? 'Membres ajoutés au groupe' : 'Membre ajouté au groupe',
                  );
                  reset();
                  onDone();
                },
                onError: (e) => toast.error(errorMessage(e)),
              },
            )
          }
        >
          Ajouter
        </Button>
      </div>
    </div>
  );
}

function EditGroup({ group, onDone }: { group: GroupDetail; onDone: () => void }) {
  const { update } = useGroupMutations();
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? '');
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        update.mutate(
          { id: group.id, name: name.trim(), description: description.trim() },
          {
            onSuccess: () => {
              toast.success('Groupe mis à jour');
              onDone();
            },
            onError: (err) => toast.error(errorMessage(err)),
          },
        );
      }}
    >
      <Field label="Nom du groupe" counter={{ value: name.length, max: 80 }}>
        <Input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Objectif du groupe" optional counter={{ value: description.length, max: 500 }}>
        <Textarea
          value={description}
          maxLength={500}
          onChange={(e) => setDescription(e.target.value)}
          className="min-h-20"
        />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onDone}>
          Annuler
        </Button>
        <Button type="submit" size="sm" loading={update.isPending}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}

/** Informations et membres du groupe ; gestion réservée au mentor responsable. */
export function GroupInfoDialog({
  groupId,
  me,
  open,
  onOpenChange,
  onLeft,
}: {
  groupId: string;
  me: Me;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLeft: () => void;
}) {
  const group = useGroup(open ? groupId : null);
  const { removeMember, remove } = useGroupMutations();
  const [mode, setMode] = useState<'view' | 'add' | 'edit'>('view');
  const g = group.data;

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) setMode('view');
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        title={g?.name ?? 'Groupe'}
        description={g?.description ?? undefined}
        className="sm:max-w-xl"
      >
        {!g ? (
          <div className="grid gap-3">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : mode === 'add' ? (
          <AddMembers group={g} onDone={() => setMode('view')} />
        ) : mode === 'edit' ? (
          <EditGroup group={g} onDone={() => setMode('view')} />
        ) : (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">
                {g.members.length} membre{g.members.length > 1 ? 's' : ''}
              </p>
              {g.isOwner && (
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setMode('edit')}>
                    Modifier
                  </Button>
                  <Button size="sm" onClick={() => setMode('add')}>
                    <UserPlus aria-hidden />
                    Ajouter
                  </Button>
                </div>
              )}
            </div>
            <ul className="divide-y divide-border/60 rounded-md border border-border">
              {g.members.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                  <Avatar person={m} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-ink-900">
                      {fullName(m)}
                      {m.id === me.id && (
                        <span className="font-normal text-muted-foreground"> (vous)</span>
                      )}
                    </span>
                    <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
                      {m.isOwner && <Crown className="size-3 text-amber-500" aria-hidden />}
                      {m.isOwner ? 'Responsable du groupe' : roleLabel[m.role]}
                    </span>
                  </span>
                  {g.isOwner && !m.isOwner && (
                    <ConfirmButton
                      title={`Retirer ${fullName(m)} du groupe ?`}
                      description="Cette personne n’aura plus accès au fil du groupe. Ses messages déjà envoyés restent visibles."
                      confirmLabel="Retirer"
                      loading={removeMember.isPending}
                      onConfirm={() =>
                        removeMember.mutate(
                          { id: g.id, userId: m.id },
                          {
                            onSuccess: () =>
                              toast.success(`${fullName(m)} a été retiré·e du groupe`),
                            onError: (e) => toast.error(errorMessage(e)),
                          },
                        )
                      }
                    >
                      <UserMinus aria-hidden />
                      <span className="sr-only sm:not-sr-only">Retirer</span>
                    </ConfirmButton>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex justify-end border-t border-border pt-4">
              {g.isOwner ? (
                <ConfirmButton
                  title="Supprimer le groupe ?"
                  description="Le groupe et tous ses messages seront supprimés pour tous les membres. Cette action est irréversible."
                  confirmLabel="Supprimer le groupe"
                  loading={remove.isPending}
                  onConfirm={() =>
                    remove.mutate(g.id, {
                      onSuccess: () => {
                        toast.success('Groupe supprimé');
                        close(false);
                        onLeft();
                      },
                      onError: (e) => toast.error(errorMessage(e)),
                    })
                  }
                >
                  <Trash2 aria-hidden />
                  Supprimer le groupe
                </ConfirmButton>
              ) : (
                <ConfirmButton
                  title="Quitter le groupe ?"
                  description="Vous n’aurez plus accès au fil du groupe. Le mentor responsable pourra vous y ajouter à nouveau."
                  confirmLabel="Quitter"
                  loading={removeMember.isPending}
                  onConfirm={() =>
                    removeMember.mutate(
                      { id: g.id, userId: me.id },
                      {
                        onSuccess: () => {
                          toast.success('Vous avez quitté le groupe');
                          close(false);
                          onLeft();
                        },
                        onError: (e) => toast.error(errorMessage(e)),
                      },
                    )
                  }
                >
                  <LogOut aria-hidden />
                  Quitter le groupe
                </ConfirmButton>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
