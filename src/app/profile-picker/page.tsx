"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  type Profile,
  PROFILE_COLORS,
  PROFILE_EMOJIS,
  listProfiles,
  createProfile,
  markProfileOpened,
  formatLastOpened,
  deleteProfile,
  ipcInvoke,
} from "@/lib/profile";
import { setActiveProfile } from "@/hooks/local/useActiveProfile";

export default function ProfilePickerPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);

  // New profile form state
  const [newName, setNewName]   = useState("");
  const [newEmoji, setNewEmoji] = useState<string>(PROFILE_EMOJIS[0]);
  const [newColor, setNewColor] = useState<string>(PROFILE_COLORS[0].id);
  const [creating, setCreating] = useState(false);
  const [nameError, setNameError] = useState("");

  const loadProfiles = useCallback(async () => {
    try {
      const list = await listProfiles();
      setProfiles(list);
    } catch (err) {
      console.error("Failed to load profiles:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProfiles(); }, [loadProfiles]);

  async function handleOpen(profile: Profile) {
    setOpening(profile.id);
    try {
      // Open the SQLite database for this profile (main process side).
      // This initialises tables, runs migrations, and seeds the COA if new.
      await ipcInvoke<{ success: boolean }>('profiles:open', profile);

      // Save active profile to localStorage so useActiveProfile() can read it.
      setActiveProfile(profile);
      await markProfileOpened(profile.id);

      // Route to the local dashboard which mirrors the existing Firebase
      // dashboard but reads from SQLite. /local-diagnostic remains available
      // as a developer test page accessible from the dashboard header.
      router.push("/local/dashboard");
    } catch (err) {
      console.error("Failed to open profile:", err);
      setOpening(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) { setNameError("يرجى إدخال اسم للملف التجاري"); return; }
    if (trimmed.length < 2) { setNameError("يجب أن يكون الاسم حرفين على الأقل"); return; }

    const id = trimmed
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      || `profile-${Date.now()}`;

    if (profiles.some(p => p.id === id)) {
      setNameError("يوجد ملف تجاري بهذا الاسم مسبقاً");
      return;
    }

    setCreating(true);
    try {
      const created = await createProfile({ id, name: trimmed, emoji: newEmoji, color: newColor });
      setProfiles(prev => [...prev, created]);
      setShowCreate(false);
      setNewName("");
      setNewEmoji(PROFILE_EMOJIS[0]);
      setNewColor(PROFILE_COLORS[0].id);
      setNameError("");
    } catch (err) {
      console.error("Failed to create profile:", err);
      setNameError("حدث خطأ أثناء إنشاء الملف التجاري");
    } finally {
      setCreating(false);
    }
  }

  const colorConfig = (colorId: string) =>
    PROFILE_COLORS.find(c => c.id === colorId) ?? PROFILE_COLORS[0];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6" dir="rtl">

      {/* Logo & Title */}
      <div className="mb-10 text-center">
        <div className="text-5xl mb-4">⚙️</div>
        <h1 className="text-3xl font-bold text-white tracking-tight">FactoryFlow</h1>
        <p className="text-slate-400 mt-2 text-sm">اختر الملف التجاري للمتابعة</p>
      </div>

      {/* Profile Grid */}
      <div className="w-full max-w-2xl">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 rounded-2xl bg-slate-800 animate-pulse" />
            ))}
          </div>
        ) : profiles.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <p className="text-lg mb-2">لا توجد ملفات تجارية</p>
            <p className="text-sm">أنشئ ملفاً تجارياً للبدء</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {profiles.map(profile => {
              const cc = colorConfig(profile.color);
              const isOpening = opening === profile.id;
              return (
                <div key={profile.id} className="relative group">
                  <button
                    onClick={() => handleOpen(profile)}
                    disabled={isOpening || opening !== null}
                    className="w-full text-right rounded-2xl bg-slate-800 border border-slate-700
                               hover:border-slate-500 hover:bg-slate-750 transition-all duration-200
                               p-5 flex items-center gap-4 disabled:opacity-60 disabled:cursor-not-allowed
                               focus:outline-none focus:ring-2 focus:ring-slate-500 relative"
                  >
                    {/* Colored accent bar */}
                    <div className={`absolute top-0 right-0 w-1 h-full rounded-r-2xl ${cc.bg}`} />

                    {/* Emoji avatar */}
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl
                                     bg-slate-700 group-hover:bg-slate-600 transition-colors shrink-0`}>
                      {isOpening ? (
                        <svg className="w-6 h-6 text-white animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                      ) : profile.emoji}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="text-white font-semibold text-base truncate">{profile.name}</p>
                      <p className="text-slate-400 text-xs mt-1">{formatLastOpened(profile.lastOpened)}</p>
                    </div>

                    {/* Arrow */}
                    <svg className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors shrink-0 rotate-180"
                         viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd"
                            d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                            clipRule="evenodd" />
                    </svg>
                  </button>

                  {/* Delete button — appears on hover */}
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (opening !== null) { return; }
                      const ok = window.confirm(
                        `حذف الملف "${profile.name}"؟\n\nهذا لن يحذف قاعدة البيانات من القرص — فقط يزيل الملف من القائمة.`
                      );
                      if (!ok) { return; }
                      try {
                        await deleteProfile(profile.id);
                        setProfiles(prev => prev.filter(p => p.id !== profile.id));
                      } catch (err) {
                        console.error("Failed to delete profile:", err);
                      }
                    }}
                    title="حذف الملف"
                    className="absolute top-2 left-2 w-7 h-7 rounded-lg bg-slate-700 hover:bg-rose-600
                               text-slate-400 hover:text-white opacity-0 group-hover:opacity-100
                               transition-all flex items-center justify-center text-sm"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Add New Profile Button */}
        {!showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full rounded-2xl border-2 border-dashed border-slate-700 hover:border-slate-500
                       text-slate-500 hover:text-slate-300 transition-all duration-200 py-4 flex
                       items-center justify-center gap-2 text-sm font-medium"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd"
                    d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                    clipRule="evenodd" />
            </svg>
            إضافة ملف تجاري جديد
          </button>
        )}

        {/* Create Profile Form */}
        {showCreate && (
          <form
            onSubmit={handleCreate}
            className="rounded-2xl bg-slate-800 border border-slate-600 p-6 mt-2"
          >
            <h2 className="text-white font-semibold text-lg mb-5">ملف تجاري جديد</h2>

            {/* Name */}
            <div className="mb-4">
              <label className="block text-slate-300 text-sm font-medium mb-2">
                اسم الملف التجاري
              </label>
              <input
                type="text"
                value={newName}
                onChange={e => { setNewName(e.target.value); setNameError(""); }}
                placeholder="مثال: المصنع الأول"
                className="w-full rounded-xl bg-slate-700 border border-slate-600 text-white
                           placeholder:text-slate-500 px-4 py-3 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
                dir="rtl"
              />
              {nameError && (
                <p className="text-rose-400 text-xs mt-2">{nameError}</p>
              )}
            </div>

            {/* Emoji Picker */}
            <div className="mb-4">
              <label className="block text-slate-300 text-sm font-medium mb-2">الأيقونة</label>
              <div className="flex gap-2 flex-wrap">
                {PROFILE_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setNewEmoji(emoji)}
                    className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all
                                ${newEmoji === emoji
                                  ? "bg-blue-600 ring-2 ring-blue-400"
                                  : "bg-slate-700 hover:bg-slate-600"}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Color Picker */}
            <div className="mb-6">
              <label className="block text-slate-300 text-sm font-medium mb-2">اللون</label>
              <div className="flex gap-2 flex-wrap">
                {PROFILE_COLORS.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setNewColor(c.id)}
                    className={`w-8 h-8 rounded-full ${c.bg} transition-all
                                ${newColor === c.id ? `ring-2 ring-offset-2 ring-offset-slate-800 ${c.ring}` : ""}`}
                    title={c.label}
                  />
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => { setShowCreate(false); setNameError(""); setNewName(""); }}
                className="px-5 py-2.5 rounded-xl text-slate-400 hover:text-white text-sm
                           hover:bg-slate-700 transition-all"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={creating}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white
                           text-sm font-medium transition-all disabled:opacity-60 flex items-center gap-2"
              >
                {creating && (
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                )}
                إنشاء الملف التجاري
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Version */}
      <p className="mt-10 text-slate-600 text-xs">FactoryFlow v1.0.0 — النسخة المحلية</p>
    </div>
  );
}
