"use client";
import Link from 'next/link';
import { useState } from 'react';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (!res.ok) throw new Error('Failed');
      window.location.href = '/generate';
    } catch (err: any) {
      setError('Invalid credentials');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="card w-full max-w-md">
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="text-white/70">Sign in to continue</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <input className="input" placeholder="Email" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required />
          <input className="input" placeholder="Password" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required />
          {error && <p className="text-red-300 text-sm">{error}</p>}
          <button className="btn-accent w-full" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
        </form>
        <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
          <button className="btn-primary">Google</button>
          <button className="btn-primary">Facebook</button>
          <button className="btn-primary">GitHub</button>
        </div>
        <p className="mt-4 text-sm text-white/70">No account? <Link href="/signup" className="underline">Create one</Link></p>
      </div>
    </main>
  );
}


