import { Transform } from 'class-transformer';
import {
  IsBooleanString,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  IsIn,
} from 'class-validator';
import { MENTOR_SORTS, type MentorSort } from './ranking.js';
import { Modality } from '../../generated/prisma/enums.js';
import { PaginationQuery } from '../../common/pagination.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class ListMentorsQuery extends PaginationQuery {
  /** Mot-clé : nom, titre, compétence, domaine (insensible aux accents). */
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  /** Slug du domaine (ex. numerique-technologies). */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  domain?: string;

  @IsOptional()
  @IsEnum(Modality)
  modality?: Modality;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(30)
  language?: string;

  /** « true » : uniquement les mentors ayant un créneau libre dans les 14 prochains jours. */
  @IsOptional()
  @IsBooleanString()
  available?: string;

  /** Ordre : pertinence (défaut), expérience, disponibilité ou note. Voir ranking.ts. */
  @IsOptional()
  @IsIn(MENTOR_SORTS, { message: 'Tri attendu : relevance, experience, availability ou rating.' })
  sort: MentorSort = 'relevance';
}

export class AutocompleteQuery {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;
}

export class AvailabilityRangeQuery {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}
