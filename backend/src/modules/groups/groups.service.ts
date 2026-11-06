import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { conflict, forbidden, notFound, unprocessable } from '../../common/errors.js';
import { normalizeSearch } from '../../common/text.js';
import { NotificationsService } from '../notifications/notifications.module.js';
import { PushService } from '../push/push.module.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { readUploadedDocument, type UploadedDocument } from '../resources/resource-file.js';
import {
  GROUP_MAX_MEMBERS,
  type AddMembersDto,
  type CandidatesQuery,
  type CreateGroupDto,
  type ListGroupMessagesQuery,
  type SendGroupFileMessageDto,
  type SendGroupMessageDto,
  type UpdateGroupDto,
} from './groups.dto.js';

const personSelect = {
  id: true,
  firstName: true,
  lastName: true,
  avatarUpdatedAt: true,
  role: true,
} as const;

const messageSelect = {
  id: true,
  content: true,
  createdAt: true,
  senderId: true,
  sender: { select: { id: true, firstName: true, lastName: true, avatarUpdatedAt: true } },
  file: { select: { fileName: true, mimeType: true, size: true } },
} as const;

type Candidate = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUpdatedAt: Date | null;
  role: 'MENTOR' | 'MENTEE';
  /** Pourquoi cette personne peut être ajoutée (affiché dans le sélecteur). */
  relation: string;
};

/**
 * Groupes d'accompagnement.
 *
 * Règles :
 *  - seul un mentor crée un groupe ; il en est le responsable (owner) et en reste membre ;
 *  - il peut y ajouter ses mentorés (mentorat actif ou terminé) et des mentors publiés ;
 *    personne d'autre (pas d'ajout d'inconnus) ;
 *  - tout membre lit et écrit dans le fil, et peut quitter le groupe ;
 *  - le responsable renomme, ajoute, retire des membres ou supprime le groupe ;
 *  - un non-membre reçoit 404 : on ne révèle pas l'existence du groupe.
 */
@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeService,
    private readonly push: PushService,
  ) {}

  // ─── Accès ────────────────────────────────────────────────────────────────

  private async membership(user: AuthUser, groupId: string) {
    const member = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: user.id } },
      select: { lastReadAt: true, group: { select: { id: true, ownerId: true, name: true } } },
    });
    if (!member) throw notFound('GROUP_NOT_FOUND', 'Groupe introuvable.');
    return {
      ...member.group,
      lastReadAt: member.lastReadAt,
      isOwner: member.group.ownerId === user.id,
    };
  }

  private async assertOwner(user: AuthUser, groupId: string) {
    const group = await this.membership(user, groupId);
    if (!group.isOwner) {
      throw forbidden('NOT_GROUP_OWNER', 'Seul le mentor responsable du groupe peut faire cela.');
    }
    return group;
  }

  // ─── Personnes ajoutables ─────────────────────────────────────────────────

  private async eligible(ownerId: string): Promise<Map<string, Candidate>> {
    const [mentorships, mentors] = await Promise.all([
      this.prisma.mentorship.findMany({
        where: {
          mentorId: ownerId,
          status: { in: ['ACTIVE', 'COMPLETED'] },
          mentee: { status: 'ACTIVE' },
        },
        orderBy: { startedAt: 'desc' },
        select: { status: true, mentee: { select: personSelect } },
      }),
      this.prisma.user.findMany({
        where: {
          id: { not: ownerId },
          role: 'MENTOR',
          status: 'ACTIVE',
          mentorProfile: { isPublished: true },
        },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        take: 300,
        select: { ...personSelect, mentorProfile: { select: { headline: true } } },
      }),
    ]);
    const out = new Map<string, Candidate>();
    for (const m of mentorships) {
      const existing = out.get(m.mentee.id);
      if (existing && m.status !== 'ACTIVE') continue;
      out.set(m.mentee.id, {
        ...m.mentee,
        role: 'MENTEE',
        relation: m.status === 'ACTIVE' ? 'Votre mentoré·e' : 'Ancien·ne mentoré·e',
      });
    }
    for (const u of mentors) {
      if (out.has(u.id)) continue;
      out.set(u.id, {
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        avatarUpdatedAt: u.avatarUpdatedAt,
        role: 'MENTOR',
        relation: u.mentorProfile?.headline ? `Mentor · ${u.mentorProfile.headline}` : 'Mentor',
      });
    }
    return out;
  }

  async candidates(user: AuthUser, q: CandidatesQuery, groupId?: string) {
    if (groupId) await this.assertOwner(user, groupId);
    const all = [...(await this.eligible(user.id)).values()];
    const members = groupId
      ? new Set(
          (
            await this.prisma.groupMember.findMany({ where: { groupId }, select: { userId: true } })
          ).map((m) => m.userId),
        )
      : new Set<string>();
    const term = q.q ? normalizeSearch(q.q) : '';
    return (
      all
        .filter((c) => !members.has(c.id))
        .filter((c) => !term || normalizeSearch(`${c.firstName} ${c.lastName}`).includes(term))
        // Mentorés d'abord : c'est le cas d'usage principal.
        .sort((a, b) => (a.role === b.role ? 0 : a.role === 'MENTEE' ? -1 : 1))
        .slice(0, 50)
    );
  }

  private async assertEligible(ownerId: string, userIds: string[]) {
    if (userIds.length === 0) return;
    const eligible = await this.eligible(ownerId);
    const refused = userIds.filter((id) => !eligible.has(id));
    if (refused.length > 0) {
      throw unprocessable(
        'GROUP_MEMBER_NOT_ELIGIBLE',
        'Vous pouvez ajouter uniquement vos mentorés et des mentors de la plateforme.',
        { userIds: refused },
      );
    }
  }

  private async notifyAdded(groupId: string, groupName: string, by: AuthUser, userIds: string[]) {
    await Promise.all(
      userIds.map((userId) =>
        this.notifications.notify({
          userId,
          type: 'GROUP_ADDED',
          title: `${by.firstName} ${by.lastName} vous a ajouté·e au groupe « ${groupName} »`,
          body: 'Vous pouvez échanger avec tous les membres du groupe dans la messagerie.',
          link: `/messages?g=${groupId}`,
        }),
      ),
    );
  }

  // ─── Groupes ──────────────────────────────────────────────────────────────

  async create(user: AuthUser, dto: CreateGroupDto) {
    const memberIds = dto.memberIds.filter((id) => id !== user.id);
    await this.assertEligible(user.id, memberIds);
    const group = await this.prisma.mentoringGroup.create({
      data: {
        ownerId: user.id,
        name: dto.name,
        description: dto.description ?? null,
        members: {
          create: [
            { userId: user.id, lastReadAt: new Date() },
            ...memberIds.map((userId) => ({ userId })),
          ],
        },
      },
      select: { id: true, name: true },
    });
    await this.notifyAdded(group.id, group.name, user, memberIds);
    return this.getOne(user, group.id);
  }

  /** Groupes de l'utilisateur, avec dernier message et nombre de messages non lus. */
  async listMine(user: AuthUser) {
    const memberships = await this.prisma.groupMember.findMany({
      where: { userId: user.id },
      select: {
        lastReadAt: true,
        group: {
          select: {
            id: true,
            name: true,
            description: true,
            ownerId: true,
            createdAt: true,
            _count: { select: { members: true } },
            members: {
              orderBy: { joinedAt: 'asc' },
              take: 3,
              select: { user: { select: personSelect } },
            },
            messages: { orderBy: { createdAt: 'desc' }, take: 1, select: messageSelect },
          },
        },
      },
    });
    const unread = await Promise.all(
      memberships.map((m) =>
        this.prisma.groupMessage.count({
          where: {
            groupId: m.group.id,
            senderId: { not: user.id },
            ...(m.lastReadAt ? { createdAt: { gt: m.lastReadAt } } : {}),
          },
        }),
      ),
    );
    return memberships
      .map(({ group: g }, i) => ({
        id: g.id,
        name: g.name,
        description: g.description,
        isOwner: g.ownerId === user.id,
        createdAt: g.createdAt,
        memberCount: g._count.members,
        preview: g.members.map((m) => m.user),
        lastMessage: g.messages[0] ?? null,
        unreadCount: unread[i],
      }))
      .sort(
        (a, b) =>
          new Date(b.lastMessage?.createdAt ?? b.createdAt).getTime() -
          new Date(a.lastMessage?.createdAt ?? a.createdAt).getTime(),
      );
  }

  async getOne(user: AuthUser, groupId: string) {
    const access = await this.membership(user, groupId);
    const g = await this.prisma.mentoringGroup.findUniqueOrThrow({
      where: { id: groupId },
      select: {
        id: true,
        name: true,
        description: true,
        ownerId: true,
        createdAt: true,
        members: {
          orderBy: { joinedAt: 'asc' },
          select: { joinedAt: true, user: { select: personSelect } },
        },
      },
    });
    return {
      id: g.id,
      name: g.name,
      description: g.description,
      ownerId: g.ownerId,
      isOwner: access.isOwner,
      createdAt: g.createdAt,
      members: g.members
        .map((m) => ({ ...m.user, joinedAt: m.joinedAt, isOwner: m.user.id === g.ownerId }))
        .sort((a, b) => Number(b.isOwner) - Number(a.isOwner)),
    };
  }

  async update(user: AuthUser, groupId: string, dto: UpdateGroupDto) {
    await this.assertOwner(user, groupId);
    await this.prisma.mentoringGroup.update({
      where: { id: groupId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description || null } : {}),
      },
    });
    return this.getOne(user, groupId);
  }

  async remove(user: AuthUser, groupId: string) {
    await this.assertOwner(user, groupId);
    await this.prisma.mentoringGroup.delete({ where: { id: groupId } });
  }

  async addMembers(user: AuthUser, groupId: string, dto: AddMembersDto) {
    const group = await this.assertOwner(user, groupId);
    const existing = new Set(
      (
        await this.prisma.groupMember.findMany({ where: { groupId }, select: { userId: true } })
      ).map((m) => m.userId),
    );
    const added = dto.userIds.filter((id) => !existing.has(id));
    await this.assertEligible(user.id, added);
    if (existing.size + added.length > GROUP_MAX_MEMBERS) {
      throw conflict(
        'GROUP_FULL',
        `Un groupe compte au plus ${GROUP_MAX_MEMBERS} membres, vous compris.`,
      );
    }
    await this.prisma.groupMember.createMany({
      data: added.map((userId) => ({ groupId, userId })),
      skipDuplicates: true,
    });
    await this.notifyAdded(groupId, group.name, user, added);
    return this.getOne(user, groupId);
  }

  /** Retrait d'un membre par le responsable, ou départ volontaire d'un membre. */
  async removeMember(user: AuthUser, groupId: string, memberId: string) {
    const group = await this.membership(user, groupId);
    if (memberId === group.ownerId) {
      throw conflict(
        'GROUP_OWNER_CANNOT_LEAVE',
        'Le mentor responsable ne peut pas quitter son groupe : supprimez-le plutôt.',
      );
    }
    if (memberId !== user.id && !group.isOwner) {
      throw forbidden(
        'NOT_GROUP_OWNER',
        'Seul le mentor responsable du groupe peut retirer un membre.',
      );
    }
    const result = await this.prisma.groupMember.deleteMany({
      where: { groupId, userId: memberId },
    });
    if (result.count === 0)
      throw notFound('GROUP_MEMBER_NOT_FOUND', 'Cette personne n’est pas membre du groupe.');
  }

  // ─── Fil de discussion ───────────────────────────────────────────────────

  async listMessages(user: AuthUser, groupId: string, q: ListGroupMessagesQuery) {
    await this.membership(user, groupId);
    const rows = await this.prisma.groupMessage.findMany({
      where: { groupId, ...(q.after ? { createdAt: { gt: new Date(q.after) } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: q.limit,
      select: messageSelect,
    });
    return rows.reverse();
  }

  /** Prévient les autres membres : en direct dans l'application, et en push sinon. */
  private async broadcast(groupId: string, sender: AuthUser, text: string) {
    const members = await this.prisma.groupMember.findMany({
      where: { groupId, userId: { not: sender.id } },
      select: { userId: true, group: { select: { name: true } } },
    });
    const ids = members.map((m) => m.userId);
    this.realtime.emitToUsers(ids, 'group:message', { groupId });
    void this.push.sendToUsers(ids, {
      title: members[0]?.group.name ?? 'Groupe',
      body: `${sender.firstName} : ${text}`,
      url: `/messages?g=${groupId}`,
      tag: `group-${groupId}`,
    });
  }

  async sendFile(
    user: AuthUser,
    groupId: string,
    dto: SendGroupFileMessageDto,
    upload?: UploadedDocument,
  ) {
    await this.membership(user, groupId);
    if (!upload) {
      throw unprocessable('FILE_REQUIRED', 'Choisissez un fichier à envoyer.', [
        { field: 'file', messages: ['Choisissez un fichier à envoyer.'] },
      ]);
    }
    const file = readUploadedDocument(upload);
    const message = await this.prisma.groupMessage.create({
      data: {
        groupId,
        senderId: user.id,
        content: dto.content ?? '',
        hasFile: true,
        file: { create: file },
      },
      select: messageSelect,
    });
    await this.prisma.groupMember.update({
      where: { groupId_userId: { groupId, userId: user.id } },
      data: { lastReadAt: message.createdAt },
    });
    await this.broadcast(groupId, user, dto.content || `Fichier : ${file.fileName}`);
    return message;
  }

  /** Pièce jointe d'un message de groupe : membres actuels uniquement (404 sinon). */
  async file(user: AuthUser, messageId: string) {
    const message = await this.prisma.groupMessage.findUnique({
      where: { id: messageId },
      select: {
        groupId: true,
        file: { select: { fileName: true, mimeType: true, size: true, data: true } },
      },
    });
    const missing = notFound('FILE_NOT_FOUND', 'Fichier introuvable.');
    if (!message?.file) throw missing;
    const member = await this.prisma.groupMember.count({
      where: { groupId: message.groupId, userId: user.id },
    });
    if (!member) throw missing;
    return message.file;
  }

  async send(user: AuthUser, groupId: string, dto: SendGroupMessageDto) {
    await this.membership(user, groupId);
    const data = { groupId, senderId: user.id, content: dto.content };
    const message = dto.clientId
      ? await this.prisma.groupMessage.upsert({
          where: { senderId_clientId: { senderId: user.id, clientId: dto.clientId } },
          create: { ...data, clientId: dto.clientId },
          update: {},
          select: messageSelect,
        })
      : await this.prisma.groupMessage.create({ data, select: messageSelect });
    // Son propre message ne compte jamais comme non lu.
    await this.prisma.groupMember.update({
      where: { groupId_userId: { groupId, userId: user.id } },
      data: { lastReadAt: message.createdAt },
    });
    await this.broadcast(groupId, user, dto.content);
    return message;
  }

  async markRead(user: AuthUser, groupId: string) {
    await this.membership(user, groupId);
    await this.prisma.groupMember.update({
      where: { groupId_userId: { groupId, userId: user.id } },
      data: { lastReadAt: new Date() },
    });
    return { ok: true };
  }
}
