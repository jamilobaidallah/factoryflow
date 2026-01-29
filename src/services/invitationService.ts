/**
 * Invitation Service
 * خدمة إدارة الدعوات للانضمام للمصنع
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  setDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { firestore } from '@/firebase/config';
import type { Invitation, UserRole } from '@/types/rbac';
import { logActivity } from './activityLogService';
import { USER_ROLE_LABELS } from '@/lib/constants';

/** معلومات المستخدم الذي يقوم بالعملية */
export interface CallerInfo {
  uid: string;
  email: string;
  displayName?: string;
}

/**
 * توليد رمز فريد للدعوة
 * Generate a unique token for invitation links
 */
function generateToken(): string {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * إنشاء دعوة جديدة
 * Create a new invitation
 */
export async function createInvitation(
  ownerId: string,
  ownerEmail: string,
  ownerDisplayName: string | undefined,
  inviteeEmail: string,
  role: 'accountant' | 'viewer',
  caller?: CallerInfo
): Promise<{ success: boolean; invitation?: Invitation; error?: string }> {
  try {
    const normalizedEmail = inviteeEmail.toLowerCase().trim();

    // التحقق من عدم وجود دعوة معلقة لنفس البريد
    // Check for existing pending invitation to same email
    const existingQuery = query(
      collection(firestore, 'invitations'),
      where('ownerId', '==', ownerId),
      where('inviteeEmail', '==', normalizedEmail),
      where('status', '==', 'pending')
    );
    const existingSnapshot = await getDocs(existingQuery);
    if (!existingSnapshot.empty) {
      return { success: false, error: 'يوجد دعوة معلقة لهذا البريد الإلكتروني بالفعل' };
    }

    const token = generateToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitationData = {
      token,
      ownerId,
      ownerEmail,
      ownerDisplayName: ownerDisplayName || ownerEmail,
      inviteeEmail: normalizedEmail,
      role,
      createdAt: Timestamp.fromDate(now),
      expiresAt: Timestamp.fromDate(expiresAt),
      status: 'pending' as const,
    };

    const docRef = await addDoc(collection(firestore, 'invitations'), invitationData);

    const invitation: Invitation = {
      id: docRef.id,
      ...invitationData,
      createdAt: now,
      expiresAt,
    };

    // تسجيل النشاط
    if (caller) {
      logActivity(ownerId, {
        userId: caller.uid,
        userEmail: caller.email,
        userDisplayName: caller.displayName,
        action: 'create',
        module: 'users',
        targetId: docRef.id,
        description: `إنشاء دعوة لـ ${normalizedEmail} بدور ${USER_ROLE_LABELS[role]}`,
        metadata: { inviteeEmail: normalizedEmail, role },
      });
    }

    return { success: true, invitation };
  } catch (error) {
    console.error('Error creating invitation:', error);
    return { success: false, error: 'حدث خطأ أثناء إنشاء الدعوة' };
  }
}

/**
 * الحصول على دعوة بواسطة الرمز
 * Get invitation by token
 */
export async function getInvitationByToken(token: string): Promise<Invitation | null> {
  try {
    const q = query(
      collection(firestore, 'invitations'),
      where('token', '==', token)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    return {
      id: doc.id,
      token: data.token,
      ownerId: data.ownerId,
      ownerEmail: data.ownerEmail,
      ownerDisplayName: data.ownerDisplayName,
      inviteeEmail: data.inviteeEmail,
      role: data.role,
      createdAt: data.createdAt?.toDate() || new Date(),
      expiresAt: data.expiresAt?.toDate() || new Date(),
      status: data.status,
      acceptedAt: data.acceptedAt?.toDate(),
      acceptedBy: data.acceptedBy,
    };
  } catch (error) {
    console.error('Error fetching invitation:', error);
    return null;
  }
}

/**
 * قبول دعوة
 * Accept an invitation
 */
export async function acceptInvitation(
  token: string,
  userId: string,
  userEmail: string,
  userDisplayName?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const invitation = await getInvitationByToken(token);

    if (!invitation) {
      return { success: false, error: 'الدعوة غير موجودة' };
    }

    if (invitation.status !== 'pending') {
      return { success: false, error: 'تم استخدام هذه الدعوة مسبقاً أو انتهت صلاحيتها' };
    }

    // التحقق من انتهاء الصلاحية
    if (new Date() > invitation.expiresAt) {
      // تحديث حالة الدعوة إلى منتهية
      const invitationRef = doc(firestore, 'invitations', invitation.id);
      await updateDoc(invitationRef, { status: 'expired' });
      return { success: false, error: 'انتهت صلاحية الدعوة' };
    }

    // التحقق من تطابق البريد الإلكتروني (اختياري - يمكن تعطيله)
    const normalizedUserEmail = userEmail.toLowerCase().trim();
    if (invitation.inviteeEmail !== normalizedUserEmail) {
      return {
        success: false,
        error: 'البريد الإلكتروني لا يتطابق مع الدعوة. يرجى استخدام البريد: ' + invitation.inviteeEmail
      };
    }

    // تحديث حالة الدعوة
    const invitationRef = doc(firestore, 'invitations', invitation.id);
    await updateDoc(invitationRef, {
      status: 'accepted',
      acceptedAt: Timestamp.now(),
      acceptedBy: userId,
    });

    // إنشاء وثيقة المستخدم في مجموعة users الرئيسية
    const userRef = doc(firestore, 'users', userId);
    await setDoc(userRef, {
      uid: userId,
      email: normalizedUserEmail,
      displayName: userDisplayName || normalizedUserEmail,
      role: invitation.role,
      ownerId: invitation.ownerId,
      createdAt: Timestamp.now(),
      invitedBy: invitation.ownerId,
    }, { merge: true });

    // إنشاء وثيقة العضو في مجموعة الأعضاء
    const memberRef = doc(firestore, `users/${invitation.ownerId}/members`, userId);
    await setDoc(memberRef, {
      uid: userId,
      email: normalizedUserEmail,
      displayName: userDisplayName || normalizedUserEmail,
      role: invitation.role,
      ownerId: invitation.ownerId,
      invitedAt: invitation.createdAt,
      acceptedAt: Timestamp.now(),
      isActive: true,
    }, { merge: true });

    // تسجيل النشاط
    logActivity(invitation.ownerId, {
      userId: userId,
      userEmail: normalizedUserEmail,
      userDisplayName: userDisplayName,
      action: 'create',
      module: 'users',
      targetId: userId,
      description: `قبول دعوة الانضمام بدور ${USER_ROLE_LABELS[invitation.role]}`,
      metadata: { invitationId: invitation.id, role: invitation.role },
    });

    return { success: true };
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return { success: false, error: 'حدث خطأ أثناء قبول الدعوة' };
  }
}

/**
 * الحصول على دعوات المالك
 * Get owner's invitations
 */
export async function getOwnerInvitations(ownerId: string): Promise<Invitation[]> {
  try {
    const q = query(
      collection(firestore, 'invitations'),
      where('ownerId', '==', ownerId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        token: data.token,
        ownerId: data.ownerId,
        ownerEmail: data.ownerEmail,
        ownerDisplayName: data.ownerDisplayName,
        inviteeEmail: data.inviteeEmail,
        role: data.role,
        createdAt: data.createdAt?.toDate() || new Date(),
        expiresAt: data.expiresAt?.toDate() || new Date(),
        status: data.status,
        acceptedAt: data.acceptedAt?.toDate(),
        acceptedBy: data.acceptedBy,
      };
    });
  } catch (error) {
    console.error('Error fetching owner invitations:', error);
    return [];
  }
}

/**
 * إلغاء دعوة
 * Revoke an invitation
 */
export async function revokeInvitation(
  invitationId: string,
  ownerId: string,
  caller?: CallerInfo
): Promise<{ success: boolean; error?: string }> {
  try {
    const invitationRef = doc(firestore, 'invitations', invitationId);
    const invitationDoc = await getDoc(invitationRef);

    if (!invitationDoc.exists()) {
      return { success: false, error: 'الدعوة غير موجودة' };
    }

    const data = invitationDoc.data();

    // التحقق من أن المالك هو من أنشأ الدعوة
    if (data.ownerId !== ownerId) {
      return { success: false, error: 'ليس لديك صلاحية إلغاء هذه الدعوة' };
    }

    if (data.status !== 'pending') {
      return { success: false, error: 'لا يمكن إلغاء دعوة تم قبولها أو انتهت صلاحيتها' };
    }

    await updateDoc(invitationRef, {
      status: 'revoked',
      revokedAt: Timestamp.now(),
    });

    // تسجيل النشاط
    if (caller) {
      logActivity(ownerId, {
        userId: caller.uid,
        userEmail: caller.email,
        userDisplayName: caller.displayName,
        action: 'delete',
        module: 'users',
        targetId: invitationId,
        description: `إلغاء دعوة لـ ${data.inviteeEmail}`,
        metadata: { inviteeEmail: data.inviteeEmail },
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Error revoking invitation:', error);
    return { success: false, error: 'حدث خطأ أثناء إلغاء الدعوة' };
  }
}

/**
 * إنشاء رابط الدعوة
 * Generate invitation link
 */
export function generateInvitationLink(token: string): string {
  // استخدام window.location.origin إذا كنا في المتصفح
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/invite/${token}`;
  }
  // Fallback for server-side
  return `/invite/${token}`;
}
