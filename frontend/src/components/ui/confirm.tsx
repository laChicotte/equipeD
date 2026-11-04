'use client';

import { useState, type ReactNode } from 'react';
import { Button } from './button';
import { Dialog, DialogContent, DialogFooter } from './dialog';

/** Bouton qui demande une confirmation explicite avant une action irréversible. */
export function ConfirmButton({
  title,
  description,
  confirmLabel,
  onConfirm,
  loading,
  children,
  variant = 'danger-ghost',
  size = 'sm',
}: {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  loading?: boolean;
  children: ReactNode;
  variant?: 'danger-ghost' | 'secondary' | 'danger';
  size?: 'sm' | 'md';
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        {children}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={title} description={description}>
          <DialogFooter className="mt-0">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="danger"
              loading={loading}
              onClick={() => {
                onConfirm();
                setOpen(false);
              }}
            >
              {confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
