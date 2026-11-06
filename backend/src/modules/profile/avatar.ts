import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Injectable,
  Param,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentUser, Public } from '../../common/auth/decorators.js';
import type { AuthenticatedRequest, AuthUser } from '../../common/auth/auth-user.js';
import { DomainError, notFound, unprocessable } from '../../common/errors.js';
import { PrismaService } from '../../database/prisma.service.js';
import { isStaff } from '../../common/audit.js';

/** Taille maximale acceptée (le navigateur envoie une image recadrée d'environ 50 à 150 Ko). */
export const AVATAR_MAX_BYTES = 1024 * 1024;

type AvatarMime = 'image/jpeg' | 'image/png' | 'image/webp';

/** Type réel déduit des premiers octets : l'en-tête Content-Type n'est pas fiable. */
export function detectImageType(buf: Buffer): AvatarMime | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (
    buf.length >= 8 &&
    buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return 'image/png';
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('latin1') === 'RIFF' &&
    buf.subarray(8, 12).toString('latin1') === 'WEBP'
  )
    return 'image/webp';
  return null;
}

/** Lit le corps brut de la requête en refusant tout dépassement de taille. */
async function readBody(req: Request, max: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    total += chunk.length;
    // Au-delà de la limite, on continue de lire sans stocker pour pouvoir répondre 413
    // proprement (une réponse anticipée provoquerait une coupure de connexion côté client),
    // dans la limite de quelques mégaoctets au-delà desquels la connexion est abandonnée.
    if (total > max * 8) break;
    if (total <= max) chunks.push(chunk);
  }
  if (total > max) throw tooLarge();
  return Buffer.concat(chunks);
}

const tooLarge = () =>
  new DomainError(HttpStatus.PAYLOAD_TOO_LARGE, 'AVATAR_TOO_LARGE', 'La photo dépasse 1 Mo.');

/** Photo de profil ou bannière : même contrôle, même règle de visibilité. */
export type ImageKind = 'avatar' | 'banner';

@Injectable()
export class AvatarService {
  constructor(private readonly prisma: PrismaService) {}

  async saveBanner(user: AuthUser, data: Buffer) {
    const mimeType = this.check(data);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.userBanner.upsert({
        where: { userId: user.id },
        create: { userId: user.id, mimeType, data: new Uint8Array(data) },
        update: { mimeType, data: new Uint8Array(data) },
      }),
      this.prisma.user.update({ where: { id: user.id }, data: { bannerUpdatedAt: now } }),
    ]);
    return { bannerUpdatedAt: now };
  }

  async removeBanner(user: AuthUser) {
    await this.prisma.$transaction([
      this.prisma.userBanner.deleteMany({ where: { userId: user.id } }),
      this.prisma.user.update({ where: { id: user.id }, data: { bannerUpdatedAt: null } }),
    ]);
  }

  private check(data: Buffer) {
    if (data.length === 0) throw unprocessable('AVATAR_EMPTY', 'Aucune image reçue.');
    const mimeType = detectImageType(data);
    if (!mimeType) {
      throw unprocessable('AVATAR_INVALID_TYPE', 'Formats acceptés : JPEG, PNG ou WebP.');
    }
    return mimeType;
  }

  async save(user: AuthUser, data: Buffer) {
    if (data.length === 0) {
      throw unprocessable('AVATAR_EMPTY', 'Aucune image reçue.');
    }
    const mimeType = detectImageType(data);
    if (!mimeType) {
      throw unprocessable('AVATAR_INVALID_TYPE', 'Formats acceptés : JPEG, PNG ou WebP.');
    }
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.userAvatar.upsert({
        where: { userId: user.id },
        create: { userId: user.id, mimeType, data: new Uint8Array(data) },
        update: { mimeType, data: new Uint8Array(data) },
      }),
      this.prisma.user.update({ where: { id: user.id }, data: { avatarUpdatedAt: now } }),
    ]);
    return { avatarUpdatedAt: now };
  }

  async remove(user: AuthUser) {
    await this.prisma.$transaction([
      this.prisma.userAvatar.deleteMany({ where: { userId: user.id } }),
      this.prisma.user.update({ where: { id: user.id }, data: { avatarUpdatedAt: null } }),
    ]);
  }

  /**
   * Règle de visibilité :
   *  - photo d'un mentor publié dans l'annuaire : publique (comme sa fiche) ;
   *  - sinon : la personne elle-même, un administrateur, ou quelqu'un lié par une demande,
   *    un mentorat ou un groupe d'accompagnement. Tout autre cas répond 404 (on ne révèle pas l'existence de la photo).
   */
  async read(ownerId: string, viewer: AuthUser | undefined, kind: ImageKind = 'avatar') {
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
      select: {
        status: true,
        avatar: kind === 'avatar' ? { select: { mimeType: true, data: true } } : false,
        banner: kind === 'banner' ? { select: { mimeType: true, data: true } } : false,
        mentorProfile: { select: { isPublished: true } },
      },
    });
    const image = kind === 'avatar' ? owner?.avatar : owner?.banner;
    const missing = notFound('AVATAR_NOT_FOUND', 'Image introuvable.');
    if (!image || owner?.status !== 'ACTIVE') throw missing;

    const publicMentor = owner.mentorProfile?.isPublished === true;
    if (!publicMentor && !(await this.canSeePrivate(ownerId, viewer))) throw missing;

    return { ...image, isPublic: publicMentor };
  }

  private async canSeePrivate(ownerId: string, viewer: AuthUser | undefined) {
    if (!viewer) return false;
    if (viewer.id === ownerId || isStaff(viewer.role)) return true;
    const pair = [
      { mentorId: viewer.id, menteeId: ownerId },
      { mentorId: ownerId, menteeId: viewer.id },
    ];
    const [requests, mentorships, sharedGroups] = await Promise.all([
      this.prisma.mentorshipRequest.count({ where: { OR: pair } }),
      this.prisma.mentorship.count({ where: { OR: pair } }),
      // Membres d'un même groupe d'accompagnement.
      this.prisma.groupMember.count({
        where: { userId: ownerId, group: { members: { some: { userId: viewer.id } } } },
      }),
    ]);
    return requests + mentorships + sharedGroups > 0;
  }
}

@ApiTags('profile')
@Controller()
export class AvatarController {
  constructor(private readonly avatars: AvatarService) {}

  /** Envoi de la photo de profil : corps binaire (image/jpeg, image/png ou image/webp), 1 Mo maximum. */
  @Put('profile/me/avatar')
  @ApiConsumes('image/jpeg', 'image/png', 'image/webp')
  async upload(@CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.avatars.save(user, await readBody(req, AVATAR_MAX_BYTES));
  }

  /** Retire la photo de profil : les initiales s'affichent à nouveau. */
  @Delete('profile/me/avatar')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthUser) {
    await this.avatars.remove(user);
  }

  /** Bannière du profil : corps binaire (JPEG, PNG ou WebP), 1 Mo maximum. */
  @Put('profile/me/banner')
  @ApiConsumes('image/jpeg', 'image/png', 'image/webp')
  async uploadBanner(@CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.avatars.saveBanner(user, await readBody(req, AVATAR_MAX_BYTES));
  }

  @Delete('profile/me/banner')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeBanner(@CurrentUser() user: AuthUser) {
    await this.avatars.removeBanner(user);
  }

  /** Bannière d'un utilisateur (mêmes règles de visibilité que la photo). */
  @Public()
  @Get('users/:id/banner')
  async readBanner(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const banner = await this.avatars.read(id, req.user, 'banner');
    res
      .status(200)
      .type(banner.mimeType)
      .set({
        'Cache-Control': `${banner.isPublic ? 'public' : 'private'}, max-age=31536000, immutable`,
        'Content-Disposition': 'inline',
        'Cross-Origin-Resource-Policy': 'same-origin',
      })
      .send(Buffer.from(banner.data));
  }

  /** Photo d'un utilisateur (l'URL contient ?v=<date> : la réponse peut être mise en cache longtemps). */
  @Public()
  @Get('users/:id/avatar')
  async read(@Param('id') id: string, @Req() req: AuthenticatedRequest, @Res() res: Response) {
    const avatar = await this.avatars.read(id, req.user);
    res
      .status(200)
      .type(avatar.mimeType)
      .set({
        'Cache-Control': `${avatar.isPublic ? 'public' : 'private'}, max-age=31536000, immutable`,
        'Content-Disposition': 'inline',
        'Cross-Origin-Resource-Policy': 'same-origin',
      })
      .send(Buffer.from(avatar.data));
  }
}
