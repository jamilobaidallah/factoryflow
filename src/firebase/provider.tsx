'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { Firestore, doc, getDoc, setDoc, collection, getDocs, limit, query } from 'firebase/firestore';
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
  // Check common collections for existing data
  // نتحقق من المجموعات الشائعة للبيانات الموجودة
  const collectionsToCheck = ['ledger', 'cheques', 'inventory', 'clients', 'partners'];
  let successfulChecks = 0;
  let totalErrors = 0;

  for (const collectionName of collectionsToCheck) {
    try {
      const collectionRef = collection(firestore, `users/${uid}/${collectionName}`);
      const q = query(collectionRef, limit(1));
      const snapshot = await getDocs(q);
      successfulChecks++;

      if (!snapshot.empty) {
        // User has data - they are a legacy owner
        // المستخدم لديه بيانات - هو مالك قديم
        console.log(`Legacy owner detected: found data in ${collectionName}`);
        return 'legacy';
      }
    } catch (error) {
      // Permission error or other issue
      totalErrors++;
      console.error(`Error checking ${collectionName}:`, error);
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
      console.log('🔴 AUTH STATE CHANGED:', firebaseUser ? firebaseUser.email : 'null');

      if (firebaseUser) {
        // Fetch user role and ownerId from Firestore
        // جلب دور المستخدم ومعرف المالك من قاعدة البيانات
        try {
          const userDocRef = doc(firestore, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);

          console.log('🟡 FIRESTORE USER DOC:', userDoc.exists() ? userDoc.data() : 'NOT FOUND');

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
            // No user document - check if this is a legacy owner with existing data
            // مستخدم بدون مستند - تحقق إذا كان مالك قديم لديه بيانات
            const legacyStatus = await checkIfLegacyOwner(firebaseUser.uid);

            if (legacyStatus === 'legacy' || legacyStatus === 'unknown') {
              // Legacy owner OR unknown (be lenient for backwards compatibility)
              // مالك قديم أو غير معروف - نتعامل معهم كمالك للتوافق
              console.log(`User ${firebaseUser.email} treated as owner (status: ${legacyStatus})`);

              // Create their user document with owner role
              // إنشاء مستند المستخدم بدور المالك
              await setDoc(userDocRef, {
                uid: firebaseUser.uid,
                email: firebaseUser.email?.toLowerCase().trim(),
                displayName: firebaseUser.displayName,
                role: 'owner',
                createdAt: new Date(),
                isLegacyMigrated: true,
              });
              userRole = 'owner';
            } else {
              // Definitely a NEW user → role = null (must request access)
              // مستخدم جديد بالتأكيد = يجب طلب الوصول
              console.log(`New user ${firebaseUser.email} - role set to null`);
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

          // Debug logging to verify dataOwnerId computation
          console.log('🔵 AUTH DEBUG:', {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            role: userRole,
            ownerId: ownerId,
            dataOwnerId: dataOwnerId,
          });

          setUser(user);
          setRole(userRole);
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
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signOutUser = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setRole(null);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  return (
    <FirebaseContext.Provider value={{ user, role, loading, signOut: signOutUser }}>
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
