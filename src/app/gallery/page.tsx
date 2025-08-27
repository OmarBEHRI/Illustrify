'use client';

import Link from 'next/link';
import { Film, Image as ImageIcon, Music, Plus, Download, ExternalLink, Calendar, Play, Trash2, X, Eye } from 'lucide-react';
import PageTemplate from '@/components/PageTemplate';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import pb, { pbHelpers, Video, Image, Audio, Animation } from '@/lib/pocketbase';

type ContentType = 'video' | 'image' | 'audio' | 'animation';

export default function GalleryPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ContentType>('video');
  const [videos, setVideos] = useState<Video[]>([]);
  const [images, setImages] = useState<Image[]>([]);
  const [audio, setAudio] = useState<Audio[]>([]);
  const [animations, setAnimations] = useState<Animation[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageLoaded, setPageLoaded] = useState(false);
  const [previewItem, setPreviewItem] = useState<any>(null);
  const [previewType, setPreviewType] = useState<ContentType | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{item: any, type: ContentType} | null>(null);

  // Page load animation
  useEffect(() => {
    const timer = setTimeout(() => setPageLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        if (user) {
          const [userVideos, userImages, userAudio, userAnimations] = await Promise.all([
            pbHelpers.getUserVideos(user.id),
            pbHelpers.getUserImages(user.id),
            pbHelpers.getUserAudio(user.id),
            pbHelpers.getUserAnimations(user.id)
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
          setAnimations(userAnimations);
        }
      } catch (error) {
        console.error('Error fetching content:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [user]);

  const getFileUrl = (record: Image | Audio | Animation, filename: string) => {
    return pb.files.getUrl(record, filename);
  };

  const openPreview = (item: any, type: ContentType) => {
    setPreviewItem(item);
    setPreviewType(type);
  };

  const closePreview = () => {
    setPreviewItem(null);
    setPreviewType(null);
  };

  const showDeleteConfirmation = (item: any, type: ContentType) => {
    setConfirmDelete({ item, type });
  };

  const cancelDelete = () => {
    setConfirmDelete(null);
  };

  const confirmDeleteAction = async () => {
    if (!confirmDelete) return;
    
    const { item, type } = confirmDelete;
    setConfirmDelete(null);
    setDeleting(item.id);
    
    try {
      // For videos, we need to delete related scenes first due to foreign key constraints
      if (type === 'video') {
        // Get all scenes related to this video
        const scenes = await pb.collection('scenes').getFullList({
          filter: `video = "${item.id}"`
        });
        
        // Delete all related scenes first
        for (const scene of scenes) {
          await pb.collection('scenes').delete(scene.id);
        }
      }
      
      // Now delete the main item
      await pb.collection(type === 'image' ? 'image' : type === 'audio' ? 'audio' : type === 'animation' ? 'animations' : 'videos').delete(item.id);
      
      // Update local state
      if (type === 'image') {
        setImages(prev => prev.filter(i => i.id !== item.id));
      } else if (type === 'audio') {
        setAudio(prev => prev.filter(a => a.id !== item.id));
      } else if (type === 'animation') {
        setAnimations(prev => prev.filter(a => a.id !== item.id));
      } else if (type === 'video') {
        setVideos(prev => prev.filter(v => v.id !== item.id));
      }
      
      // Close preview modal if the deleted item was being previewed
      if (previewItem && previewItem.id === item.id) {
        closePreview();
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Failed to delete item. Please try again.');
    } finally {
      setDeleting(null);
    }
  };

  const tabs = [
    { id: 'video' as ContentType, label: 'Videos', icon: Film, count: videos.length },
    { id: 'image' as ContentType, label: 'Images', icon: ImageIcon, count: images.length },
    { id: 'audio' as ContentType, label: 'Audio', icon: Music, count: audio.length },
    { id: 'animation' as ContentType, label: 'Animations', icon: Play, count: animations.length }
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
            <div key={v.id} className="card space-y-3 relative group">
              <div className="relative">
                <video controls className="w-full rounded-2xl border border-white/15">
                  <source src={v.video_url} type="video/mp4" />
                </video>
                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openPreview(v, 'video')}
                    className="p-2 bg-black/50 hover:bg-black/70 rounded-lg transition-colors"
                  >
                    <Eye className="h-4 w-4 text-white" />
                  </button>
                  <button
                    onClick={() => showDeleteConfirmation(v, 'video')}
                    disabled={deleting === v.id}
                    className="p-2 bg-red-500/50 hover:bg-red-500/70 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4 text-white" />
                  </button>
                </div>
              </div>
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
            <div key={img.id} className="card space-y-3 relative group">
              <div className="relative cursor-pointer" onClick={() => openPreview(img, 'image')}>
                <img 
                  src={getFileUrl(img, img.image_file)} 
                  alt={img.prompt}
                  className="w-full rounded-2xl border border-white/15 object-cover aspect-square hover:opacity-80 transition-opacity"
                />
                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openPreview(img, 'image');
                    }}
                    className="p-2 bg-black/50 hover:bg-black/70 rounded-lg transition-colors"
                  >
                    <Eye className="h-4 w-4 text-white" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(img, 'image');
                    }}
                    disabled={deleting === img.id}
                    className="p-2 bg-red-500/50 hover:bg-red-500/70 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4 text-white" />
                  </button>
                </div>
              </div>
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
            <div key={aud.id} className="card space-y-3 relative group">
              <div className="relative">
                <audio controls className="w-full">
                  <source src={getFileUrl(aud, aud.audio_file)} type="audio/mpeg" />
                </audio>
                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openPreview(aud, 'audio')}
                    className="p-2 bg-black/50 hover:bg-black/70 rounded-lg transition-colors"
                  >
                    <Eye className="h-4 w-4 text-white" />
                  </button>
                  <button
                    onClick={() => showDeleteConfirmation(aud, 'audio')}
                    disabled={deleting === aud.id}
                    className="p-2 bg-red-500/50 hover:bg-red-500/70 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4 text-white" />
                  </button>
                </div>
              </div>
              <div className="text-sm text-white/70 truncate">{aud.transcript}</div>
              <div className="flex items-center justify-between text-xs text-white/60">
                <span>{aud.voice}</span>
                <span>{new Date(aud.created).toLocaleString()}</span>
              </div>
            </div>
          ))
        );
      
      case 'animation':
        return animations.length === 0 ? (
          <div className="text-white/70">No animations yet. <Link href="/animate" className="text-emerald-400 hover:underline">Create one!</Link></div>
        ) : (
          animations.map(anim => (
            <div key={anim.id} className="card space-y-3 relative group">
              <div className="relative cursor-pointer" onClick={() => openPreview(anim, 'animation')}>
                <video controls autoPlay loop muted className="w-full rounded-2xl border border-white/15 hover:opacity-80 transition-opacity">
                  <source src={getFileUrl(anim, anim.animation)} type="video/mp4" />
                </video>
                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openPreview(anim, 'animation');
                    }}
                    className="p-2 bg-black/50 hover:bg-black/70 rounded-lg transition-colors"
                  >
                    <Eye className="h-4 w-4 text-white" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      showDeleteConfirmation(anim, 'animation');
                    }}
                    disabled={deleting === anim.id}
                    className="p-2 bg-red-500/50 hover:bg-red-500/70 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4 text-white" />
                  </button>
                </div>
              </div>
              <div className="text-sm text-white/70 truncate">{anim.prompt || 'No prompt'}</div>
              <div className="flex items-center justify-between text-xs text-white/60">
                <span>Animation</span>
                <span>{new Date(anim.created).toLocaleString()}</span>
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
      <section className={`max-w-6xl mx-auto transition-all duration-700 ease-out ${
        pageLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}>
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

      {/* Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closePreview}>
          <div 
               className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 max-w-4xl max-h-[90vh] overflow-hidden preview-modal-content" 
               onClick={(e) => e.stopPropagation()}
             >
            <style jsx>{`
               .preview-modal-content {
                 scrollbar-width: thin;
                 scrollbar-color: rgba(255, 255, 255, 0.3) rgba(255, 255, 255, 0.1);
               }
               .preview-modal-content::-webkit-scrollbar {
                 width: 8px;
                 height: 8px;
               }
               .preview-modal-content::-webkit-scrollbar-track {
                 background: transparent;
               }
               .preview-modal-content::-webkit-scrollbar-thumb {
                 background: rgba(255, 255, 255, 0.3);
                 border-radius: 4px;
               }
               .preview-modal-content::-webkit-scrollbar-thumb:hover {
                 background: rgba(255, 255, 255, 0.5);
               }
               .preview-modal-content::-webkit-scrollbar-corner {
                 background: transparent;
               }
             `}</style>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-white">Preview</h3>
              <button
                onClick={closePreview}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-white" />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Content Display */}
              <div className="flex justify-center">
                {previewType === 'image' && (
                  <img
                    src={getFileUrl(previewItem, previewItem.image_file)}
                    alt={previewItem.prompt}
                    className="max-w-full max-h-[60vh] object-contain rounded-xl border border-white/20"
                  />
                )}
                {previewType === 'video' && (
                  <video
                    controls
                    className="max-w-full max-h-[60vh] rounded-xl border border-white/20"
                  >
                    <source src={previewItem.video_url} type="video/mp4" />
                  </video>
                )}
                {previewType === 'audio' && (
                  <div className="w-full max-w-md">
                    <audio controls className="w-full">
                      <source src={getFileUrl(previewItem, previewItem.audio_file)} type="audio/mpeg" />
                    </audio>
                  </div>
                )}
                {previewType === 'animation' && (
                  <video
                    controls
                    autoPlay
                    loop
                    muted
                    className="max-w-full max-h-[60vh] rounded-xl border border-white/20"
                  >
                    <source src={getFileUrl(previewItem, previewItem.animation)} type="video/mp4" />
                  </video>
                )}
              </div>
              
              {/* Prompt/Details */}
              <div className="bg-white/5 rounded-xl p-4 space-y-3">
                <div>
                  <h4 className="text-sm font-medium text-white/80 mb-2">Prompt:</h4>
                  <p className="text-white/70">
                    {previewType === 'image' && previewItem.prompt}
                    {previewType === 'video' && previewItem.title}
                    {previewType === 'audio' && previewItem.transcript}
                    {previewType === 'animation' && (previewItem.prompt || 'No prompt available')}
                  </p>
                </div>
                
                <div className="flex items-center justify-between text-xs text-white/60">
                  <span className="capitalize">
                    {previewType === 'image' && previewItem.type}
                    {previewType === 'video' && previewItem.quality}
                    {previewType === 'audio' && previewItem.voice}
                    {previewType === 'animation' && 'Animation'}
                  </span>
                  <span>{new Date(previewItem.created).toLocaleString()}</span>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => showDeleteConfirmation(previewItem, previewType!)}
                  disabled={deleting === previewItem.id}
                  className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  {deleting === previewItem.id ? 'Deleting...' : 'Delete'}
                </button>
                <a
                  href={
                    previewType === 'image' ? getFileUrl(previewItem, previewItem.image_file) :
                    previewType === 'video' ? previewItem.video_url :
                    previewType === 'audio' ? getFileUrl(previewItem, previewItem.audio_file) :
                    previewType === 'animation' ? getFileUrl(previewItem, previewItem.animation) : '#'
                  }
                  download
                  className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Popup */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 max-w-sm w-full mx-4">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
                <Trash2 className="h-6 w-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Delete {confirmDelete.type}</h3>
                <p className="text-white/70 text-sm">
                  Are you sure you want to delete this {confirmDelete.type}? This action cannot be undone.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={cancelDelete}
                  className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteAction}
                  className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageTemplate>
  );
}


