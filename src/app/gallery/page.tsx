'use client';

import Link from 'next/link';
import { Film, Image as ImageIcon, Music, Plus, Download, ExternalLink, Calendar } from 'lucide-react';
import PageTemplate from '@/components/PageTemplate';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import pb, { pbHelpers, Video, Image, Audio } from '@/lib/pocketbase';

type ContentType = 'video' | 'image' | 'audio';

export default function GalleryPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ContentType>('video');
  const [videos, setVideos] = useState<Video[]>([]);
  const [images, setImages] = useState<Image[]>([]);
  const [audio, setAudio] = useState<Audio[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        if (user) {
          const [userVideos, userImages, userAudio] = await Promise.all([
            pbHelpers.getUserVideos(user.id),
            pbHelpers.getUserImages(user.id),
            pbHelpers.getUserAudio(user.id)
          ]);
          
          // Filter images for generated/edited types with non-empty files
          const filteredImages = userImages.filter(image => 
            image.image_file && 
            (image.type === 'generation' || image.type === 'edit')
          );
          
          // Filter audio with non-empty files
          const filteredAudio = userAudio.filter(audio => audio.audio_file);
          
          setVideos(userVideos);
          setImages(filteredImages);
          setAudio(filteredAudio);
        }
      } catch (error) {
        console.error('Error fetching content:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [user]);

  const getFileUrl = (record: Image | Audio, filename: string) => {
    return pb.files.getUrl(record, filename);
  };

  const tabs = [
    { id: 'video' as ContentType, label: 'Videos', icon: Film, count: videos.length },
    { id: 'image' as ContentType, label: 'Images', icon: ImageIcon, count: images.length },
    { id: 'audio' as ContentType, label: 'Audio', icon: Music, count: audio.length }
  ];

  const renderContent = () => {
    if (loading) {
      return <div className="text-white/70">Loading {activeTab}...</div>;
    }

    switch (activeTab) {
      case 'video':
        return videos.length === 0 ? (
          <div className="text-white/70">No videos yet. <Link href="/video" className="text-emerald-400 hover:underline">Generate one!</Link></div>
        ) : (
          videos.map(v => (
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
          ))
        );
      
      case 'image':
        return images.length === 0 ? (
          <div className="text-white/70">No images yet. <Link href="/image" className="text-emerald-400 hover:underline">Generate one!</Link></div>
        ) : (
          images.map(img => (
            <div key={img.id} className="card space-y-3">
              <img 
                src={getFileUrl(img, img.image_file)} 
                alt={img.prompt}
                className="w-full rounded-2xl border border-white/15 object-cover aspect-square"
              />
              <div className="text-sm text-white/70 truncate">{img.prompt}</div>
              <div className="flex items-center justify-between text-xs text-white/60">
                <span className="capitalize">{img.type}</span>
                <span>{new Date(img.created).toLocaleString()}</span>
              </div>
            </div>
          ))
        );
      
      case 'audio':
        return audio.length === 0 ? (
          <div className="text-white/70">No audio yet. <Link href="/audio" className="text-emerald-400 hover:underline">Generate one!</Link></div>
        ) : (
          audio.map(aud => (
            <div key={aud.id} className="card space-y-3">
              <audio controls className="w-full">
                <source src={getFileUrl(aud, aud.audio_file)} type="audio/mpeg" />
              </audio>
              <div className="text-sm text-white/70 truncate">{aud.transcript}</div>
              <div className="flex items-center justify-between text-xs text-white/60">
                <span>{aud.voice}</span>
                <span>{new Date(aud.created).toLocaleString()}</span>
              </div>
            </div>
          ))
        );
      
      default:
        return null;
    }
  };

  return (
    <PageTemplate>
      <section className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-semibold">Gallery</h1>
        <p className="text-white/70">Your generated content lives here.</p>

        {/* Tab Navigation */}
        <div className="mt-6 flex space-x-1 bg-white/5 rounded-2xl p-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all ${
                  activeTab === tab.id
                    ? 'bg-emerald-500 text-white'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{tab.count}</span>
              </button>
            );
          })}
        </div>

        {/* Content Grid */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {renderContent()}
        </div>
      </section>
    </PageTemplate>
  );
}


