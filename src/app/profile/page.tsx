import Link from 'next/link';
import { Film } from 'lucide-react';
import { getCurrentUser } from '@/server/auth';

export default async function ProfilePage() {
  const user = await getCurrentUser();

  return (
    <main className="min-h-screen px-6 md:px-10 py-6">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-xl font-semibold tracking-wide">Illustrify</Link>
        <div className="flex items-center gap-6 text-sm">
          <Link href="/gallery" className="font-semibold nav-link">Gallery</Link>
          <Link href="/generate" className="font-semibold nav-link">Create</Link>
          <form action="/api/auth/signout" method="post">
            <button className="btn-primary">Sign out</button>
          </form>
        </div>
      </header>

      <section className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-xl font-semibold">Account</h2>
          <div className="mt-4 text-white/80 space-y-1">
            <div>Email: {user?.email ?? 'Guest'}</div>
            <div>Credits: {user?.credits ?? 0}</div>
          </div>
          <div className="mt-4 flex gap-2">
            <form action="/api/credits/add" method="post">
              <input type="hidden" name="amount" value="50" />
              <button className="btn-accent">Add 50 credits</button>
            </form>
            <form action="/api/credits/add" method="post">
              <input type="hidden" name="amount" value="200" />
              <button className="btn-primary">Add 200 credits</button>
            </form>
          </div>
        </div>
        <div className="card">
          <h2 className="text-xl font-semibold">Quick links</h2>
          <div className="mt-4 flex gap-3">
            <Link href="/generate" className="btn-accent">Create</Link>
            <Link href="/gallery" className="btn-primary">Gallery</Link>
          </div>
        </div>
      </section>
    </main>
  );
}


