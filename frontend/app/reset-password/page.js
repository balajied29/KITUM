'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { resetPassword } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get('token');
  const setAuth = useAuthStore((s) => s.setAuth);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!token) {
    return (
      <div className="card">
        <p className="text-sm text-text-main">This reset link is invalid or incomplete.</p>
        <Link href="/forgot-password" className="btn-primary w-full mt-4 inline-block text-center">Request a new link</Link>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setLoading(true);
    try {
      const res = await resetPassword(token, password);
      const { accessToken, refreshToken, user } = res.data.data;
      setAuth(user, accessToken, refreshToken); // reset signs you straight in
      router.replace('/');
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not reset password. The link may have expired.');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-sm font-medium text-text-main mb-1">New password</label>
        <input type="password" className="input" placeholder="••••••••" value={password}
          onChange={(e) => setPassword(e.target.value)} required minLength={6} autoFocus />
      </div>
      <div>
        <label className="block text-sm font-medium text-text-main mb-1">Confirm password</label>
        <input type="password" className="input" placeholder="••••••••" value={confirm}
          onChange={(e) => setConfirm(e.target.value)} required minLength={6} />
      </div>
      {error && <p className="text-red-600 text-xs">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? 'Saving…' : 'Set new password'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-700 text-text-main mb-1">Set a new password</h1>
        <p className="text-text-muted text-sm mb-6">Choose a strong password you don't use elsewhere.</p>
        <Suspense fallback={null}>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  );
}
