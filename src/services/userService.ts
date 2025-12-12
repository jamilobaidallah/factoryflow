/**
 * User Management Service
 * خدمة إدارة المستخدمين والطلبات
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { firestore } from '@/firebase/config';
import type { UserRole, AccessRequest, OrganizationMember } from '@/types/rbac';

/**
 * البحث عن مالك بواسطة البريد الإلكتروني
 * يبحث في مجموعة users عن مستخدم بدور owner
 */
export async function findOwnerByEmail(email: string): Promise<{ uid: string; email: string; displayName?: string } | null> {
  console.log('=== findOwnerByEmail ===');
  console.log('Searching for owner with email:', email.toLowerCase().trim());

  try {
    const usersRef = collection(firestore, 'users');
    const q = query(
      usersRef,
      where('email', '==', email.toLowerCase().trim()),
      where('role', '==', 'owner')
    );

    const snapshot = await getDocs(q);
    console.log('Query completed. Found documents:', snapshot.size);

    if (snapshot.empty) {
      console.log('No owner found with this email');
      return null;
    }

    const userDoc = snapshot.docs[0];
    const data = userDoc.data();
    console.log('Found owner:', { uid: userDoc.id, email: data.email });

    return {
      uid: userDoc.id,
      email: data.email,
      displayName: data.displayName,
    };
  } catch (error) {
    console.error('=== findOwnerByEmail Error ===');
    console.error('Error details:', error);
    console.error('Error code:', (error as { code?: string }).code);
    console.error('Error message:', (error as Error).message);
    throw error;
  }
}

/**
 * إرسال طلب وصول جديد
 */
export async function submitAccessRequest(
  requesterUid: string,
  requesterEmail: string,
  requesterDisplayName: string,
  targetOwnerEmail: string,
  message?: string
): Promise<{ success: boolean; error?: string }> {
  console.log('=== submitAccessRequest ===');
  console.log('Requester UID:', requesterUid);
  console.log('Requester Email:', requesterEmail);
  console.log('Target Owner Email:', targetOwnerEmail);

  try {
    // البحث عن المالك بالبريد الإلكتروني
    let owner;
    try {
      owner = await findOwnerByEmail(targetOwnerEmail);
    } catch (findError) {
      // Permission error when querying users collection
      const errorCode = (findError as { code?: string }).code;
      console.error('Error finding owner - code:', errorCode);

      if (errorCode === 'permission-denied') {
        return {
          success: false,
          error: 'لا يمكن التحقق من المالك. يرجى التأكد من صحة البريد الإلكتروني وأن المالك قام بتسجيل الدخول مرة واحدة على الأقل.'
        };
      }
      throw findError;
    }

    if (!owner) {
      console.log('Owner not found with email:', targetOwnerEmail);
      return { success: false, error: 'لم يتم العثور على مالك بهذا البريد الإلكتروني. تأكد من أن المالك قام بتسجيل الدخول مرة واحدة على الأقل.' };
    }

    console.log('Owner found:', owner.uid);

    // التحقق من عدم وجود طلب معلق سابق
    const existingRequestQuery = query(
      collection(firestore, 'access_requests'),
      where('uid', '==', requesterUid),
      where('targetOwnerId', '==', owner.uid),
      where('status', '==', 'pending')
    );
    const existingSnapshot = await getDocs(existingRequestQuery);
    if (!existingSnapshot.empty) {
      console.log('Existing pending request found');
      return { success: false, error: 'لديك طلب معلق بالفعل لهذا المصنع' };
    }

    // إنشاء طلب جديد
    console.log('Creating new access request...');
    const docRef = await addDoc(collection(firestore, 'access_requests'), {
      uid: requesterUid,
      email: requesterEmail.toLowerCase().trim(),
      displayName: requesterDisplayName || requesterEmail,
      targetOwnerId: owner.uid,
      targetOwnerEmail: owner.email,
      message: message?.trim() || null,
      requestedAt: Timestamp.now(),
      status: 'pending',
    });

    console.log('Access request created successfully:', docRef.id);
    return { success: true };
  } catch (error) {
    console.error('=== submitAccessRequest Error ===');
    console.error('Error details:', error);
    console.error('Error code:', (error as { code?: string }).code);
    console.error('Error message:', (error as Error).message);
    return { success: false, error: 'حدث خطأ أثناء إرسال الطلب' };
  }
}

/**
 * الحصول على طلبات الوصول المعلقة للمالك
 */
export async function getPendingRequests(ownerId: string): Promise<AccessRequest[]> {
  const requestsRef = collection(firestore, 'access_requests');
  const q = query(
    requestsRef,
    where('targetOwnerId', '==', ownerId),
    where('status', '==', 'pending'),
    orderBy('requestedAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      uid: data.uid,
      email: data.email,
      displayName: data.displayName,
      targetOwnerId: data.targetOwnerId,
      targetOwnerEmail: data.targetOwnerEmail,
      message: data.message,
      requestedAt: data.requestedAt?.toDate() || new Date(),
      status: data.status,
    } as AccessRequest;
  });
}

/**
 * قبول طلب الوصول
 */
export async function approveRequest(
  requestId: string,
  ownerId: string,
  role: UserRole
): Promise<{ success: boolean; error?: string }> {
  try {
    const requestRef = doc(firestore, 'access_requests', requestId);
    const requestDoc = await getDoc(requestRef);

    if (!requestDoc.exists()) {
      return { success: false, error: 'الطلب غير موجود' };
    }

    const requestData = requestDoc.data();

    // التحقق من أن المالك هو المستهدف
    if (requestData.targetOwnerId !== ownerId) {
      return { success: false, error: 'ليس لديك صلاحية معالجة هذا الطلب' };
    }

    // تحديث حالة الطلب
    await updateDoc(requestRef, {
      status: 'approved',
      processedAt: Timestamp.now(),
      assignedRole: role,
    });

    // إنشاء/تحديث وثيقة المستخدم في مجموعة users/{ownerId}/members
    const memberRef = doc(firestore, `users/${ownerId}/members`, requestData.uid);
    await updateDoc(memberRef, {
      uid: requestData.uid,
      email: requestData.email,
      displayName: requestData.displayName,
      role: role,
      orgId: ownerId,
      approvedAt: Timestamp.now(),
      approvedBy: ownerId,
      isActive: true,
    }).catch(async () => {
      // إذا لم تكن الوثيقة موجودة، أنشئها
      const membersRef = collection(firestore, `users/${ownerId}/members`);
      await addDoc(membersRef, {
        uid: requestData.uid,
        email: requestData.email,
        displayName: requestData.displayName,
        role: role,
        orgId: ownerId,
        requestedAt: requestData.requestedAt,
        approvedAt: Timestamp.now(),
        approvedBy: ownerId,
        isActive: true,
      });
    });

    // تحديث دور المستخدم في وثيقته الرئيسية
    const userRef = doc(firestore, 'users', requestData.uid);
    await updateDoc(userRef, {
      role: role,
      orgId: ownerId,
    }).catch(async () => {
      // إذا لم تكن الوثيقة موجودة، أنشئها
      await addDoc(collection(firestore, 'users'), {
        uid: requestData.uid,
        email: requestData.email,
        displayName: requestData.displayName,
        role: role,
        orgId: ownerId,
      });
    });

    return { success: true };
  } catch (error) {
    console.error('Error approving request:', error);
    return { success: false, error: 'حدث خطأ أثناء قبول الطلب' };
  }
}

/**
 * رفض طلب الوصول
 */
export async function rejectRequest(
  requestId: string,
  ownerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const requestRef = doc(firestore, 'access_requests', requestId);
    const requestDoc = await getDoc(requestRef);

    if (!requestDoc.exists()) {
      return { success: false, error: 'الطلب غير موجود' };
    }

    const requestData = requestDoc.data();

    // التحقق من أن المالك هو المستهدف
    if (requestData.targetOwnerId !== ownerId) {
      return { success: false, error: 'ليس لديك صلاحية معالجة هذا الطلب' };
    }

    // تحديث حالة الطلب
    await updateDoc(requestRef, {
      status: 'rejected',
      processedAt: Timestamp.now(),
    });

    return { success: true };
  } catch (error) {
    console.error('Error rejecting request:', error);
    return { success: false, error: 'حدث خطأ أثناء رفض الطلب' };
  }
}

/**
 * الحصول على أعضاء المؤسسة (المستخدمين المرتبطين بالمالك)
 */
export async function getOrganizationMembers(ownerId: string): Promise<OrganizationMember[]> {
  const membersRef = collection(firestore, `users/${ownerId}/members`);
  const q = query(membersRef, where('isActive', '==', true), orderBy('approvedAt', 'desc'));

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      uid: data.uid,
      orgId: data.orgId,
      email: data.email,
      displayName: data.displayName,
      role: data.role,
      requestedAt: data.requestedAt?.toDate() || new Date(),
      approvedAt: data.approvedAt?.toDate(),
      approvedBy: data.approvedBy,
      isActive: data.isActive,
    } as OrganizationMember;
  });
}

/**
 * تحديث دور المستخدم
 */
export async function updateUserRole(
  ownerId: string,
  memberUid: string,
  newRole: UserRole
): Promise<{ success: boolean; error?: string }> {
  try {
    // لا يمكن تغيير دور المالك
    if (memberUid === ownerId) {
      return { success: false, error: 'لا يمكن تغيير دور المالك' };
    }

    // تحديث في مجموعة الأعضاء
    const membersRef = collection(firestore, `users/${ownerId}/members`);
    const q = query(membersRef, where('uid', '==', memberUid));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return { success: false, error: 'المستخدم غير موجود' };
    }

    const memberDoc = snapshot.docs[0];
    await updateDoc(memberDoc.ref, { role: newRole });

    // تحديث في وثيقة المستخدم الرئيسية
    const userRef = doc(firestore, 'users', memberUid);
    await updateDoc(userRef, { role: newRole });

    return { success: true };
  } catch (error) {
    console.error('Error updating user role:', error);
    return { success: false, error: 'حدث خطأ أثناء تحديث الدور' };
  }
}

/**
 * إزالة وصول المستخدم
 */
export async function removeUserAccess(
  ownerId: string,
  memberUid: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // لا يمكن إزالة المالك
    if (memberUid === ownerId) {
      return { success: false, error: 'لا يمكن إزالة المالك' };
    }

    // تعطيل في مجموعة الأعضاء
    const membersRef = collection(firestore, `users/${ownerId}/members`);
    const q = query(membersRef, where('uid', '==', memberUid));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return { success: false, error: 'المستخدم غير موجود' };
    }

    const memberDoc = snapshot.docs[0];
    await updateDoc(memberDoc.ref, { isActive: false });

    // إزالة الدور من وثيقة المستخدم الرئيسية
    const userRef = doc(firestore, 'users', memberUid);
    await updateDoc(userRef, {
      role: null,
      orgId: null,
    });

    return { success: true };
  } catch (error) {
    console.error('Error removing user access:', error);
    return { success: false, error: 'حدث خطأ أثناء إزالة الوصول' };
  }
}

/**
 * التحقق مما إذا كان للمستخدم طلب معلق
 */
export async function hasPendingRequest(userUid: string): Promise<boolean> {
  const requestsRef = collection(firestore, 'access_requests');
  const q = query(
    requestsRef,
    where('uid', '==', userUid),
    where('status', '==', 'pending')
  );

  const snapshot = await getDocs(q);
  return !snapshot.empty;
}

/**
 * الحصول على حالة المستخدم (هل لديه وصول أو طلب معلق)
 */
export async function getUserAccessStatus(userUid: string): Promise<{
  hasAccess: boolean;
  hasPendingRequest: boolean;
  role?: UserRole;
  orgId?: string;
}> {
  // التحقق من وثيقة المستخدم
  const userRef = doc(firestore, 'users', userUid);
  const userDoc = await getDoc(userRef);

  if (userDoc.exists()) {
    const data = userDoc.data();
    if (data.role && data.orgId) {
      return {
        hasAccess: true,
        hasPendingRequest: false,
        role: data.role,
        orgId: data.orgId,
      };
    }
  }

  // التحقق من الطلبات المعلقة
  const pending = await hasPendingRequest(userUid);

  return {
    hasAccess: false,
    hasPendingRequest: pending,
  };
}
