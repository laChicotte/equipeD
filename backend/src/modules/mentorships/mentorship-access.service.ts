import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { conflict, forbidden, notFound } from '../../common/errors.js';
import type { AuthUser } from '../../common/auth/auth-user.js';

export interface MentorshipAccess {
  id: string;
  mentorId: string;
  menteeId: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  isMentor: boolean;
  counterpartId: string;
}

/**
 * Point de contrôle unique de l'appartenance à un mentorat.
 * Utilisé par la messagerie, les objectifs et les séances : seuls les deux
 * participants d'un mentorat peuvent accéder à ses données.
 */
@Injectable()
export class MentorshipAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertParticipant(user: AuthUser, mentorshipId: string): Promise<MentorshipAccess> {
    const m = await this.prisma.mentorship.findUnique({
      where: { id: mentorshipId },
      select: { id: true, mentorId: true, menteeId: true, status: true },
    });
    if (!m) throw notFound('MENTORSHIP_NOT_FOUND', 'Mentorat introuvable.');
    if (m.mentorId !== user.id && m.menteeId !== user.id) {
      throw forbidden('NOT_PARTICIPANT', 'Vous ne participez pas à ce mentorat.');
    }
    const isMentor = m.mentorId === user.id;
    return { ...m, isMentor, counterpartId: isMentor ? m.menteeId : m.mentorId };
  }

  /**
   * La conversation survit à la clôture : mentor et mentoré restent en contact après un
   * mentorat terminé. Seul un mentorat annulé ferme la messagerie.
   */
  async assertMessagingParticipant(
    user: AuthUser,
    mentorshipId: string,
  ): Promise<MentorshipAccess> {
    const access = await this.assertParticipant(user, mentorshipId);
    if (access.status === 'CANCELLED') {
      throw conflict(
        'MENTORSHIP_CANCELLED',
        'Ce mentorat a été annulé : la conversation est fermée.',
      );
    }
    // Plus de nouveaux messages vers un compte supprimé ou suspendu (l'historique reste lisible).
    const counterpart = await this.prisma.user.findUnique({
      where: { id: access.counterpartId },
      select: { status: true },
    });
    if (counterpart?.status !== 'ACTIVE') {
      throw conflict(
        'COUNTERPART_UNAVAILABLE',
        'Cette personne n’est plus joignable sur la plateforme.',
      );
    }
    return access;
  }

  async assertActiveParticipant(user: AuthUser, mentorshipId: string): Promise<MentorshipAccess> {
    const access = await this.assertParticipant(user, mentorshipId);
    if (access.status !== 'ACTIVE') {
      throw conflict(
        'MENTORSHIP_NOT_ACTIVE',
        'Ce mentorat n’est plus actif : il est consultable en lecture seule.',
      );
    }
    return access;
  }
}
