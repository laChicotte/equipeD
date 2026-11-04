import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { toast } from 'sonner';
import { errorMessage, isApiError } from './api';

/**
 * Applique une erreur d'API à un formulaire : 422 → erreurs par champ, sinon toast.
 * Renvoie `true` si au moins un champ a été marqué.
 */
export function applyApiError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly string[],
  fieldMap: Record<string, string> = {},
): boolean {
  if (isApiError(error) && error.statusCode === 422 && error.details.length > 0) {
    let mapped = false;
    for (const d of error.details) {
      const name = fieldMap[d.field] ?? d.field;
      if (fields.includes(name)) {
        setError(name as Path<T>, { type: 'server', message: d.messages[0] });
        mapped = true;
      }
    }
    if (mapped) return true;
  }
  toast.error(errorMessage(error));
  return false;
}
