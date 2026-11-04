import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { GoalStatus } from '../../generated/prisma/enums.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateGoalDto {
  @Transform(trim)
  @IsString()
  @Length(3, 160, { message: 'Le titre doit contenir entre 3 et 160 caractères.' })
  title!: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsISO8601({ strict: true }, { message: "Date d'échéance invalide." })
  dueDate?: string;

  /** Jalons initiaux (facultatifs). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @Length(2, 160, { each: true })
  milestones?: string[];
}

export class UpdateGoalDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(3, 160)
  title?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(GoalStatus)
  status?: GoalStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  progress?: number;

  @ValidateIf((_o, v) => v !== null)
  @IsOptional()
  @IsISO8601({ strict: true })
  dueDate?: string | null;

  /** Réservé au mentor. */
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  mentorFeedback?: string;
}

export class CreateMilestoneDto {
  @Transform(trim)
  @IsString()
  @Length(2, 160)
  title!: string;
}

export class UpdateMilestoneDto {
  @IsOptional()
  @IsBoolean()
  isDone?: boolean;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(2, 160)
  title?: string;
}
