'use client';

import {
  BadgeCheck,
  Database,
  Download,
  GraduationCap,
  Lock,
  LogOut,
  ShieldCheck,
  Trash2,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { cloneElement, useId, useState, type ReactElement, type ReactNode } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/feedback/states';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect } from '@/components/ui/input';
import { useMe } from '@/features/auth/api';
import { ClearOfflineButton, DataSaverSetting } from '@/features/offline/offline-settings';
import {
  BecomeMentorSection,
  MentorVerificationSection,
} from '@/features/verification/verification-views';
import { errorMessage, isApiError } from '@/lib/api';
import { TIMEZONES } from '@/lib/labels';
import type { Me } from '@/lib/types';
import { cn, isStaff } from '@/lib/utils';
import { useAccountMutations } from './api';
import { AvatarSection } from './avatar-editor';

/** Bloc de réglages : un titre, puis des lignes séparées. */
function Panel({
  title,
  description,
  danger = false,
  children,
}: {
  title: string;
  description?: ReactNode;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-lg bg-surface shadow-card ring-1',
        danger ? 'ring-danger-700/25' : 'ring-border/70',
      )}
    >
      <header className="border-b border-border/70 px-5 py-4 sm:px-6">
        <h2
          className={cn(
            'font-display text-[17px] font-semibold tracking-[-0.01em]',
            danger ? 'text-danger-700' : 'text-ink-900',
          )}
        >
          {title}
        </h2>
        {description && (
          <p className="mt-0.5 text-[14px] leading-relaxed text-muted-foreground">{description}</p>
        )}
      </header>
      {children}
    </section>
  );
}

/** Ligne de réglage : libellé à gauche, champ à droite (empilés sur mobile). */
function Row({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactElement<Record<string, unknown>>;
}) {
  const id = useId();
  const describedBy = `${id}-help`;
  return (
    <div className="grid gap-1.5 border-b border-border/60 px-5 py-3.5 last:border-b-0 sm:grid-cols-[200px_minmax(0,1fr)] sm:items-center sm:gap-5 sm:px-6">
      <label htmlFor={id} className="text-[14px] font-medium text-ink-800">
        {label}
      </label>
      <div className="max-w-md">
        {cloneElement(children, {
          id,
          'aria-invalid': error ? true : undefined,
          'aria-describedby': error || hint ? describedBy : undefined,
        })}
        {error ? (
          <p id={describedBy} role="alert" className="mt-1 text-[13px] font-medium text-danger-700">
            {error}
          </p>
        ) : (
          hint && (
            <p id={describedBy} className="mt-1 text-[13px] text-muted-foreground">
              {hint}
            </p>
          )
        )}
      </div>
    </div>
  );
}

/** Ligne d'action : explication à gauche, bouton à droite. */
function ActionRow({
  title,
  description,
  children,
}: {
  title: string;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 px-5 py-4 last:border-b-0 sm:px-6">
      <div className="min-w-0 flex-1 basis-64">
        <p className="text-[14px] font-medium text-ink-900">{title}</p>
        <p className="mt-0.5 text-[14px] leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

/** Pied de formulaire : le bouton d'enregistrement reste au même endroit partout. */
function FormFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-end border-t border-border/70 bg-surface-muted/40 px-5 py-3 sm:px-6">
      {children}
    </div>
  );
}

function fieldErrors(err: unknown): Record<string, string> {
  return isApiError(err)
    ? Object.fromEntries(err.details.map((d) => [d.field, d.messages[0]]))
    : {};
}

function IdentityForm({ me }: { me: Me }) {
  const { updateAccount } = useAccountMutations();
  const [firstName, setFirstName] = useState(me.firstName);
  const [lastName, setLastName] = useState(me.lastName);
  const [timezone, setTimezone] = useState(me.timezone);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dirty = firstName !== me.firstName || lastName !== me.lastName || timezone !== me.timezone;
  const zones = TIMEZONES.some((z) => z.value === me.timezone)
    ? TIMEZONES
    : [{ value: me.timezone, label: me.timezone }, ...TIMEZONES];

  return (
    <form
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
      <Row label="Prénom" error={errors.firstName}>
        <Input
          className="h-10"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          maxLength={80}
          autoComplete="given-name"
        />
      </Row>
      <Row label="Nom" error={errors.lastName}>
        <Input
          className="h-10"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          maxLength={80}
          autoComplete="family-name"
        />
      </Row>
      <Row label="E-mail" hint="L’adresse de connexion ne peut pas être modifiée ici.">
        <ReadOnlyEmail value={me.email} />
      </Row>
      <Row
        label="Fuseau horaire"
        hint="Utilisé pour afficher vos séances et vos créneaux."
        error={errors.timezone}
      >
        <NativeSelect
          className="h-10"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
        >
          {zones.map((z) => (
            <option key={z.value} value={z.value}>
              {z.label}
            </option>
          ))}
        </NativeSelect>
      </Row>
      <FormFooter>
        <Button type="submit" size="sm" disabled={!dirty} loading={updateAccount.isPending}>
          Enregistrer
        </Button>
      </FormFooter>
    </form>
  );
}

/** E-mail non modifiable : champ grisé avec un cadenas. */
function ReadOnlyEmail({ value, ...props }: { value: string; id?: string }) {
  return (
    <span className="relative block">
      <Input className="h-10 pr-10" value={value} disabled readOnly {...props} />
      <Lock
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
    </span>
  );
}

function PasswordForm() {
  const { changePassword } = useAccountMutations();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  return (
    <form
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
      <Row label="Mot de passe actuel" error={errors.currentPassword}>
        <Input
          className="h-10"
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
        />
      </Row>
      <Row
        label="Nouveau mot de passe"
        hint="Au moins 10 caractères, dont une lettre et un chiffre."
        error={errors.newPassword}
      >
        <Input
          className="h-10"
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
        />
      </Row>
      <FormFooter>
        <Button type="submit" size="sm" loading={changePassword.isPending}>
          Modifier le mot de passe
        </Button>
      </FormFooter>
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
      <ActionRow
        title="Supprimer mon compte"
        description="Vos données personnelles sont anonymisées, vos mentorats en cours clôturés et vos séances à venir annulées. Les messages déjà échangés restent visibles de l’autre participant, attribués à « Compte supprimé ». Cette action est définitive."
      >
        <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
          <Trash2 aria-hidden />
          Supprimer mon compte
        </Button>
      </ActionRow>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title="Supprimer définitivement votre compte ?"
          description="Cette action ne peut pas être annulée."
        >
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
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </Field>
            <Field label="Tapez SUPPRIMER pour confirmer" error={errors.confirmation}>
              <Input
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="off"
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button
                type="submit"
                variant="danger"
                disabled={confirmation !== 'SUPPRIMER' || !password}
                loading={deleteAccount.isPending}
              >
                Supprimer définitivement
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

type SectionKey = 'profil' | 'verification' | 'securite' | 'donnees';

function sectionsFor(me: Me): { key: SectionKey; label: string; icon: LucideIcon }[] {
  return [
    { key: 'profil', label: 'Profil', icon: UserRound },
    ...(me.role === 'MENTOR' && me.hasProfile
      ? [{ key: 'verification' as const, label: 'Vérification', icon: BadgeCheck }]
      : []),
    ...(me.role === 'MENTEE'
      ? [{ key: 'verification' as const, label: 'Devenir mentor', icon: GraduationCap }]
      : []),
    { key: 'securite', label: 'Sécurité', icon: ShieldCheck },
    { key: 'donnees', label: 'Données et confidentialité', icon: Database },
  ];
}

function ProfileSection({ me }: { me: Me }) {
  return (
    <div className="grid gap-5">
      <section className="rounded-lg bg-surface p-5 shadow-card ring-1 ring-border/70 sm:px-6">
        <AvatarSection />
      </section>
      <Panel
        title="Informations"
        description="Votre nom apparaît sur votre profil et dans vos conversations."
      >
        <IdentityForm key={`${me.firstName}${me.lastName}${me.timezone}`} me={me} />
      </Panel>
      {!isStaff(me.role) && (
        <Panel title={me.role === 'MENTOR' ? 'Profil de mentor' : 'Profil de mentoré·e'}>
          <ActionRow
            title={
              me.role === 'MENTOR'
                ? 'Parcours, compétences et modalités'
                : 'Objectifs et centres d’intérêt'
            }
            description={
              me.role === 'MENTOR'
                ? 'Ce que les mentorés voient sur votre fiche dans l’annuaire.'
                : 'Ces informations servent à vous recommander les mentors les plus pertinents.'
            }
          >
            <Button asChild variant="secondary" size="sm">
              <Link href="/onboarding">Modifier</Link>
            </Button>
          </ActionRow>
        </Panel>
      )}
    </div>
  );
}

function SecuritySection() {
  const router = useRouter();
  const { logoutAll } = useAccountMutations();
  return (
    <div className="grid gap-5">
      <Panel
        title="Mot de passe"
        description="Le changer déconnecte vos autres appareils. Cette session reste ouverte."
      >
        <PasswordForm />
      </Panel>
      <Panel title="Sessions">
        <ActionRow
          title="Se déconnecter partout"
          description="Un appareil perdu ou partagé ? Toutes les sessions ouvertes, y compris celle-ci, seront fermées."
        >
          <Button
            variant="secondary"
            size="sm"
            loading={logoutAll.isPending}
            onClick={() =>
              logoutAll.mutate(undefined, {
                onSuccess: (r) => {
                  toast.success(
                    `${r.revokedSessions} session${r.revokedSessions > 1 ? 's' : ''} fermée${r.revokedSessions > 1 ? 's' : ''}`,
                  );
                  router.replace('/connexion');
                },
                onError: (e) => toast.error(errorMessage(e)),
              })
            }
          >
            <LogOut aria-hidden />
            Déconnecter tous les appareils
          </Button>
        </ActionRow>
      </Panel>
    </div>
  );
}

function DataSection({ me }: { me: Me }) {
  return (
    <div className="grid gap-5">
      <Panel title="Connexion faible et hors ligne">
        <ActionRow
          title="Économie de données"
          description="Actualisations espacées, photos masquées ou chargées à la demande. En automatique, elle s’active sur réseau 2G ou si le téléphone le demande."
        >
          <DataSaverSetting />
        </ActionRow>
        <ActionRow
          title="Données gardées sur cet appareil"
          description="Vos dernières conversations, séances et objectifs restent lisibles sans réseau, 7 jours au plus. Ils sont effacés à la déconnexion."
        >
          <ClearOfflineButton />
        </ActionRow>
      </Panel>
      <Panel title="Mes données">
        <ActionRow
          title="Exporter mes données"
          description="Une copie au format JSON : profil, demandes, mentorats, séances, messages envoyés, objectifs et notifications."
        >
          <Button asChild variant="secondary" size="sm">
            <a href="/api/v1/profile/me/export" download>
              <Download aria-hidden />
              Exporter
            </a>
          </Button>
        </ActionRow>
      </Panel>
      {!isStaff(me.role) && (
        <Panel title="Zone sensible" danger>
          <DeleteAccount />
        </Panel>
      )}
    </div>
  );
}

function VerificationPanel({ me }: { me: Me }) {
  const mentor = me.role === 'MENTOR';
  return (
    <Panel
      title={mentor ? 'Vérification du profil' : 'Devenir mentor'}
      description={
        mentor
          ? 'Le badge « Profil vérifié » est attribué par l’équipe après examen de vos justificatifs.'
          : 'Accompagné·e hier, mentor demain : faites évoluer votre compte.'
      }
    >
      <div className="p-5 sm:p-6">
        {mentor ? <MentorVerificationSection /> : <BecomeMentorSection />}
      </div>
    </Panel>
  );
}

/** Paramètres du compte : sections à gauche, contenu à droite (`?section=` pour les liens directs). */
export function AccountView() {
  const { data: me } = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  if (!me) return null;

  const sections = sectionsFor(me);
  const requested = params.get('section');
  const active = sections.find((x) => x.key === requested)?.key ?? 'profil';
  const open = (key: SectionKey) =>
    router.replace(key === 'profil' ? pathname : `${pathname}?section=${key}`, { scroll: false });

  return (
    <div className="mx-auto max-w-[1040px] animate-fade-in">
      <PageHeader
        title="Mon compte"
        description="Vos informations, votre sécurité et vos données."
      />
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
        <nav
          aria-label="Sections du compte"
          className="scrollbar-thin -mx-1 flex gap-1 overflow-x-auto px-1 pb-1 lg:sticky lg:top-24 lg:mx-0 lg:flex-col lg:overflow-visible lg:p-0"
        >
          {sections.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => open(key)}
              aria-current={active === key ? 'page' : undefined}
              className={cn(
                'inline-flex h-10 shrink-0 items-center gap-2.5 rounded-md px-3 text-left text-[14px] font-medium whitespace-nowrap transition-colors lg:w-full lg:whitespace-normal',
                active === key
                  ? 'bg-ink-900 text-white'
                  : 'text-muted-foreground hover:bg-surface hover:text-ink-900',
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {label}
            </button>
          ))}
        </nav>
        <div className="min-w-0">
          {active === 'profil' && <ProfileSection me={me} />}
          {active === 'verification' && <VerificationPanel me={me} />}
          {active === 'securite' && <SecuritySection />}
          {active === 'donnees' && <DataSection me={me} />}
        </div>
      </div>
    </div>
  );
}
