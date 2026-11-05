'use client';

import { FileUp, Link2, Paperclip, X } from 'lucide-react';
import { useId, useRef, useState, type DragEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { useDomains } from '@/features/catalog/api';
import { errorMessage, isApiError } from '@/lib/api';
import { resourceKindLabels } from '@/lib/labels';
import type { ResourceKind } from '@/lib/types';
import { cn } from '@/lib/utils';
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
}: {
  file: File | null;
  onChange: (file: File | null, error?: string) => void;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [dragging, setDragging] = useState(false);

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (!isAcceptedFile(f.name)) {
      onChange(null, 'Format non accepté : PDF, Word, Excel, PowerPoint, texte, CSV ou image.');
    } else if (f.size > RESOURCE_FILE_MAX_BYTES) {
      onChange(null, `Le document pèse ${formatFileSize(f.size)} : 10 Mo au maximum.`);
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
            PDF, Word, Excel, PowerPoint, texte ou image · 10 Mo maximum
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
          WebP. 10 Mo maximum.
        </p>
      )}
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
  const [kind, setKind] = useState<ResourceKind>('ADVICE');
  const [domainId, setDomainId] = useState('');
  const [source, setSource] = useState<Source>('file');
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const reset = () => {
    setTitle('');
    setKind('ADVICE');
    setDomainId('');
    setSource('file');
    setFile(null);
    setUrl('');
    setDescription('');
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
      },
      {
        onSuccess: () => {
          toast.success(
            mentorshipId ? 'Ressource partagée' : 'Ressource publiée dans la bibliothèque',
          );
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
            : 'Visible par tous les visiteurs dans la bibliothèque publique.'
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
            <FileDrop file={file} onChange={chooseFile} error={errors.file} />
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
