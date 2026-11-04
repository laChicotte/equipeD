import { Transform } from 'class-transformer';
import {
  IsBooleanString,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
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
}

export class AvailabilityRangeQuery {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}
