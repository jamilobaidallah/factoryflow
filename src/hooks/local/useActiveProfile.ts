"use client";

import { useState, useEffect } from 'react';
import type { Profile } from '@/lib/profile';

const STORAGE_KEY = 'factoryflow:activeProfile';

/** Read/write the active profile from localStorage */
export function useActiveProfile(): Profile | null {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try { setProfile(JSON.parse(stored) as Profile); } catch { /* corrupted — ignore */ }
    }
  }, []);

  return profile;
}

/** Set active profile in localStorage (called from profile picker) */
export function setActiveProfile(profile: Profile): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

/** Clear active profile (called on profile switch) */
export function clearActiveProfile(): void {
  localStorage.removeItem(STORAGE_KEY);
}
