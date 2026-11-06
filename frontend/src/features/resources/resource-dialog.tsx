'use client';

import { FileUp, ImagePlus, Info, Link2, Paperclip, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type DragEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { useDomains } from '@/features/catalog/api';
import { errorMessage, isApiError } from '@/lib/api';
import { LANGUAGES, resourceKindLabels, resourceLicenseLabels } from '@/lib/labels';
import type { ResourceKind, ResourceLicense } from '@/lib/types';
import { cn, isStaff } from '@/lib/utils';
import { useMe } from '@/features/auth/api';
import { useCreateResource } from './api';
import {
  fileKindLabel,
  formatFileSize,
  isAcceptedFile,
  RESOURCE_FILE_ACCEPT,
  RESOURCE_FILE_MAX_BYTES,
} from './files';

const KINDS = Object.keys(resourceKindLabels) as ResourceKind[];
type Source = 'file' | 'link';

/** Choix du document : clic ou glisser-déposer, contrôle du format et de la taille avant l'envoi. */
function FileDrop({
  file,
  onChange,
  error,
  maxBytes = RESOURCE_FILE_MAX_BYTES,
}: {
  file: File | null;
  onChange: (file: File | null, error?: string) => void;
  error?: string;
  maxBytes?: number;
}) {
  const maxLabel = `${Math.round(maxBytes / 1024 / 1024)} Mo`;
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [dragging, setDragging] = useState(false);

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (!isAcceptedFile(f.name)) {
      onChange(null, 'Format non accepté : PDF, Word, Excel, PowerPoint, texte, CSV ou image.');
    } else if (f.size > maxBytes) {
      onChange(null, `Le document pèse ${formatFileSize(f.size)} : ${maxLabel} au maximum.`);
    } else if (f.size === 0) {
      onChange(null, 'Ce document est vide.');
    } else {
      onChange(f);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files[0]);
  };

  return (
    <div className="grid gap-1.5">
      <label htmlFor={inputId} className="text-sm font-semibold text-foreground">
        Document
      </label>
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept={RESOURCE_FILE_ACCEPT}
        className="sr-only"
        aria-invalid={error ? true : undefined}
        aria-describedby={`${inputId}-hint`}
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {file ? (
        <div className="flex items-center gap-3 rounded-md border border-border bg-surface-muted/60 px-3.5 py-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-ink-900 text-amber-400">
            <Paperclip className="size-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold text-ink-900">
              {file.name}
            </span>
            <span className="text-[12px] text-muted-foreground">
              {fileKindLabel(file.name)} · {formatFileSize(file.size)}
            </span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Retirer le document"
            onClick={() => onChange(null)}
          >
            <X aria-hidden />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'flex flex-col items-center justify-center gap-1.5 rounded-md border border-dashed px-4 py-6 text-center transition-colors',
            dragging
              ? 'border-teal-600 bg-teal-50/70'
              : error
                ? 'border-danger-700 bg-surface'
                : 'border-border-strong bg-surface hover:border-teal-600 hover:bg-background',
          )}
        >
          <FileUp className="size-6 text-teal-700" aria-hidden />
          <span className="text-[14px] font-semibold text-ink-900">
            Choisir un fichier ou le déposer ici
          </span>
          <span className="text-[12px] text-muted-foreground">
            PDF, Word, Excel, PowerPoint, texte ou image · {maxLabel} maximum
          </span>
        </button>
      )}
      {error ? (
        <p id={`${inputId}-hint`} role="alert" className="text-[13px] font-medium text-danger-700">
          {error}
        </p>
      ) : (
        <p id={`${inputId}-hint`} className="sr-only">
          Formats acceptés : PDF, Word, Excel, PowerPoint, OpenDocument, texte, CSV, PNG, JPEG ou
          WebP. {maxLabel} maximum.
        </p>
      )}
    </div>
  );
}

/** Réduit l'image de couverture dans le navigateur (600 px de haut au plus, JPEG) : envoi léger. */
export async function shrinkCover(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 900 / bitmap.height, 700 / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('cover'))), 'image/jpeg', 0.82),
  );
}

function CoverPicker({
  value,
  onChange,
}: {
  value: Blob | null;
  onChange: (b: Blob | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>();
  const preview = useMemo(() => (value ? URL.createObjectURL(value) : null), [value]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  return (
    <div className="grid gap-1.5">
      <span className="text-sm font-semibold text-foreground">
        Couverture <span className="font-normal text-muted-foreground">(facultatif)</span>
      </span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-24 w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-md border border-dashed border-border-strong bg-surface text-muted-foreground transition-colors hover:border-teal-600 hover:text-teal-700"
          aria-label={value ? 'Changer la couverture' : 'Ajouter une couverture'}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="size-5" aria-hidden />
          )}
        </button>
        <div className="min-w-0 text-[12px] text-muted-foreground">
          <p>Image JPEG, PNG ou WebP. Elle est réduite automatiquement pour rester légère.</p>
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="mt-1 font-semibold text-danger-700 hover:underline"
            >
              Retirer la couverture
            </button>
          )}
          {error && (
            <p role="alert" className="mt-1 font-medium text-danger-700">
              {error}
            </p>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          setError(undefined);
          shrinkCover(f)
            .then(onChange)
            .catch(() => setError('Image illisible : choisissez un fichier JPEG, PNG ou WebP.'));
        }}
      />
    </div>
  );
}

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
  const [kind, setKind] = useState<ResourceKind>(mentorshipId ? 'ADVICE' : 'BOOK');
  const [domainId, setDomainId] = useState('');
  const [source, setSource] = useState<Source>('file');
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [cover, setCover] = useState<Blob | null>(null);
  const [workAuthor, setWorkAuthor] = useState('');
  const [language, setLanguage] = useState('');
  const [license, setLicense] = useState<ResourceLicense | ''>('');
  const [rights, setRights] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { data: me } = useMe();
  const staff = isStaff(me?.role);
  const library = !mentorshipId;

  const reset = () => {
    setTitle('');
    setKind(mentorshipId ? 'ADVICE' : 'BOOK');
    setDomainId('');
    setSource('file');
    setFile(null);
    setUrl('');
    setDescription('');
    setCover(null);
    setWorkAuthor('');
    setLanguage('');
    setLicense('');
    setRights(false);
    setErrors({});
  };

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) reset();
  };

  const chooseFile = (f: File | null, error?: string) => {
    setFile(f);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.file;
      return error ? { ...next, file: error } : next;
    });
    // Le titre est proposé à partir du nom du fichier s'il n'a pas encore été saisi.
    if (f && !title.trim()) setTitle(f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    const link = source === 'link' ? url.trim() : '';
    const doc = source === 'file' ? file : null;
    if (title.trim().length < 3) next.title = 'Le titre doit contenir au moins 3 caractères.';
    if (link && !/^https:\/\/\S+\.\S+/.test(link)) next.url = 'Le lien doit commencer par https://';
    if (library && doc && !license) next.license = 'Indiquez la licence du document.';
    if (library && doc && !rights) next.rightsConfirmed = 'Cette confirmation est obligatoire.';
    if (!doc && !link && !description.trim()) {
      if (source === 'file')
        next.file = 'Choisissez un document, ou rédigez un conseil ci-dessous.';
      else next.url = 'Ajoutez un lien, ou rédigez un conseil ci-dessous.';
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    create.mutate(
      {
        title: title.trim(),
        kind,
        domainId: domainId || undefined,
        url: link || undefined,
        description: description.trim() || undefined,
        file: doc ?? undefined,
        ...(library
          ? {
              cover: cover ?? undefined,
              workAuthor: workAuthor.trim() || undefined,
              language: language || undefined,
              license: doc ? license || undefined : undefined,
              rightsConfirmed: doc ? rights : undefined,
            }
          : {}),
      },
      {
        onSuccess: (res) => {
          if (mentorshipId) toast.success('Ressource partagée');
          else if (res.status === 'PENDING')
            toast.success('Ressource envoyée à l’équipe', {
              description:
                'Elle sera visible dans la bibliothèque après validation. Vous serez prévenu·e.',
            });
          else toast.success('Ressource publiée dans la bibliothèque');
          close(false);
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

  const sources: { value: Source; label: string; icon: typeof FileUp }[] = [
    { value: 'file', label: 'Joindre un document', icon: FileUp },
    { value: 'link', label: 'Ajouter un lien', icon: Link2 },
  ];

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        title={mentorshipId ? 'Partager une ressource' : 'Publier une ressource'}
        description={
          mentorshipId
            ? 'Visible uniquement des deux participants de ce mentorat.'
            : staff
              ? 'Visible par tous les visiteurs dans la bibliothèque publique.'
              : 'Un lien ou un conseil est publié aussitôt ; un document est d’abord vérifié par l’équipe.'
        }
      >
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <Field label="Titre" error={errors.title}>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={160}
              placeholder="Ex. Préparer un entretien technique"
            />
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

          <div
            role="radiogroup"
            aria-label="Contenu de la ressource"
            className="grid grid-cols-2 gap-1 rounded-full bg-surface-muted p-1"
          >
            {sources.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={source === value}
                onClick={() => {
                  setSource(value);
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next.file;
                    delete next.url;
                    return next;
                  });
                }}
                className={cn(
                  'inline-flex h-9 items-center justify-center gap-2 rounded-full text-[14px] font-semibold transition-colors',
                  source === value
                    ? 'bg-surface text-ink-900 shadow-card'
                    : 'text-muted-foreground hover:text-ink-900',
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </button>
            ))}
          </div>

          {source === 'file' ? (
            <FileDrop
              file={file}
              onChange={chooseFile}
              error={errors.file}
              maxBytes={library && staff ? 25 * 1024 * 1024 : RESOURCE_FILE_MAX_BYTES}
            />
          ) : (
            <Field
              label="Lien"
              error={errors.url}
              hint="Adresse https d’un article, d’une vidéo ou d’un document en ligne."
            >
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                type="url"
                inputMode="url"
                placeholder="https://…"
              />
            </Field>
          )}

          {library && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Auteur de l’œuvre" optional hint="Si ce n’est pas vous.">
                  <Input
                    value={workAuthor}
                    onChange={(e) => setWorkAuthor(e.target.value)}
                    maxLength={120}
                    placeholder="Ex. Camara Laye"
                  />
                </Field>
                <Field label="Langue" optional>
                  <NativeSelect value={language} onChange={(e) => setLanguage(e.target.value)}>
                    <option value="">Non précisée</option>
                    {LANGUAGES.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              </div>
              <CoverPicker value={cover} onChange={setCover} />
            </>
          )}

          {library && source === 'file' && file && (
            <div className="grid gap-3 rounded-lg bg-surface-muted/60 p-4 ring-1 ring-border/70">
              <Field label="Droits sur ce document" error={errors.license}>
                <NativeSelect
                  value={license}
                  onChange={(e) => setLicense(e.target.value as ResourceLicense | '')}
                >
                  <option value="">Choisir…</option>
                  {(Object.keys(resourceLicenseLabels) as ResourceLicense[]).map((l) => (
                    <option key={l} value={l}>
                      {resourceLicenseLabels[l]}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <label className="flex items-start gap-2.5 text-[13px] text-foreground">
                <input
                  type="checkbox"
                  checked={rights}
                  onChange={(e) => setRights(e.target.checked)}
                  className="mt-0.5 size-4 shrink-0 accent-ink-900"
                />
                <span>
                  Je confirme avoir le droit de diffuser ce document gratuitement. Un livre acheté
                  ou une copie sans autorisation ne peut pas être publié.
                  {errors.rightsConfirmed && (
                    <span role="alert" className="mt-1 block font-medium text-danger-700">
                      {errors.rightsConfirmed}
                    </span>
                  )}
                </span>
              </label>
              {!staff && (
                <p className="flex items-start gap-2 text-[12px] text-muted-foreground">
                  <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  L’équipe vérifie chaque document avant sa publication dans la bibliothèque.
                </p>
              )}
            </div>
          )}

          <Field
            label="Conseil ou présentation"
            optional
            error={errors.description}
            counter={{ value: description.length, max: 2000 }}
          >
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              placeholder="Ce qu’il faut retenir, pourquoi c’est utile…"
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => close(false)}>
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
