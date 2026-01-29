'use client';

import { createContext, useContext, useEffect, useState, useMemo, useCallback, ReactNode } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { Firestore, doc, getDoc, setDoc, collection, getDocs, limit, query } from 'firebase/firestore';
import * as Sentry from '@sentry/nextjs';
import { auth, firestore, storage } from './config';
import { User } from '@/lib/definitions';
import { FirebaseStorage } from 'firebase/storage';
import type { UserRole } from '@/types/rbac';

interface FirebaseContextType {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

interface FirebaseProviderProps {
  children: ReactNode;
}

/**
 * Check if a user is a legacy owner by looking for existing data in their collections
 * يتحقق إذا كان المستخدم مالك قديم من خلال البحث عن بيانات موجودة في مجموعاته
 *
 * Returns: 'legacy' if user has data, 'new' if definitely new, 'unknown' if check failed
 */
async function checkIfLegacyOwner(uid: string): Promise<'legacy' | 'new' | 'unknown'> {
  // Check common collections for existing data IN PARALLEL for performance
  // نتحقق من المجموعات الشائعة للبيانات الموجودة بشكل متوازي للأداء
  const collectionsToCheck = ['ledger', 'cheques', 'inventory', 'clients', 'partners'];

  // Run all queries in parallel using Promise.allSettled to handle errors gracefully
  const results = await Promise.allSettled(
    collectionsToCheck.map(async (collectionName) => {
      const collectionRef = collection(firestore, `users/${uid}/${collectionName}`);
      const q = query(collectionRef, limit(1));
      const snapshot = await getDocs(q);
      return { collectionName, hasData: !snapshot.empty };
    })
  );

  let successfulChecks = 0;

  // Check results - if any collection has data, user is a legacy owner
  for (const result of results) {
    if (result.status === 'fulfilled') {
      successfulChecks++;
      if (result.value.hasData) {
        // User has data - they are a legacy owner
        // المستخدم لديه بيانات - هو مالك قديم
        console.log(`Legacy owner detected: found data in ${result.value.collectionName}`);
        return 'legacy';
      }
    }
  }

  // If we couldn't check ANY collection successfully, return unknown
  // إذا لم نتمكن من فحص أي مجموعة بنجاح، نرجع unknown
  if (successfulChecks === 0) {
    console.log('Could not check any collections - treating as unknown');
    return 'unknown';
  }

  // We successfully checked some collections and found no data
  // فحصنا بعض المجموعات بنجاح ولم نجد بيانات
  console.log(`Checked ${successfulChecks} collections, no data found - treating as new user`);
  return 'new';
}

/**
 * Firebase Client Provider
 * يوفر سياق المصادقة والصلاحيات للتطبيق
 */
export function FirebaseClientProvider({ children }: FirebaseProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        // Fetch user role and ownerId from Firestore
        // جلب دور المستخدم ومعرف المالك من قاعدة البيانات
        try {
          const userDocRef = doc(firestore, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);

          let userRole: UserRole | null = null;
          let ownerId: string | undefined = undefined;

          if (userDoc.exists()) {
            const userData = userDoc.data();
            // If user document exists with role field → use that role
            // If user document exists but NO role field → legacy user → default to 'owner'
            // إذا كان المستند موجود بدون حقل الدور = مستخدم قديم = مالك
            if (userData.role !== undefined) {
              userRole = userData.role as UserRole;
              // Get ownerId for non-owner users (with backwards compatibility for orgId)
              ownerId = userData.ownerId || userData.orgId;
            } else {
              // Legacy user without role field - default to owner for backwards compatibility
              // Also update the document to include the role field
              await setDoc(userDocRef, {
                ...userData,
                role: 'owner',
                email: firebaseUser.email?.toLowerCase().trim(),
                displayName: firebaseUser.displayName,
              }, { merge: true });
              userRole = 'owner';
            }
          } else {
            // No user document exists - determine if new owner or employee
            // مستخدم بدون مستند - تحديد إذا كان مالك جديد أو موظف
            const legacyStatus = await checkIfLegacyOwner(firebaseUser.uid);

            // Check if user selected "owner" during signup (stored in localStorage)
            // التحقق إذا اختار المستخدم "مالك" أثناء التسجيل
            let pendingOwnerSetup = false;
            try {
              pendingOwnerSetup = localStorage.getItem('pendingOwnerSetup') === 'true';
            } catch {
              // localStorage not available (SSR)
            }

            if (legacyStatus === 'legacy' || legacyStatus === 'unknown' || pendingOwnerSetup) {
              // Create as owner: legacy user with data OR user selected "owner" at signup
              // إنشاء كمالك: مستخدم قديم لديه بيانات أو مستخدم اختار "مالك" عند التسجيل
              console.log(`User ${firebaseUser.email} created as owner (legacy: ${legacyStatus}, pendingSetup: ${pendingOwnerSetup})`);

              // Create their user document with owner role
              // إنشاء مستند المستخدم بدور المالك
              await setDoc(userDocRef, {
                uid: firebaseUser.uid,
                email: firebaseUser.email?.toLowerCase().trim(),
                displayName: firebaseUser.displayName,
                role: 'owner',
                createdAt: new Date(),
                isLegacyMigrated: legacyStatus !== 'new',
              });
              userRole = 'owner';

              // Clear the pending owner setup flag
              // مسح علامة إعداد المالك المعلق
              try {
                localStorage.removeItem('pendingOwnerSetup');
              } catch {
                // Ignore if localStorage not available
              }
            } else {
              // New user who selected "employee" - must request access
              // مستخدم جديد اختار "موظف" - يجب طلب الوصول
              console.log(`New user ${firebaseUser.email} - role set to null (employee flow)`);
              userRole = null;
            }
          }

          // Calculate dataOwnerId: for owners use their uid, for non-owners use ownerId
          // حساب معرف مالك البيانات: للمالكين نستخدم معرفهم، لغير المالكين نستخدم معرف مالكهم
          const dataOwnerId = (userRole === 'owner' || !ownerId) ? firebaseUser.uid : ownerId;

          const user: User = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
            ownerId: ownerId,
            dataOwnerId: dataOwnerId,
          };

          setUser(user);
          setRole(userRole);

          // Set Sentry user context for error tracking
          Sentry.setUser({
            id: user.uid,
            email: user.email || undefined,
          });
        } catch (error) {
          console.error('Error fetching user role:', error);
          // On error, set null to prevent unauthorized access
          // عند الخطأ، نضع null لمنع الوصول غير المصرح
          const user: User = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
            dataOwnerId: firebaseUser.uid, // fallback to own uid
          };
          setUser(user);
          setRole(null);
        }
      } else {
        setUser(null);
        setRole(null);
        // Clear Sentry user context on logout
        Sentry.setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signOutUser = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setRole(null);
      // Clear Sentry user context on sign out
      Sentry.setUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    user,
    role,
    loading,
    signOut: signOutUser,
  }), [user, role, loading, signOutUser]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      {children}
    </FirebaseContext.Provider>
  );
}

// Hooks
export function useUser() {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a FirebaseClientProvider');
  }
  return context;
}

export function useFirestore(): Firestore {
  return firestore;
}

export function useStorage(): FirebaseStorage {
  return storage;
}

export function useAuth() {
  return auth;
}
