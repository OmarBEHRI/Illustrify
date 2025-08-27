'use client';

import { useState, useEffect, useRef } from 'react';
import { Play, Download, RefreshCw, Upload, Settings, X, Maximize2, Film } from 'lucide-react';
import PageTemplate from '@/components/PageTemplate';
import { useAuth } from '@/contexts/AuthContext';
import pb, { pbHelpers, Animation } from '@/lib/pocketbase';

interface ChatMessage {
  type: 'user' | 'assistant';
  content: string;
  videoUrl?: string;
  timestamp: Date;
}

// Video dimensions options
const videoDimensions = [
  { label: '480x832', value: '480x832', width: 480, height: 832 },
  { label: '832x480', value: '832x480', width: 832, height: 480 },
  { label: '512x512', value: '512x512', width: 512, height: 512 },
  { label: '640x640', value: '640x640', width: 640, height: 640 }
];

// Quality options
const qualityOptions = [
  { label: 'Fast', value: 'fast', steps: 4 },
  { label: 'Balanced', value: 'balanced', steps: 6 },
  { label: 'Quality', value: 'quality', steps: 8 }
];

export default function AnimatePage() {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedImageBase64, setUploadedImageBase64] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState('480x832');
  const [quality, setQuality] = useState('balanced');
  const [isGenerating, setIsGenerating] = useState(false)
  const [showRemoveButton, setShowRemoveButton] = useState(false)
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [animationHistory, setAnimationHistory] = useState<Animation[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDimensionsDropdown, setShowDimensionsDropdown] = useState(false);
  const [showLengthDropdown, setShowLengthDropdown] = useState(false);
  const [showQualityDropdown, setShowQualityDropdown] = useState(false);
  const [pageLoaded, setPageLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const selectedDimensions = videoDimensions.find(d => d.value === dimensions)!;
  const selectedQuality = qualityOptions.find(q => q.value === quality)!;

  // Page load animation
  useEffect(() => {
    const timer = setTimeout(() => setPageLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Load animation history on component mount
  useEffect(() => {
    const loadAnimationHistory = async () => {
      if (user) {
        try {
          const userAnimations = await pbHelpers.getUserAnimations(user.id);
          setAnimationHistory(userAnimations);
        } catch (error) {
          console.error('Error loading animation history:', error);
        }
      }
    };

    loadAnimationHistory();
  }, [user]);

  const getFileUrl = (record: Animation, filename: string) => {
    return pb.files.getUrl(record, filename);
  };

  const handleFileUpload = async (file: File) => {
    if (file) {
      if (file.type.startsWith('image/')) {
        // If generation is in progress, show warning
        if (isGenerating) {
          const shouldContinue = window.confirm(
            'Uploading a new image will cancel the current animation generation. Do you want to continue?'
          )
          
          if (!shouldContinue) {
            return
          }
          
          // Cancel current generation
          await handleInterruptGeneration()
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          setUploadedImage(result);
          setUploadedImageBase64(result);
          setError(null);
          // Clear any existing video when new image is uploaded
          setGeneratedVideo(null);
          setShowRemoveButton(false);
        };
        reader.readAsDataURL(file);
      } else {
        setError('Please upload an image file');
      }
    }
  };

  const handleAnimate = async () => {
    if (!uploadedImageBase64) {
      setError('Please upload an image');
      return;
    }

    setLoading(true);
    setIsGenerating(true);
    setError(null);
    setShowRemoveButton(false);

    // Add user message to chat
    const userMessage = {
      type: 'user' as const,
      content: prompt || 'Generate animation without prompt',
      timestamp: new Date()
    };
    setChatHistory(prev => [...prev, userMessage]);

    try {
      const response = await fetch('/api/animate/image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          image: uploadedImageBase64,
          prompt,
          width: selectedDimensions.width,
          height: selectedDimensions.height,
          length: 161, // Fixed 5 seconds at 32fps
          steps: selectedQuality.steps,
          frame_rate: 32
        }),
      });

      const data = await response.json();
      if (data.success && data.video) {
        const videoUrl = data.video.url || `data:video/mp4;base64,${data.video.data}`;
        setGeneratedVideo(videoUrl);
        setShowRemoveButton(true);

        const assistantMessage = {
          type: 'assistant' as const,
          content: prompt ? `Generated animation for: "${prompt}"` : 'Generated animation from image',
          videoUrl,
          timestamp: new Date()
        };
        setChatHistory(prev => [...prev, assistantMessage]);
        
        // Refresh animation history from PocketBase
        if (user) {
          try {
            const userAnimations = await pbHelpers.getUserAnimations(user.id);
            setAnimationHistory(userAnimations);
          } catch (error) {
            console.error('Error refreshing animation history:', error);
          }
        }
      } else {
        throw new Error(data.error || 'Failed to generate animation');
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
      setIsGenerating(false);
      setPrompt('');
    }
  };

  const handleInterruptGeneration = async () => {
    try {
      const response = await fetch('/api/interrupt', {
        method: 'POST',
      });
      
      if (response.ok) {
        setLoading(false);
        setIsGenerating(false);
        setError('Animation generation was cancelled');
      }
    } catch (error) {
      console.error('Failed to interrupt generation:', error);
    }
  };

  const handleRemoveVideo = () => {
    setGeneratedVideo(null)
    setShowRemoveButton(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileUpload(files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAnimate();
    }
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.dropdown-container')) {
        setShowDimensionsDropdown(false);
        setShowLengthDropdown(false);
        setShowQualityDropdown(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <PageTemplate>
      <div className={`flex flex-col transition-all duration-700 ease-out ${
        pageLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`} style={{ height: 'calc(100vh - 120px)' }}>
        {/* Header */}
        <div className="flex-shrink-0 pb-4">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Film className="h-6 w-6 text-emerald-400" />
            Image Animation
          </h1>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Video Display - Takes majority of screen */}
          <div className="flex-1 px-6 py-4 flex items-center justify-center" style={{ height: 'calc(100vh - 300px)' }}>
            {generatedVideo ? (
              <div className="relative w-full h-full group cursor-pointer" onClick={() => setIsFullscreen(true)}>
                {/* Remove button */}
                {showRemoveButton && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveVideo();
                    }}
                    className="absolute -top-3 -right-3 z-10 w-8 h-8 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors shadow-lg"
                  >
                    <X className="h-4 w-4 text-white" />
                  </button>
                )}
                {/* Main video */}
                <video 
                  ref={videoRef}
                  src={generatedVideo} 
                  controls
                  autoPlay
                  loop
                  muted
                  className="w-full h-full object-contain rounded-lg border border-white/20 shadow-2xl transition-transform group-hover:scale-[1.02]"
                />

                {/* Top-right actions */}
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsFullscreen(true);
                    }}
                    className="btn-primary px-3 py-2 flex items-center gap-2 backdrop-blur-sm bg-black/50 hover:bg-black/70"
                  >
                    <Maximize2 className="h-4 w-4" />
                    Fullscreen
                  </button>
                  <a 
                    href={generatedVideo} 
                    download 
                    onClick={(e) => e.stopPropagation()}
                    className="btn-primary px-3 py-2 flex items-center gap-2 backdrop-blur-sm bg-black/50 hover:bg-black/70"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </a>
                </div>

                {/* Loading overlay */}
                {loading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 backdrop-blur-sm rounded-lg">
                    <RefreshCw className="h-7 w-7 animate-spin text-white" />
                    <span className="mt-2 text-white/80 text-sm">Generating animation...</span>
                    {isGenerating && (
                      <button
                        onClick={handleInterruptGeneration}
                        className="mt-3 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : uploadedImage ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <img 
                  src={uploadedImage} 
                  alt="Uploaded image"
                  className="max-w-full max-h-full object-contain rounded-lg border border-white/20 shadow-2xl"
                />
                {loading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 backdrop-blur-sm rounded-lg">
                    <RefreshCw className="h-7 w-7 animate-spin text-white" />
                    <span className="mt-2 text-white/80 text-sm">Generating animation...</span>
                    {isGenerating && (
                      <button
                        onClick={handleInterruptGeneration}
                        className="mt-3 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-white/20 rounded-lg">
                <Upload className="h-12 w-12 text-white/40 mb-4" />
                <h3 className="text-lg font-medium text-white/80 mb-2">Upload an Image to Animate</h3>
                <p className="text-white/60 mb-4">Drag and drop an image here or choose a file</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-primary px-6 py-3 flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Choose Image
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                  className="hidden"
                />
              </div>
            )}
          </div>

          {/* Divider Line */}
        <div className="w-px bg-white/10 mx-2"></div>

        {/* History Sidebar - Floating */}
        <div className="w-80 overflow-y-auto p-4">
            <div className="bg-transparent p-4">
              <h3 className="text-lg font-semibold text-white mb-4">Animation History</h3>
              <div className="space-y-3">
                {animationHistory.map((animation) => (
                  <div key={animation.id} className="relative group cursor-pointer" onClick={() => setGeneratedVideo(getFileUrl(animation, animation.animation))}>
                    <div className="aspect-video bg-white/10 rounded-lg overflow-hidden border border-white/20 hover:border-emerald-400/50 transition-colors">
                      <video 
                        src={getFileUrl(animation, animation.animation)}
                        className="w-full h-full object-cover"
                        muted
                      />
                    </div>
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                      <Play className="h-6 w-6 text-white" />
                    </div>
                    <div className="mt-2">
                      <p className="text-xs text-white/80 truncate">{animation.prompt}</p>
                      <p className="text-xs text-white/60">{new Date(animation.created).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Input Area - Floating Components */}
        <div className="flex-shrink-0 p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/20 backdrop-blur-md border border-red-500/40 rounded-xl text-red-200 text-sm shadow-lg">
              {error}
            </div>
          )}

          {/* Settings Row - Floating Cards */}
          <div className="flex gap-4">
            {/* Dimensions Dropdown */}
            <div className="dropdown-container relative">
              <button
                onClick={() => setShowDimensionsDropdown(!showDimensionsDropdown)}
                className="px-4 py-2 bg-black/40 backdrop-blur-md border border-white/20 rounded-xl text-white hover:bg-black/60 transition flex items-center gap-2 shadow-lg"
              >
                <Settings className="h-4 w-4" />
                {selectedDimensions.label}
              </button>
              {showDimensionsDropdown && (
                <div className="absolute bottom-full mb-2 left-0 bg-black/90 border border-white/20 rounded-lg shadow-xl backdrop-blur-md z-10 min-w-[150px]">
                  {videoDimensions.map((dim) => (
                    <button
                      key={dim.value}
                      onClick={() => {
                        setDimensions(dim.value);
                        setShowDimensionsDropdown(false);
                      }}
                      className={`w-full px-4 py-2 text-left hover:bg-white/10 transition first:rounded-t-lg last:rounded-b-lg ${
                        dimensions === dim.value ? 'bg-emerald-400/20 text-emerald-200' : 'text-white'
                      }`}
                    >
                      {dim.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quality Dropdown */}
            <div className="dropdown-container relative">
              <button
                onClick={() => setShowQualityDropdown(!showQualityDropdown)}
                className="px-4 py-2 bg-black/40 backdrop-blur-md border border-white/20 rounded-xl text-white hover:bg-black/60 transition flex items-center gap-2 shadow-lg"
              >
                <Settings className="h-4 w-4" />
                {selectedQuality.label}
              </button>
              {showQualityDropdown && (
                <div className="absolute bottom-full mb-2 left-0 bg-black/90 border border-white/20 rounded-lg shadow-xl backdrop-blur-md z-10 min-w-[150px]">
                  {qualityOptions.map((qual) => (
                    <button
                      key={qual.value}
                      onClick={() => {
                        setQuality(qual.value);
                        setShowQualityDropdown(false);
                      }}
                      className={`w-full px-4 py-2 text-left hover:bg-white/10 transition first:rounded-t-lg last:rounded-b-lg ${
                        quality === qual.value ? 'bg-emerald-400/20 text-emerald-200' : 'text-white'
                      }`}
                    >
                      {qual.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {uploadedImage && (
              <button
                onClick={() => {
                  setUploadedImage(null);
                  setUploadedImageBase64(null);
                  setGeneratedVideo(null);
                  setError(null);
                }}
                className="px-4 py-2 bg-black/40 backdrop-blur-md border border-white/20 rounded-xl text-white hover:bg-black/60 transition flex items-center gap-2 shadow-lg"
              >
                <X className="h-4 w-4" />
                Clear
              </button>
            )}
          </div>

          {/* Prompt Input - Floating */}
          <div className="bg-transparent rounded-xl p-4 shadow-lg">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Describe the animation you want to create (optional)..."
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/60 focus:outline-none focus:border-emerald-400/50 focus:bg-white/15 transition"
                  disabled={loading || !uploadedImage}
                />
              </div>
              <button
                onClick={handleAnimate}
                disabled={loading || !uploadedImage}
                className="btn-primary px-6 py-3 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {loading ? 'Animating...' : 'Animate'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Modal */}
      {isFullscreen && generatedVideo && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="relative max-w-full max-h-full">
            <button
              onClick={() => setIsFullscreen(false)}
              className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition"
            >
              <X className="h-6 w-6" />
            </button>
            <video 
              src={generatedVideo}
              controls
              autoPlay
              loop
              className="max-w-full max-h-full rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}
    </PageTemplate>
  );
}