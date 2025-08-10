import Link from 'next/link';
import { Film } from 'lucide-react';
import { getAllVideos } from '@/server/db';

export const dynamic = 'force-dynamic';

export default async function GalleryPage() {
  const videos = await getAllVideos();

  return (
    <main className="min-h-screen px-6 md:px-10 py-6">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-xl font-semibold tracking-wide">Illustrify</Link>
        <div className="flex items-center gap-6 text-sm">
          <Link href="/generate" className="font-semibold nav-link">Create</Link>
          <Link href="/profile" className="font-semibold nav-link">Profile</Link>
        </div>
      </header>

      <section className="mt-8">
        <h1 className="text-2xl font-semibold">Gallery</h1>
        <p className="text-white/70">Your generated videos live here.</p>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map(v => (
            <div key={v.id} className="card space-y-3">
              <video controls className="w-full rounded-2xl border border-white/15">
                <source src={v.url} type="video/mp4" />
              </video>
              <div className="text-sm text-white/70 truncate">{v.title}</div>
              <div className="flex items-center justify-between text-xs text-white/60">
                <span>{v.quality}</span>
                <span>{new Date(v.createdAt).toLocaleString()}</span>
              </div>
            </div>
          ))}
          {videos.length === 0 && (
            <div className="text-white/70">No videos yet. Generate one!</div>
          )}
        </div>
      </section>
    </main>
  );
}


