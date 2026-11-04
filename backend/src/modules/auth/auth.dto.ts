import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsString, Length, Matches, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  /** Adresse email (identifiant de connexion). */
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Adresse email invalide.' })
  @MaxLength(254)
  email!: string;

  /** Au moins 10 caractères, dont une lettre et un chiffre. */
  @IsString()
  @Length(10, 128, { message: 'Le mot de passe doit contenir entre 10 et 128 caractères.' })
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'Le mot de passe doit contenir au moins une lettre et un chiffre.',
  })
  password!: string;

  @Transform(trim)
  @IsString()
  @Length(1, 80, { message: 'Le prénom est obligatoire (80 caractères max).' })
  firstName!: string;

  @Transform(trim)
  @IsString()
  @Length(1, 80, { message: 'Le nom est obligatoire (80 caractères max).' })
  lastName!: string;

  /** Rôle choisi à l'inscription. Le rôle ADMIN ne peut pas être demandé. */
  @IsIn(['MENTEE', 'MENTOR'], { message: 'Le rôle doit être MENTEE ou MENTOR.' })
  role!: 'MENTEE' | 'MENTOR';
}

export class LoginDto {
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Adresse email invalide.' })
  @MaxLength(254)
  email!: string;

  @IsString()
  @Length(1, 128, { message: 'Le mot de passe est obligatoire.' })
  password!: string;
}
