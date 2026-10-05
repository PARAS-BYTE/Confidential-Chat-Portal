import { Message, Project, Membership, User } from "@prisma/client";

/**
 * Strict Allow-List Serializers
 * INVARIANT: Never use "spread the object then delete fields".
 * Always explicitly construct and return only the permitted properties.
 */

export interface ParticipantMessageDTO {
  id: string;
  senderAlias: string;
  body: string;
  createdAt: string;
  deliveredAt: string | null;
  status: string;
  isMine: boolean;
}

export interface ParticipantProjectDTO {
  id: string;
  title: string;
  myAlias: string;
  otherAlias: string;
  lastMessagePreview?: string | null;
  lastActivityAt?: string | null;
  unreadCount?: number;
}

export interface AdminMessageDTO {
  id: string;
  conversationId: string;
  senderMembershipId: string;
  senderRealName?: string;
  senderEmail?: string;
  senderAlias: string;
  body: string;
  status: string;
  clientMessageId: string;
  deliveredAt: string | null;
  createdAt: string;
}

export interface AdminUserDTO {
  id: string;
  role: string;
  realName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
}

/**
 * Serializes a message for participant viewing.
 * Strictly guarantees ZERO leakage of sender's real name, email, phone, raw user ID, or membership ID.
 */
export function serializeParticipantMessage(
  message: Message & { senderMembership?: { alias: string } | null },
  currentMembershipId: string,
  senderAliasFallback?: string
): ParticipantMessageDTO {
  const isMine = message.senderMembershipId === currentMembershipId;
  const senderAlias = message.senderMembership?.alias || senderAliasFallback || (isMine ? "You" : "Participant");

  return {
    id: message.id,
    senderAlias,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
    deliveredAt: message.deliveredAt ? message.deliveredAt.toISOString() : null,
    status: message.status,
    isMine,
  };
}

/**
 * Serializes a project for participant viewing.
 * Returns only project id, title, participant's own alias, and the counterpart alias.
 */
export function serializeParticipantProject(params: {
  project: Project;
  myAlias: string;
  otherAlias: string;
  lastMessagePreview?: string | null;
  lastActivityAt?: Date | null;
  unreadCount?: number;
}): ParticipantProjectDTO {
  return {
    id: params.project.id,
    title: params.project.title,
    myAlias: params.myAlias,
    otherAlias: params.otherAlias,
    lastMessagePreview: params.lastMessagePreview ?? null,
    lastActivityAt: params.lastActivityAt ? params.lastActivityAt.toISOString() : null,
    unreadCount: params.unreadCount ?? 0,
  };
}

/**
 * Admin message serializer. Includes administrative details.
 */
export function serializeAdminMessage(
  message: Message & {
    senderMembership?: (Membership & { user?: User | null }) | null;
  }
): AdminMessageDTO {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderMembershipId: message.senderMembershipId,
    senderRealName: message.senderMembership?.user?.realName,
    senderEmail: message.senderMembership?.user?.email,
    senderAlias: message.senderMembership?.alias || "Unknown",
    body: message.body,
    status: message.status,
    clientMessageId: message.clientMessageId,
    deliveredAt: message.deliveredAt ? message.deliveredAt.toISOString() : null,
    createdAt: message.createdAt.toISOString(),
  };
}

/**
 * Admin user serializer.
 */
export function serializeAdminUser(user: User): AdminUserDTO {
  return {
    id: user.id,
    role: user.role,
    realName: user.realName,
    email: user.email,
    phone: user.phone,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
  };
}
