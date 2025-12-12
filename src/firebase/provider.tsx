'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { Firestore, doc, getDoc } from 'firebase/firestore';
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
        const user: User = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        };
        setUser(user);

        // Fetch user role from Firestore
        // جلب دور المستخدم من قاعدة البيانات
        try {
          const userDoc = await getDoc(doc(firestore, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            // If user document exists with role field → use that role
            // If user document exists but NO role field → legacy user → default to 'owner'
            // إذا كان المستند موجود بدون حقل الدور = مستخدم قديم = مالك
            if (userData.role !== undefined) {
              setRole(userData.role as UserRole);
            } else {
              // Legacy user without role field - default to owner for backwards compatibility
              setRole('owner');
            }
          } else {
            // No user document = NEW user → role = null (must request access)
            // مستخدم جديد بدون مستند = يجب طلب الوصول
            setRole(null);
          }
        } catch (error) {
          console.error('Error fetching user role:', error);
          // On error, set null to prevent unauthorized access
          // عند الخطأ، نضع null لمنع الوصول غير المصرح
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
