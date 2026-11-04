'use client';

import { Download, KeyRound, LogOut, ShieldAlert, Trash2, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/feedback/states';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect } from '@/components/ui/input';
import { useMe } from '@/features/auth/api';
import { errorMessage, isApiError } from '@/lib/api';
import { TIMEZONES, roleLabels } from '@/lib/labels';
import type { Me } from '@/lib/types';
import { useAccountMutations } from './api';

function Section({ icon: Icon, title, description, children }: { icon: typeof UserRound; title: string; description: ReactNode; children: ReactNode }) {
  return (
    <section className="grid gap-5 border-t border-border py-8 first:border-t-0 first:pt-0 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:gap-10">
      <div>
        <h2 className="flex items-center gap-2.5 font-display text-[19px] font-semibold tracking-[-0.02em] text-ink-900">
          <Icon className="size-5 text-teal-700" aria-hidden />
          {title}
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="bg-surface p-6 ring-1 ring-border">{children}</div>
    </section>
  );
}

function fieldErrors(err: unknown): Record<string, string> {
  return isApiError(err) ? Object.fromEntries(err.details.map((d) => [d.field, d.messages[0]])) : {};
}

function IdentityForm({ me }: { me: Me }) {
  const { updateAccount } = useAccountMutations();
  const [firstName, setFirstName] = useState(me.firstName);
  const [lastName, setLastName] = useState(me.lastName);
  const [timezone, setTimezone] = useState(me.timezone);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dirty = firstName !== me.firstName || lastName !== me.lastName || timezone !== me.timezone;
  const zones = TIMEZONES.some((z) => z.value === me.timezone) ? TIMEZONES : [{ value: me.timezone, label: me.timezone }, ...TIMEZONES];

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        updateAccount.mutate(
          { firstName: firstName.trim(), lastName: lastName.trim(), timezone },
          {
            onSuccess: () => {
              setErrors({});
              toast.success('Informations enregistrées');
            },
            onError: (err) => {
              setErrors(fieldErrors(err));
              if (!isApiError(err) || !err.details.length) toast.error(errorMessage(err));
            },
          },
        );
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prénom" error={errors.firstName}>
          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={80} autoComplete="given-name" />
        </Field>
        <Field label="Nom" error={errors.lastName}>
          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={80} autoComplete="family-name" />
        </Field>
      </div>
      <Field label="Adresse email" hint="L’adresse de connexion ne peut pas être modifiée ici.">
        <Input value={me.email} disabled readOnly />
      </Field>
      <Field label="Fuseau horaire" hint="Utilisé pour afficher vos séances et vos créneaux." error={errors.timezone}>
        <NativeSelect value={timezone} onChange={(e) => setTimezone(e.target.value)}>
          {zones.map((z) => (
            <option key={z.value} value={z.value}>
              {z.label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <div className="flex justify-end">
        <Button type="submit" disabled={!dirty} loading={updateAccount.isPending}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}

function PasswordForm() {
  const { changePassword } = useAccountMutations();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const local: Record<string, string> = {};
        if (!current) local.currentPassword = 'Saisissez votre mot de passe actuel.';
        if (next.length < 10 || !/[A-Za-z]/.test(next) || !/\d/.test(next))
          local.newPassword = 'Au moins 10 caractères, dont une lettre et un chiffre.';
        setErrors(local);
        if (Object.keys(local).length) return;
        changePassword.mutate(
          { currentPassword: current, newPassword: next },
          {
            onSuccess: (r) => {
              setCurrent('');
              setNext('');
              toast.success('Mot de passe modifié', {
                description:
                  r.revokedSessions > 0
                    ? `${r.revokedSessions} autre${r.revokedSessions > 1 ? 's' : ''} session${r.revokedSessions > 1 ? 's' : ''} déconnectée${r.revokedSessions > 1 ? 's' : ''}.`
                    : undefined,
              });
            },
            onError: (err) => {
              setErrors(fieldErrors(err));
              if (!isApiError(err) || !err.details.length) toast.error(errorMessage(err));
            },
          },
        );
      }}
    >
      <Field label="Mot de passe actuel" error={errors.currentPassword}>
        <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
      </Field>
      <Field label="Nouveau mot de passe" hint="Au moins 10 caractères, dont une lettre et un chiffre." error={errors.newPassword}>
        <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" loading={changePassword.isPending}>
          Modifier le mot de passe
        </Button>
      </div>
    </form>
  );
}

function DeleteAccount() {
  const router = useRouter();
  const { deleteAccount } = useAccountMutations();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  return (
    <>
      <p className="text-[15px] leading-relaxed text-foreground">
        Vos données personnelles sont anonymisées, vos mentorats en cours sont clôturés et vos séances
        à venir annulées. Les messages déjà échangés restent visibles de l’autre participant, attribués
        à « Compte supprimé ». Cette action est définitive.
      </p>
      <div className="mt-5 flex justify-end">
        <Button variant="danger" onClick={() => setOpen(true)}>
          <Trash2 aria-hidden />
          Supprimer mon compte
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Supprimer définitivement votre compte ?" description="Cette action ne peut pas être annulée.">
          <form
            className="grid gap-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              deleteAccount.mutate(
                { password, confirmation },
                {
                  onSuccess: () => {
                    toast.success('Votre compte a été supprimé.');
                    router.replace('/');
                  },
                  onError: (err) => {
                    setErrors(fieldErrors(err));
                    if (!isApiError(err) || !err.details.length) toast.error(errorMessage(err));
                  },
                },
              );
            }}
          >
            <Field label="Mot de passe" error={errors.password}>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </Field>
            <Field label="Tapez SUPPRIMER pour confirmer" error={errors.confirmation}>
              <Input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} autoComplete="off" />
            </Field>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" variant="danger" disabled={confirmation !== 'SUPPRIMER' || !password} loading={deleteAccount.isPending}>
                Supprimer définitivement
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function AccountView() {
  const { data: me } = useMe();
  const router = useRouter();
  const { logoutAll } = useAccountMutations();
  if (!me) return null;

  return (
    <div className="animate-fade-in">
      <PageHeader title="Mon compte" description={`${me.firstName} ${me.lastName} · ${roleLabels[me.role]}`} />
      <div className="mt-8">
        <Section icon={UserRound} title="Informations" description="Votre nom apparaît sur votre profil et dans vos conversations.">
          <IdentityForm key={`${me.firstName}${me.lastName}${me.timezone}`} me={me} />
        </Section>
        <Section icon={KeyRound} title="Mot de passe" description="Changer de mot de passe déconnecte vos autres appareils. Cette session reste ouverte.">
          <PasswordForm />
        </Section>
        <Section icon={LogOut} title="Sessions" description="Un appareil perdu ou partagé ? Déconnectez-vous partout en un clic.">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-[15px] text-foreground">Toutes les sessions ouvertes, y compris celle-ci, seront fermées.</p>
            <Button
              variant="secondary"
              loading={logoutAll.isPending}
              onClick={() =>
                logoutAll.mutate(undefined, {
                  onSuccess: (r) => {
                    toast.success(`${r.revokedSessions} session${r.revokedSessions > 1 ? 's' : ''} fermée${r.revokedSessions > 1 ? 's' : ''}`);
                    router.replace('/connexion');
                  },
                  onError: (e) => toast.error(errorMessage(e)),
                })
              }
            >
              <LogOut aria-hidden />
              Se déconnecter de tous les appareils
            </Button>
          </div>
        </Section>
        <Section icon={Download} title="Mes données" description="Téléchargez une copie de toutes les données vous concernant, au format JSON.">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-[15px] text-foreground">Profil, demandes, mentorats, séances, messages envoyés, objectifs et notifications.</p>
            <Button asChild variant="secondary">
              <a href="/api/v1/profile/me/export" download>
                <Download aria-hidden />
                Exporter mes données
              </a>
            </Button>
          </div>
        </Section>
        {me.role !== 'ADMIN' && (
          <Section icon={ShieldAlert} title="Supprimer le compte" description="Suppression définitive par anonymisation.">
            <DeleteAccount />
          </Section>
        )}
      </div>
    </div>
  );
}
