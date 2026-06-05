'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { updateProfile } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import AppHeader from '@/components/AppHeader';

export default function EditProfilePage() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!useAuthStore.getState().user) { router.replace('/login?next=/account/edit'); return; }
    setName(user?.name || '');
    setPhone(user?.phone || '');
  }, [user, router]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required.'); return; }
    setError('');
    setSaving(true);
    try {
      const res = await updateProfile({ name: name.trim(), phone: phone.trim() });
      setUser(res.data.data);
      router.replace('/account');
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not save your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="pb-6">
      <AppHeader showLocality={false} />

      <div className="px-4 pt-2">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => router.back()} className="text-text-muted">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-base font-700 text-text-main">Edit Profile</h1>
        </div>

        <form onSubmit={handleSave} className="card flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-text-main mb-1">Full Name</label>
            <input className="input" placeholder="Rilang Tariang" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-main mb-1">Phone Number</label>
            <input className="input" type="tel" placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-main mb-1">Email</label>
            <input className="input bg-bg-card text-text-muted" value={user?.email || ''} disabled />
            <p className="text-[11px] text-text-muted mt-1">Email can't be changed.</p>
          </div>

          {error && <p className="text-red-600 text-xs">{error}</p>}

          <button type="submit" disabled={saving} className="btn-primary w-full disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      </div>
    </main>
  );
}
