import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsISO8601, IsOptional, IsString, IsUrl, Length, MaxLength } from 'class-validator';
import { Modality } from '../../generated/prisma/enums.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const emptyToUndefined = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const v = value.trim();
  return v === '' ? undefined : v;
};

export class CreateSlotDto {
  /** Début du créneau, ISO 8601 avec fuseau (stocké en UTC). */
  @IsISO8601({ strict: true }, { message: 'Date de début invalide.' })
  startsAt!: string;

  @IsISO8601({ strict: true }, { message: 'Date de fin invalide.' })
  endsAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;
}

export class BookSessionDto {
  @IsString()
  @MaxLength(40)
  slotId!: string;

  @Transform(trim)
  @IsString()
  @Length(5, 200, { message: 'Le sujet de la séance doit contenir entre 5 et 200 caractères.' })
  topic!: string;

  @IsOptional()
  @IsEnum(Modality)
  modality?: Modality;
}

export class ConfirmSessionDto {
  /** Lien de réunion externe (option temporaire, pas de visio native). */
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true }, { message: 'Le lien doit être une URL https.' })
  @MaxLength(500)
  meetingUrl?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;
}

export class ListSessionsQuery {
  @IsOptional()
  @IsIn(['upcoming', 'past', 'all'])
  scope?: 'upcoming' | 'past' | 'all';
}
