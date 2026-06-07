'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { register, login } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import LegalConsent from '@/components/LegalConsent';

// Read ?next without useSearchParams (avoids a Suspense boundary requirement).
const nextDest = () =>
  (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('next')) || '/';

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [mode, setMode]       = useState('signin'); // 'signin' | 'signup'
  const [name, setName]       = useState('');
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [consent, setConsent] = useState(false); // explicit DPDP consent + 18+ (signup only)

  // Already signed in? Skip the form.
  useEffect(() => {
    if (useAuthStore.getState().user) router.replace(nextDest());
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (mode === 'signup' && !consent) {
      setError('Please confirm you are 18+ and agree to the Terms & Privacy Policy.');
      return;
    }
    setLoading(true);
    try {
      const res = mode === 'signup'
        ? await register(name, email, password)
        : await login(email, password);
      const { accessToken, refreshToken, user } = res.data.data;
      setAuth(user, accessToken, refreshToken);
      router.replace(nextDest());
    } catch (err) {
      setError(err?.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh px-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8">
          <div className="w-10 h-10 bg-primary rounded-card flex items-center justify-center mb-4">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8 8 5 12 5 15a7 7 0 0014 0c0-3-3-7-7-13z" />
            </svg>
          </div>
          <h1 className="text-2xl font-700 text-text-main">KitUm</h1>
          <p className="text-text-muted text-sm mt-1">
            {mode === 'signin' ? 'Sign in to your account.' : 'Create a new account.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">Full Name</label>
              <input
                type="text"
                className="input"
                placeholder="Rilang Tariang"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-text-main mb-1">Email address</label>
            <input
              type="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus={mode === 'signin'}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-main mb-1">Password</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {mode === 'signin' && (
            <Link href="/forgot-password" className="text-primary text-xs font-medium hover:underline self-end -mt-2">
              Forgot password?
            </Link>
          )}

          {mode === 'signup' && (
            <label className="flex items-start gap-2 text-[11px] leading-relaxed text-text-muted">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
              />
              <span>
                I confirm I am <b>18 or older</b>, agree to the{' '}
                <Link href="/legal/terms" className="text-primary font-medium hover:underline">Terms</Link>{' '}
                and{' '}
                <Link href="/legal/privacy" className="text-primary font-medium hover:underline">Privacy Policy</Link>, and
                consent to KitUm processing my personal data (name, contact, address &amp; location) to provide
                the delivery service. You can withdraw consent or delete your account anytime.
              </span>
            </label>
          )}

          {error && <p className="text-red-600 text-xs">{error}</p>}

          <button
            type="submit"
            disabled={loading || (mode === 'signup' && !consent)}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? (mode === 'signup' ? 'Creating account…' : 'Signing in…') : (mode === 'signup' ? 'Sign Up' : 'Sign In')}
          </button>

          {mode === 'signin' && (
            <LegalConsent action="signing in" variant="auth" className="text-center" />
          )}
        </form>

        <p className="text-center text-sm text-text-muted mt-5">
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setConsent(false); }}
            className="text-primary font-medium hover:underline"
          >
            {mode === 'signin' ? 'Sign Up' : 'Sign In'}
          </button>
        </p>
      </div>
    </div>
  );
}
