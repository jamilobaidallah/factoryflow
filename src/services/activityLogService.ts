/**
 * Activity Log Service
 * خدمة سجل النشاطات
 */

import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { firestore } from '@/firebase/config';
import type {
  ActivityLog,
  ActivityLogInput,
  ActivityAction,
  ActivityModule,
} from '@/types/activity-log';

/**
 * تسجيل نشاط جديد (non-blocking)
 * يتم استدعاء هذه الدالة بدون await لعدم تأخير العمليات الرئيسية
 */
export function logActivity(
  ownerId: string,
  input: ActivityLogInput
): void {
  // Fire and forget - لا ننتظر النتيجة
  const activityRef = collection(firestore, `users/${ownerId}/activity_logs`);

  addDoc(activityRef, {
    ...input,
    createdAt: Timestamp.now(),
  }).catch((error) => {
    // Log error but don't throw - activity logging should never break the main flow
    console.error('Error logging activity:', error);
  });
}

/**
 * جلب النشاطات الأخيرة
 */
export async function getRecentActivities(
  ownerId: string,
  options?: {
    limitCount?: number;
    moduleFilter?: ActivityModule;
    actionFilter?: ActivityAction;
  }
): Promise<ActivityLog[]> {
  const activityRef = collection(firestore, `users/${ownerId}/activity_logs`);

  // Build query constraints
  const constraints: Parameters<typeof query>[1][] = [];

  if (options?.moduleFilter) {
    constraints.push(where('module', '==', options.moduleFilter));
  }

  if (options?.actionFilter) {
    constraints.push(where('action', '==', options.actionFilter));
  }

  constraints.push(orderBy('createdAt', 'desc'));
  constraints.push(limit(options?.limitCount || 50));

  const q = query(activityRef, ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      userId: data.userId,
      userEmail: data.userEmail,
      userDisplayName: data.userDisplayName,
      action: data.action,
      module: data.module,
      targetId: data.targetId,
      description: data.description,
      metadata: data.metadata,
      createdAt: data.createdAt?.toDate() || new Date(),
    } as ActivityLog;
  });
}
