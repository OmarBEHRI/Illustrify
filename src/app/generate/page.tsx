"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Upload, Youtube, User2, Image, Tv2 } from 'lucide-react';
import Link from 'next/link';

type Quality = 'LOW' | 'MEDIUM' | 'MAX';

export default function GeneratePage() {
  const [tab, setTab] = useState<'TEXT'|'PDF'|'YOUTUBE'>('TEXT');
  const [story, setStory] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [style, setStyle] = useState('Studio Ghibli, soft pastel, dreamy, volumetric light');
  const [quality, setQuality] = useState<Quality>('LOW');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const cost = useMemo(() => quality === 'LOW' ? 0 : quality === 'MEDIUM' ? 10 : 50, [quality]);

  async function handleUploadPdf(selected: File) {
    const form = new FormData();
    form.append('file', selected);
    const res = await fetch('/api/extract/pdf', { method: 'POST', body: form });
    if (!res.ok) throw new Error('PDF extraction failed');
    const data = await res.json();
    setStory(data.text || '');
  }

  async function handleExtractYoutube(url: string) {
    const res = await fetch('/api/extract/youtube', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
    if (!res.ok) throw new Error('YouTube extraction failed');
    const data = await res.json();
    setStory(data.text || '');
  }

  async function onGenerate() {
    setError(null);
    setLoading(true);
    setVideoUrl(null);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ story, style, quality })
      });
      if (!res.ok) throw new Error('Failed to start generation');
      const data = await res.json();
      setJobId(data.jobId);
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!jobId) return;
    const t = setInterval(async () => {
      const res = await fetch(`/api/generate?id=${jobId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.status === 'done') {
        setVideoUrl(data.url);
        setLoading(false);
        clearInterval(t);
      }
      if (data.status === 'error') {
        setError('Generation failed');
        setLoading(false);
        clearInterval(t);
      }
    }, 1500);
    return () => clearInterval(t);
  }, [jobId]);

  return (
    <main className="min-h-screen px-6 md:px-10 py-6">
      <HeaderMinimal />

      <section className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left controls */}
        <div className="card space-y-4 animate-in fade-in slide-in-from-left-4 duration-500">
          <div className="flex items-center gap-2 text-sm">
            <button className={`btn ${tab==='TEXT'?'bg-white/15 border border-white/20':''}`} onClick={()=>setTab('TEXT')}>Story</button>
            <button className={`btn ${tab==='PDF'?'bg-white/15 border border-white/20':''}`} onClick={()=>setTab('PDF')}>PDF</button>
            <button className={`btn ${tab==='YOUTUBE'?'bg-white/15 border border-white/20':''}`} onClick={()=>setTab('YOUTUBE')}>YouTube</button>
          </div>

          {tab==='TEXT' && (
            <textarea className="input mt-4 h-72 resize-none" placeholder="Write or paste your story..." value={story} onChange={(e)=>setStory(e.target.value)} />
          )}
          {tab==='PDF' && (
            <div className="mt-4">
              <input ref={inputRef} type="file" accept="application/pdf" hidden onChange={(e)=>{
                const f = e.target.files?.[0];
                if (f) { setFile(f); handleUploadPdf(f).catch(()=>setError('Could not read PDF')); }
              }} />
              <button className="btn-primary inline-flex items-center gap-2" onClick={()=>inputRef.current?.click()}>
                <Upload className="h-4 w-4"/> Upload PDF
              </button>
              {file && <p className="text-sm text-white/70 mt-2">{file.name}</p>}
              <textarea className="input mt-4 h-72 resize-none" placeholder="Extracted story will appear here" value={story} onChange={(e)=>setStory(e.target.value)} />
            </div>
          )}
          {tab==='YOUTUBE' && (
            <div className="mt-4 space-y-3">
              <div className="flex gap-2">
                <input className="input" placeholder="YouTube URL" value={youtubeUrl} onChange={(e)=>setYoutubeUrl(e.target.value)} />
                <button className="btn-primary inline-flex items-center gap-2" onClick={()=>handleExtractYoutube(youtubeUrl).catch(()=>setError('Could not extract from YouTube'))}>
                  <Youtube className="h-4 w-4"/> Extract
                </button>
              </div>
              <textarea className="input h-72 resize-none" placeholder="Extracted story will appear here" value={story} onChange={(e)=>setStory(e.target.value)} />
            </div>
          )}
        </div>

        {/* Middle preview container */}
        <div className="lg:col-span-1 order-first lg:order-none">
          <div className="card h-[520px] flex items-center justify-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            {videoUrl ? (
              <video controls className="w-full h-full object-cover rounded-2xl border border-white/15">
                <source src={videoUrl} type="video/mp4" />
              </video>
            ) : (
              <div className="text-center text-white/70">
                <Tv2 className="mx-auto h-10 w-10 mb-3" />
                Your video will appear here
              </div>
            )}
          </div>
        </div>

        {/* Right controls */}
        <div className="card space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
          <div>
            <label className="text-sm text-white/70">Visual style</label>
            <textarea className="input mt-2 h-40 resize-none" value={style} onChange={(e)=>setStyle(e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-white/70">Quality</label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(['LOW','MEDIUM','MAX'] as Quality[]).map(q=> (
                <button key={q} className={`btn ${quality===q?'bg-emerald-400/90 text-emerald-950':'bg-white/10 text-white border border-white/20'}`} onClick={()=>setQuality(q)}>
                  {q}
                </button>
              ))}
            </div>
            <p className="text-sm text-white/70 mt-2">Cost: {cost} credits</p>
          </div>

          <button className="btn-accent w-full" onClick={onGenerate} disabled={loading || !story.trim()}>
            {loading ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/>Generating...</span> : 'Generate video'}
          </button>
          {error && <p className="text-sm text-red-300">{error}</p>}
          {videoUrl && (
            <div className="flex gap-2">
              <a className="btn-primary" href={videoUrl} download>Download</a>
              <Link href="/gallery" className="btn-primary">Open in Gallery</Link>
            </div>
          )}
        </div>
      </section>

      {/* Gallery snippet */}
      <RecentGallerySnippet />
    </main>
  );
}

function HeaderMinimal() {
  const [me, setMe] = useState<{name?: string; credits?: number} | null>(null);
  useEffect(() => {
    fetch('/api/me').then(r=>r.json()).then(setMe).catch(()=>setMe(null));
  }, []);
  return (
    <header className="flex items-center justify-between">
      <Link href="/" className="text-xl font-semibold tracking-wide">Illustrify</Link>
      <div className="flex items-center gap-6 text-sm">
        <div className="font-semibold flex items-center gap-2"><User2 className="h-4 w-4"/>{me?.name ?? 'Guest'}</div>
        <div className="font-semibold">Credits: {me?.credits ?? 0}</div>
        <Link href="/gallery" className="font-semibold">Gallery</Link>
        <Link href="/profile" className="font-semibold">Profile</Link>
      </div>
    </header>
  );
}

function RecentGallerySnippet() {
  const [videos, setVideos] = useState<any[]>([]);
  useEffect(() => {
    fetch('/api/gallery/recent').then(r=>r.json()).then(d=>setVideos(d.videos||[])).catch(()=>setVideos([]));
  }, []);
  if (videos.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Image className="h-5 w-5"/> Recent videos</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {videos.slice(0,8).map((v) => (
          <div key={v.id} className="card animate-in fade-in duration-500">
            <video controls className="w-full rounded-2xl border border-white/15">
              <source src={v.url} type="video/mp4" />
            </video>
            <div className="mt-2 text-sm text-white/80 truncate">{v.title}</div>
          </div>
        ))}
      </div>
    </section>
  );
}


