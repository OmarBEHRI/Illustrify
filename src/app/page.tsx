import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <nav className="flex items-center justify-between px-6 md:px-10 py-6">
        <div className="flex items-center gap-3">
          <span className="text-xl font-semibold tracking-wide">Illustrify</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/signin" className="btn-primary nav-link">Sign in</Link>
          <Link href="/signup" className="btn-accent nav-link">Get started</Link>
        </div>
      </nav>

      <section className="px-6 md:px-10 py-14 md:py-24">
        <div className="max-w-5xl mx-auto text-center animate-in fade-in duration-700">
          <h1 className="mt-6 text-4xl md:text-6xl font-bold tracking-tight">
            Turn any story into a stunning video
          </h1>
          <p className="mt-4 text-white/70 text-lg">
            Paste text, upload a PDF, or use a YouTube URL. Choose a visual style and quality, then generate a short narrated video in English.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link href="/generate" className="btn-accent inline-flex items-center gap-2">
              Start creating <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/gallery" className="btn-primary">View gallery</Link>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {[1,2,3].map((i) => (
            <div key={i} className="card h-52 relative overflow-hidden">
              <div className="absolute inset-0 shimmer animate-shimmer opacity-30" />
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-3xl bg-white/10 blur-2xl" />
              <div className="absolute -left-8 -bottom-8 h-24 w-24 rounded-3xl bg-emerald-400/20 blur-2xl" />
              <div className="relative z-10">
                <h3 className="text-xl font-semibold">Fluid creation #{i}</h3>
                <p className="mt-2 text-white/70">High-fidelity visuals with smooth glassmorphism.</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}


