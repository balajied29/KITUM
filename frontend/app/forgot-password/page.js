'use client';
import { useState } from 'react';
import Link from 'next/link';
import { forgotPassword } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await forgotPassword(email);
    } catch {
      /* response is intentionally uniform */
    }
    setSent(true);
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-700 text-text-main mb-1">Reset password</h1>
        <p className="text-text-muted text-sm mb-6">We'll email you a link to set a new password.</p>

        {sent ? (
          <div className="card">
            <p className="text-sm text-text-main">
              If an account exists for <span className="font-medium">{email}</span>, a reset link is on its way.
              Check your inbox (and spam).
            </p>
            <Link href="/login" className="btn-primary w-full mt-4 inline-block text-center">Back to sign in</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-text-main mb-1">Email address</label>
              <input
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
            <Link href="/login" className="text-center text-sm text-text-muted hover:text-primary">
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
