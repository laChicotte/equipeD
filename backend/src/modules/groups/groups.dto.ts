import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Taille maximale d'un groupe, créateur compris. */
export const GROUP_MAX_MEMBERS = 50;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const trimOrUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

export class CreateGroupDto {
  @Transform(trim)
  @IsString()
  @Length(2, 80, { message: 'Le nom du groupe contient entre 2 et 80 caractères.' })
  name!: string;

  @Transform(trimOrUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'La description contient au plus 500 caractères.' })
  description?: string;

  /** Personnes ajoutées dès la création (mentorés du créateur ou mentors publiés). */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(GROUP_MAX_MEMBERS - 1)
  @IsString({ each: true })
  memberIds: string[] = [];
}

export class UpdateGroupDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(2, 80, { message: 'Le nom du groupe contient entre 2 et 80 caractères.' })
  name?: string;

  /** Chaîne vide : la description est retirée. */
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'La description contient au plus 500 caractères.' })
  description?: string;
}

export class AddMembersDto {
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(GROUP_MAX_MEMBERS - 1)
  @IsString({ each: true })
  userIds!: string[];
}

export class CandidatesQuery {
  @Transform(trimOrUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;
}

export class SendGroupMessageDto {
  @Transform(trim)
  @IsString()
  @Length(1, 2000, { message: 'Un message contient entre 1 et 2000 caractères.' })
  content!: string;
}

/** Message avec pièce jointe : la légende est facultative. */
export class SendGroupFileMessageDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Un message contient au plus 2000 caractères.' })
  content?: string;
}

export class GroupFileQuery {
  /** « 1 » : affichage dans la page (images uniquement) ; sinon téléchargement. */
  @IsOptional()
  @IsIn(['1'])
  inline?: string;
}

export class ListGroupMessagesQuery {
  @IsOptional()
  @IsISO8601()
  after?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit: number = 100;
}
