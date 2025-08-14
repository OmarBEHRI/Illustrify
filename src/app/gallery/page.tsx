'use client';

import Link from 'next/link';
import { Film, Plus, Download, ExternalLink, Calendar } from 'lucide-react';
import PageTemplate from '@/components/PageTemplate';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { pbHelpers, Video } from '@/lib/pocketbase';

export default function GalleryPage() {
  const { user } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        if (user) {
          const userVideos = await pbHelpers.getUserVideos(user.id);
          setVideos(userVideos);
        }
      } catch (error) {
        console.error('Error fetching videos:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, [user]);

  return (
    <PageTemplate>
      <section className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-semibold">Gallery</h1>
        <p className="text-white/70">Your generated videos live here.</p>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="text-white/70">Loading videos...</div>
          ) : videos.map(v => (
            <div key={v.id} className="card space-y-3">
              <video controls className="w-full rounded-2xl border border-white/15">
                <source src={v.video_url} type="video/mp4" />
              </video>
              <div className="text-sm text-white/70 truncate">{v.title}</div>
              <div className="flex items-center justify-between text-xs text-white/60">
                <span>{v.quality}</span>
                <span>{new Date(v.created).toLocaleString()}</span>
              </div>
            </div>
          ))}
          {!loading && videos.length === 0 && (
            <div className="text-white/70">No videos yet. <Link href="/generate" className="text-emerald-400 hover:underline">Generate one!</Link></div>
          )}
        </div>
      </section>
    </PageTemplate>
  );
}


