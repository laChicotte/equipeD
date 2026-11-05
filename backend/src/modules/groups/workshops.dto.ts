import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
} from 'class-validator';
import { Modality } from '../../generated/prisma/enums.js';

const trimOrUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

export class CreateWorkshopDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(3, 160, { message: 'Le titre de l’atelier contient entre 3 et 160 caractères.' })
  title!: string;

  @Transform(trimOrUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'La description contient au plus 2000 caractères.' })
  description?: string;

  @IsISO8601({ strict: true }, { message: 'Date de début invalide.' })
  startsAt!: string;

  @IsISO8601({ strict: true }, { message: 'Date de fin invalide.' })
  endsAt!: string;

  @IsOptional()
  @IsEnum(Modality, { message: 'Modalité attendue : REMOTE, IN_PERSON ou HYBRID.' })
  modality?: Modality;

  /** Lien de visio fourni par le mentor ; sinon une salle est générée (hors présentiel). */
  @Transform(trimOrUndefined)
  @IsOptional()
  @IsUrl(
    { protocols: ['https'], require_protocol: true },
    { message: 'Le lien de visio doit commencer par https://.' },
  )
  @MaxLength(500)
  meetingUrl?: string;

  @Transform(trimOrUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Le lieu contient au plus 200 caractères.' })
  location?: string;
}

export class WorkshopAttendanceDto {
  @IsBoolean({ message: 'Indiquez si vous participez (true ou false).' })
  going!: boolean;
}

export class ListWorkshopsQuery {
  @IsOptional()
  @IsIn(['upcoming', 'past', 'all'])
  scope?: 'upcoming' | 'past' | 'all';
}
