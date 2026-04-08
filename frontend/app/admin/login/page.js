'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendOtp, verifyOtp, getMe } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

export default function AdminLoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [email, setEmail]     = useState('');
  const [otp, setOtp]         = useState('');
  const [step, setStep]       = useState('email'); // 'email' | 'otp'
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    try {
      await sendOtp(email.trim());
      setStep('otp');
    } catch {
      setError('Failed to send OTP. Check the email and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!otp.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await verifyOtp(email.trim(), otp.trim());
      const { token, user } = res.data.data;

      if (user.role !== 'admin') {
        setError('Access denied. This account does not have admin privileges.');
        setLoading(false);
        return;
      }

      login(token, user);
      router.replace('/admin');
    } catch {
      setError('Invalid or expired OTP. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-bg-card flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8 8 5 12 5 15a7 7 0 0014 0c0-3-3-7-7-13z" />
            </svg>
          </div>
          <span className="text-base font-700 text-text-main">KIT UM Admin</span>
        </div>

        <div className="card">
          <h1 className="text-base font-700 text-text-main mb-1">
            {step === 'email' ? 'Sign in to Admin' : 'Enter OTP'}
          </h1>
          <p className="text-xs text-text-muted mb-5">
            {step === 'email'
              ? 'Enter your admin email to receive a one-time password.'
              : `OTP sent to ${email}. Check your inbox.`}
          </p>

          {step === 'email' ? (
            <form onSubmit={handleSendOtp} className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium text-text-main mb-1">Admin Email</label>
                <input
                  className="input"
                  type="email"
                  placeholder="admin@kitum.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <button type="submit" disabled={loading} className="btn-primary py-2.5 text-sm disabled:opacity-50">
                {loading ? 'Sending…' : 'Send OTP'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium text-text-main mb-1">One-Time Password</label>
                <input
                  className="input tracking-[0.3em] text-center font-700 text-lg"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  autoFocus
                  required
                />
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <button type="submit" disabled={loading} className="btn-primary py-2.5 text-sm disabled:opacity-50">
                {loading ? 'Verifying…' : 'Sign In'}
              </button>
              <button
                type="button"
                onClick={() => { setStep('email'); setOtp(''); setError(''); }}
                className="text-xs text-text-muted hover:text-primary transition-colors text-center"
              >
                Use a different email
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
