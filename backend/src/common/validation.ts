import { HttpStatus, ValidationError, ValidationPipe } from '@nestjs/common';
import { DomainError } from './errors.js';

interface FieldError {
  field: string;
  messages: string[];
}

function flatten(errors: ValidationError[], parent = ''): FieldError[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = error.constraints
      ? [{ field, messages: Object.values(error.constraints) }]
      : [];
    return [...own, ...flatten(error.children ?? [], field)];
  });
}

/** ValidationPipe global : whitelist stricte, transformation et erreurs 422 détaillées par champ. */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
    stopAtFirstError: false,
    exceptionFactory: (errors) =>
      new DomainError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'VALIDATION_FAILED',
        'Certains champs sont invalides.',
        flatten(errors),
      ),
  });
}
