import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { MentorshipRequestStatus } from '../../generated/prisma/enums.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateMentorshipRequestDto {
  @IsString()
  @MaxLength(40)
  mentorId!: string;

  /** Domaine concerné (facultatif, doit faire partie des domaines du mentor). */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  domainId?: string;

  /** Objectif explicite de l'accompagnement. */
  @Transform(trim)
  @IsString()
  @Length(10, 200, { message: "L'objectif doit contenir entre 10 et 200 caractères." })
  goal!: string;

  /** Message de motivation adressé au mentor. */
  @Transform(trim)
  @IsString()
  @Length(40, 2000, { message: 'Votre message doit contenir entre 40 et 2000 caractères.' })
  message!: string;
}

export class DecisionDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'La note doit contenir au plus 500 caractères.' })
  note?: string;
}

export class ListRequestsQuery {
  @IsOptional()
  @IsEnum(MentorshipRequestStatus)
  status?: MentorshipRequestStatus;
}
