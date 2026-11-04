import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsTimeZone,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MenteeSituation, Modality } from '../../generated/prisma/enums.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const emptyToUndefined = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const v = value.trim();
  return v === '' ? undefined : v;
};

export class UpsertMentorProfileDto {
  @Transform(trim)
  @IsString()
  @Length(10, 140, { message: 'Le titre doit contenir entre 10 et 140 caractères.' })
  headline!: string;

  @Transform(trim)
  @IsString()
  @Length(80, 2000, { message: 'La présentation doit contenir entre 80 et 2000 caractères.' })
  bio!: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  currentPosition?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  organization?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1, { message: "Indiquez au moins 1 année d'expérience." })
  @Max(60)
  yearsExperience!: number;

  /** Compétences précises (ex. « React », « Business plan »). */
  @IsArray()
  @ArrayMinSize(1, { message: 'Ajoutez au moins une compétence.' })
  @ArrayMaxSize(15)
  @IsString({ each: true })
  @Length(2, 50, {
    each: true,
    message: 'Chaque compétence doit contenir entre 2 et 50 caractères.',
  })
  expertise!: string[];

  @IsArray()
  @ArrayMinSize(1, { message: 'Indiquez au moins une langue.' })
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @Length(2, 30, { each: true })
  languages!: string[];

  @IsArray()
  @ArrayMinSize(1, { message: 'Choisissez au moins une modalité.' })
  @ArrayMaxSize(3)
  @IsEnum(Modality, { each: true })
  modalities!: Modality[];

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsArray()
  @ArrayMinSize(1, { message: "Choisissez au moins un domaine d'expertise." })
  @ArrayMaxSize(4, { message: '4 domaines au maximum.' })
  @IsString({ each: true })
  domainIds!: string[];

  @Type(() => Number)
  @IsIn([30, 45, 60, 90], { message: 'Durée de séance : 30, 45, 60 ou 90 minutes.' })
  sessionDurationMin!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  maxMentees!: number;
}

export class UpsertMenteeProfileDto {
  @IsEnum(MenteeSituation, { message: 'Situation invalide.' })
  situation!: MenteeSituation;

  /** Objectif principal de l'accompagnement. */
  @Transform(trim)
  @IsString()
  @Length(20, 1000, { message: 'Décrivez votre objectif en 20 à 1000 caractères.' })
  goalsSummary!: string;

  @IsArray()
  @ArrayMaxSize(15)
  @IsString({ each: true })
  @Length(2, 50, { each: true })
  desiredSkills!: string[];

  @IsEnum(Modality, { message: 'Modalité invalide.' })
  preferredModality!: Modality;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsArray()
  @ArrayMinSize(1, { message: "Choisissez au moins un domaine d'intérêt." })
  @ArrayMaxSize(5, { message: "5 domaines d'intérêt au maximum." })
  @IsString({ each: true })
  interestDomainIds!: string[];
}

export class UpdateAccountDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 80, { message: 'Le prénom doit contenir entre 1 et 80 caractères.' })
  firstName?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 80, { message: 'Le nom doit contenir entre 1 et 80 caractères.' })
  lastName?: string;

  /** Fuseau IANA utilisé pour l'affichage des dates (ex. Africa/Conakry). */
  @IsOptional()
  @IsString()
  @IsTimeZone({ message: 'Fuseau horaire inconnu (format IANA attendu, ex. Africa/Conakry).' })
  timezone?: string;
}
