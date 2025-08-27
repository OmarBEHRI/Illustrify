'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Download, RefreshCw, Image as ImageIcon, Settings, X, Maximize2, Pencil, Upload } from 'lucide-react';
import PageTemplate from '@/components/PageTemplate';
import { useAuth } from '@/contexts/AuthContext';
import pb, { pbHelpers, Image } from '@/lib/pocketbase';

interface ChatMessage {
  type: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
  timestamp: Date;
}

// Style presets for image generation
const stylePresets = [
  {
    id: 'default',
    name: 'Default',
    prompt: '',
    image: null
  },
  {
    id: 'anime',
    name: 'Anime',
    prompt: 'anime style, detailed character design, vibrant colors, cel-shaded artwork',
    image: '/style-presets/anime.jpg'
  },
  {
    id: 'realistic',
    name: 'Realistic',
    prompt: 'photorealistic, high detail, professional photography, natural lighting',
    image: '/style-presets/realistic.jpg'
  },
  {
    id: 'cartoon',
    name: 'Cartoon',
    prompt: 'cartoon style, colorful, whimsical, animated character design',
    image: '/style-presets/cartoon.jpg'
  },
  {
    id: 'watercolor',
    name: 'Watercolor',
    prompt: 'watercolor painting, soft brushstrokes, artistic, traditional medium',
    image: '/style-presets/watercolor.jpg'
  },
  {
    id: 'oil-painting',
    name: 'Oil Painting',
    prompt: 'oil painting, textured brushstrokes, classical art style, rich colors',
    image: '/style-presets/oil-painting.jpg'
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    prompt: 'cyberpunk style, neon lights, futuristic, dark atmosphere, tech noir',
    image: '/style-presets/cyberpunk.jpg'
  }
];

// Aspect ratio options
const aspectRatios = [
  { label: '1:1', value: '1:1', width: 1024, height: 1024 },
  { label: '16:9', value: '16:9', width: 1344, height: 768 },
  { label: '9:16', value: '9:16', width: 768, height: 1344 },
  { label: '4:3', value: '4:3', width: 1152, height: 896 },
  { label: '3:4', value: '3:4', width: 896, height: 1152 },
  { label: '21:9', value: '21:9', width: 1536, height: 640 }
];

// Quality options
const qualityOptions = [
  { label: 'Low', value: 'low', steps: 20 },
  { label: 'Medium', value: 'medium', steps: 30 },
  { label: 'High', value: 'high', steps: 35 }
];

// Edit mode quality options (lower steps = faster)
const editQualityOptions = [
  { label: 'Low', value: 'low', steps: 4 },
  { label: 'Medium', value: 'medium', steps: 8 },
  { label: 'High', value: 'high', steps: 12 }
];

export default function ImageGenerationPage() {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<string | null>('default');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [quality, setQuality] = useState('medium');
  const [loading, setLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [currentImagePrompt, setCurrentImagePrompt] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [pageLoaded, setPageLoaded] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [imageHistory, setImageHistory] = useState<Image[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showAspectRatioDropdown, setShowAspectRatioDropdown] = useState(false);
  const [showQualityDropdown, setShowQualityDropdown] = useState(false);
  const [selectedEditImage, setSelectedEditImage] = useState<Image | null>(null);
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string | null>(null);
  const [editSourceBase64, setEditSourceBase64] = useState<string | null>(null);
  // New: edit mode quality state/dropdown
  const [editQuality, setEditQuality] = useState<'low' | 'medium' | 'high'>('low');
  const [showEditQualityDropdown, setShowEditQualityDropdown] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const isEditingTarget = !!selectedEditImage || !!uploadedPreviewUrl || !!editSourceBase64;
  const selectedAspectRatio = aspectRatios.find(ar => ar.value === aspectRatio)!;
  const selectedQuality = qualityOptions.find(q => q.value === quality)!;
  const selectedStylePreset = stylePresets.find(s => s.id === selectedStyle);
  const selectedEditQuality = editQualityOptions.find(q => q.value === editQuality)!;

  // Load image history on component mount
  useEffect(() => {
    const loadImageHistory = async () => {
      if (user) {
        try {
          const userImages = await pbHelpers.getUserImages(user.id);
          const filteredImages = userImages.filter(image => 
            image.image_file && 
            (image.type === 'generation' || image.type === 'edit' || image.type === 'imported')
          );
          setImageHistory(filteredImages);
        } catch (error) {
          console.error('Error loading image history:', error);
        }
      }
    };

    loadImageHistory();
  }, [user]);

  const getFileUrl = (record: Image, filename: string) => {
    return pb.files.getUrl(record, filename);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);

    // Add user message to chat
    const userMessage = {
      type: 'user' as const,
      content: prompt,
      timestamp: new Date()
    };
    setChatHistory(prev => [...prev, userMessage]);

    try {
      // Build final prompt with style
      const finalPrompt = selectedStylePreset && selectedStylePreset.prompt
        ? `${prompt}, ${selectedStylePreset.prompt}`
        : prompt;

      const response = await fetch('/api/generate/image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: finalPrompt,
          width: selectedAspectRatio.width,
          height: selectedAspectRatio.height,
          num_inference_steps: selectedQuality.steps
        }),
      });

      const data = await response.json();
      if (data.success && data.url) {
        setGeneratedImage(data.url);
        setCurrentImagePrompt(prompt);

        const assistantMessage = {
          type: 'assistant' as const,
          content: `Generated image for: "${prompt}"`,
          imageUrl: data.url,
          timestamp: new Date()
        };
        setChatHistory(prev => [...prev, assistantMessage]);
        
        // Refresh image history from PocketBase
        if (user) {
          try {
            const userImages = await pbHelpers.getUserImages(user.id);
            const filteredImages = userImages.filter(image => 
              image.image_file && 
              (image.type === 'generation' || image.type === 'edit' || image.type === 'imported')
            );
            setImageHistory(filteredImages);
          } catch (error) {
            console.error('Error refreshing image history:', error);
          }
        }
      } else {
        throw new Error(data.error || 'Failed to generate image');
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
      setPrompt(''); // Clear input after generation
    }
  };

  // New: handle image editing flow
  const handleEdit = async () => {
    if (!prompt.trim() || (!selectedEditImage && !editSourceBase64)) return;

    setLoading(true);
    setError(null);

    // Add user message to chat
    const userMessage = {
      type: 'user' as const,
      content: prompt,
      timestamp: new Date()
    };
    setChatHistory(prev => [...prev, userMessage]);

    try {
      // Build final prompt with style
      const finalPrompt = selectedStylePreset && selectedStylePreset.prompt
        ? `${prompt}, ${selectedStylePreset.prompt}`
        : prompt;

      // Ensure pb_auth cookie is set for the API route (server reads cookies)
      try {
        const cookieStr = pb.authStore.exportToCookie({
          httpOnly: false,
          secure: false,
          sameSite: 'lax'
        });
        document.cookie = cookieStr;
      } catch (e) {
        console.warn('Could not set auth cookie:', e);
      }

      let sourceImageBase64: string;
      if (selectedEditImage) {
        // Convert PocketBase image to base64
        const imageUrl = getFileUrl(selectedEditImage, selectedEditImage.image_file);
        const resp = await fetch(imageUrl);
        if (!resp.ok) throw new Error(`Failed to load image (${resp.status})`);
        const blob = await resp.blob();
        sourceImageBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        // Use the already converted base64
        sourceImageBase64 = editSourceBase64!;
      }

      const response = await fetch('/api/edit/image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${pb.authStore.token}`
        },
        body: JSON.stringify({
          prompt: finalPrompt,
          image: sourceImageBase64,
          steps: selectedEditQuality.steps
        }),
      });

      const data = await response.json();
      if (data.success && data.url) {
        setGeneratedImage(data.url);

        const assistantMessage = {
          type: 'assistant' as const,
          content: `Edited image for: "${prompt}"`,
          imageUrl: data.url,
          timestamp: new Date()
        };
        setChatHistory(prev => [...prev, assistantMessage]);

        // Refresh image history from PocketBase
        if (user) {
          try {
            const userImages = await pbHelpers.getUserImages(user.id);
            const filteredImages = userImages.filter(image => 
              image.image_file && 
              (image.type === 'generation' || image.type === 'edit' || image.type === 'imported')
            );
            setImageHistory(filteredImages);
          } catch (error) {
            console.error('Error refreshing image history:', error);
          }
        }

        // Exit edit mode after a successful edit
        setSelectedEditImage(null);
        setEditSourceBase64(null);
        setUploadedPreviewUrl(null);
      } else {
        throw new Error(data.error || 'Failed to edit image');
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
      setPrompt(''); // Clear input after edit
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      selectedEditImage || editSourceBase64 ? handleEdit() : handleGenerate();
    }
  };

  // Upload handler: import image to PocketBase and select for editing
  const handleUploadFile = async (file: File) => {
    if (!user) {
      setError('Please sign in to upload images');
      return;
    }
    if (!file || !file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }

    try {
      setError(null);
      // Show immediate local preview
      const objectUrl = URL.createObjectURL(file);
      setUploadedPreviewUrl(objectUrl);
      setSelectedEditImage(null);
      setEditSourceBase64(null);

      // Save to PocketBase as imported
      const record = await pbHelpers.saveImage(user.id, prompt || 'Imported image', file, 'imported');

      // Update history and select for editing
      setImageHistory(prev => [
        ...prev,
        record
      ]);
      setSelectedEditImage(record);
      // Clear local preview (we'll use PB URL now)
      URL.revokeObjectURL(objectUrl);
      setUploadedPreviewUrl(null);
    } catch (e: any) {
      console.error('Upload failed', e);
      setError(e?.message || 'Failed to upload image');
      setUploadedPreviewUrl(null);
    }
  };

  const handleUploadInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleUploadFile(file);
      // Reset input value to allow re-upload of same file if needed
      e.currentTarget.value = '';
    }
  };

  // Start edit from a URL (e.g., center generated image)
  const startEditFromUrl = async (url: string) => {
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Failed to load image (${resp.status})`);
      const blob = await resp.blob();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      setEditSourceBase64(base64);
      setUploadedPreviewUrl(url);
      setSelectedEditImage(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to prepare image for editing');
    }
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Check if click is outside dropdown containers
      const aspectRatioDropdown = target.closest('[data-dropdown="aspect-ratio"]');
      const qualityDropdown = target.closest('[data-dropdown="quality"]');
      
      if (!aspectRatioDropdown) {
        setShowAspectRatioDropdown(false);
      }
      if (!qualityDropdown) {
        setShowQualityDropdown(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Page load animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setPageLoaded(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <PageTemplate>
      <div className={`flex flex-col transition-all duration-700 ease-out ${pageLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ height: 'calc(100vh - 120px)' }}>
        {/* Header */}
        <div className="flex-shrink-0 pb-4">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <ImageIcon className="h-6 w-6 text-emerald-400" />
            Image Generation
          </h1>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Generated Image Display - Takes majority of screen */}
           <div className="flex-1 px-6 py-4 flex items-center justify-center" style={{ height: isEditingTarget ? 'calc(100vh - 200px)' : 'calc(100vh - 300px)' }}>
            {(generatedImage || isEditingTarget) ? (
              <div className="relative w-full h-full group cursor-pointer" onClick={() => setIsFullscreen(true)}>
                {/* Main image */}
                <img 
                  src={selectedEditImage ? getFileUrl(selectedEditImage, selectedEditImage.image_file) : (uploadedPreviewUrl || generatedImage!)} 
                  alt="Current image"
                  className={`w-full h-full object-contain rounded-lg shadow-2xl transition-transform group-hover:scale-[1.02] ${isEditingTarget ? 'blur-sm' : ''} ${loading && isEditingTarget ? 'blur-md' : ''}`}
                />

                {/* Edit Mode badge */}
                {isEditingTarget && (
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-emerald-400/20 border border-emerald-400/40 text-emerald-200 text-xs font-medium backdrop-blur-md shadow-lg">
                    Edit Mode
                  </div>
                )}

                {/* Top-right actions */}
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button
                     onClick={(e) => {
                       e.stopPropagation();
                       setIsFullscreen(true);
                     }}
                     className="p-2 rounded-lg backdrop-blur-sm bg-black/50 hover:bg-black/70 text-white transition-colors"
                     title="Fullscreen"
                   >
                     <Maximize2 className="h-4 w-4" />
                   </button>
                  {generatedImage && !isEditingTarget && (
                     <button
                       onClick={(e) => { e.stopPropagation(); startEditFromUrl(generatedImage); }}
                       className="p-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white backdrop-blur-md transition-colors"
                       title="Edit"
                     >
                       <Pencil className="h-4 w-4" />
                     </button>
                   )}
                  {isEditingTarget && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedEditImage(null); setUploadedPreviewUrl(null); setEditSourceBase64(null); setError(null); }}
                      className="p-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white backdrop-blur-md transition-colors"
                      title="Cancel"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                   <a 
                     href={generatedImage || (selectedEditImage ? getFileUrl(selectedEditImage, selectedEditImage.image_file) : uploadedPreviewUrl!)} 
                     download 
                     onClick={(e) => e.stopPropagation()}
                     className="p-2 rounded-lg backdrop-blur-sm bg-black/50 hover:bg-black/70 text-white transition-colors"
                     title="Download"
                   >
                     <Download className="h-4 w-4" />
                   </a>
                 </div>

                {/* Loading overlay when editing */}
                {loading && isEditingTarget && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 backdrop-blur-sm rounded-lg">
                    <RefreshCw className="h-7 w-7 animate-spin text-white" />
                    <span className="mt-2 text-white/80 text-sm">Applying edits...</span>
                  </div>
                )}

                {/* Image prompt display with blur effect - hidden in edit mode */}
                {(generatedImage || selectedEditImage) && !isEditingTarget && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 max-w-[80%] bg-black/40 backdrop-blur-md border border-white/20 rounded-lg px-4 py-2 text-center">
                    <p className="text-white/90 text-sm truncate">
                      {selectedEditImage ? selectedEditImage.prompt : currentImagePrompt || 'Generated image'}
                    </p>
                  </div>
                )}

                {/* Floating glass prompt box for edit mode */}
                {isEditingTarget && (
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    className="absolute left-1/2 -translate-x-1/2 bottom-8 w-[min(800px,92%)] bg-white/10 border border-white/20 rounded-full p-2 backdrop-blur-xl shadow-2xl flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Describe how to edit the selected image..."
                      className="flex-1 bg-transparent px-4 py-2.5 text-white placeholder-white/60 focus:outline-none"
                    />
                    {/* Edit quality dropdown */}
                    <div className="relative" data-dropdown="edit-quality">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowEditQualityDropdown(!showEditQualityDropdown);
                        }}
                        className="bg-white/10 border border-white/20 rounded-full px-3 py-2 text-sm text-white cursor-pointer hover:bg-white/20 transition-colors flex items-center gap-2 min-w-[80px]"
                      >
                        <span>{selectedEditQuality.label}</span>
                        <svg className={`w-3 h-3 text-white/50 transition-transform ${showEditQualityDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {showEditQualityDropdown && (
                        <div className="absolute bottom-full mb-1 right-0 bg-gray-900/95 backdrop-blur-sm border border-white/20 rounded-xl py-2 min-w-[120px] z-50">
                          {editQualityOptions.map((q) => (
                            <button
                              key={q.value}
                              onClick={() => {
                                setEditQuality(q.value as 'low' | 'medium' | 'high');
                                setShowEditQualityDropdown(false);
                              }}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-white/10 transition-colors flex items-center justify-between ${
                                editQuality === q.value ? 'text-emerald-400 bg-emerald-400/10' : 'text-white'
                              }`}
                            >
                              <span>{q.label}</span>
                              <span className="text-xs text-white/50">{q.steps} steps</span>
                            </button>
                          ))}
                          <div className="px-3 pt-1 text-[11px] text-white/50">Lower quality is faster</div>
                        </div>
                      )}
                    </div>
                    {/* Cancel Edit button (inline) */}
                    <button
                      onClick={() => { setSelectedEditImage(null); setUploadedPreviewUrl(null); setEditSourceBase64(null); setError(null); }}
                      className="px-3 py-2 flex items-center gap-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white transition"
                      title="Cancel edit"
                    >
                      <X className="h-4 w-4" />
                      Cancel
                    </button>
                    <button
                      onClick={handleEdit}
                      disabled={loading || !prompt.trim()}
                      className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white px-5 py-2.5 rounded-full font-medium transition-colors disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {loading ? (<><RefreshCw className="h-4 w-4 animate-spin" /> Editing</>) : (<><Sparkles className="h-4 w-4" /> Apply Edit</>)}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-white/50">
                {/* Upload zone */}
                <div className="mb-6 flex items-center justify-center">
                  <div 
                    className="border-2 border-dashed border-white/20 rounded-lg flex items-center justify-center bg-white/5"
                    style={{
                      width: `${Math.min(400, 400 * (selectedAspectRatio.width / Math.max(selectedAspectRatio.width, selectedAspectRatio.height)))}px`,
                      height: `${Math.min(400, 400 * (selectedAspectRatio.height / Math.max(selectedAspectRatio.width, selectedAspectRatio.height)))}px`
                    }}
                  >
                    <div className="text-center">
                      <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-30" />
                      <p className="text-sm text-white/40">{selectedAspectRatio.label}</p>
                      <p className="text-xs text-white/30">{selectedAspectRatio.width}×{selectedAspectRatio.height}</p>
                    </div>
                  </div>
                </div>
                <p className="text-sm mb-4">Enter a prompt below to get started</p>
                {/* Upload zone */}
                <div className="flex flex-col items-center gap-3">
                  <label className="group cursor-pointer w-[min(480px,92%)] rounded-2xl border-2 border-dashed border-white/20 hover:border-emerald-400/60 transition-colors p-6 bg-white/5 hover:bg-white/10 flex flex-col items-center gap-3">
                    <Upload className="h-6 w-6 text-white/70 group-hover:text-emerald-300 transition-colors" />
                    <span className="text-white/80">Click to upload an image</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleUploadInputChange} />
                  </label>
                  <p className="text-emerald-300/90 text-sm animate-pulse">Or upload an image to edit</p>
                </div>
              </div>
            )}
          </div>

          {/* Generation History Sidebar */}
           <div className="w-80 border-l border-white/10 px-4 py-2 overflow-y-auto">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-emerald-400" />
              <h3 className="font-semibold">History</h3>
            </div>
            
            <div className="space-y-3">
              {imageHistory.length === 0 ? (
                <div className="text-center text-white/40 text-sm mt-8">
                  <p>Generation history will appear here</p>
                </div>
              ) : (
                imageHistory.slice().reverse().map((image) => (
                  <div key={image.id} className="group relative cursor-pointer">
                    <img 
                      src={getFileUrl(image, image.image_file)} 
                      alt={image.prompt} 
                      className="w-full aspect-square object-cover rounded-lg border border-white/10 group-hover:border-emerald-400/50 transition-all group-hover:scale-105"
                      style={{ maxHeight: '200px' }}
                      onClick={() => {
                        setGeneratedImage(getFileUrl(image, image.image_file));
                        setCurrentImagePrompt(image.prompt);
                      }}
                    />
                    {/* Hover overlay with edit button */}
                    <div className="absolute inset-0 rounded-lg pointer-events-none"></div>
                    <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="p-2 rounded-full bg-white/15 border border-white/25 text-white hover:bg-white/25"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEditImage(image);
                        }}
                        title="Edit this image"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-xs text-white/60 mt-1 truncate">{image.prompt}</p>
                    <p className="text-xs text-white/40 mt-0.5">{new Date(image.created).toLocaleDateString()}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Input Area - Only show when not in edit mode */}
          <div className="flex-shrink-0 space-y-3 pb-4">
            {/* Style Selection */}
            {!isEditingTarget && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-white/70 whitespace-nowrap">Style:</span>
              <div className="flex gap-2 overflow-x-auto">
                {stylePresets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => setSelectedStyle(preset.id)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                      selectedStyle === preset.id 
                        ? 'bg-emerald-400/20 text-emerald-400 border border-emerald-400/50' 
                        : 'bg-white/5 text-white/70 border border-white/20 hover:bg-white/10'
                    }`}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
            )}

            {/* Main Input Row - Hide when in edit mode */}
           {!isEditingTarget && (
             <div className="relative">
               {error && (
                 <div className="absolute -top-10 left-0 right-0 text-red-400 text-sm p-2 bg-red-400/10 border border-red-400/20 rounded-lg">
                   {error}
                 </div>
               )}
               <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-full p-1.5 flex items-center gap-2">
                 {/* Text Input */}
                 <input
                   type="text"
                   value={prompt}
                   onChange={(e) => setPrompt(e.target.value)}
                   onKeyPress={handleKeyPress}
                   placeholder={selectedEditImage ? "Describe how to edit the selected image..." : "Describe the image you want to generate..."}
                   className="flex-1 bg-transparent px-4 py-2.5 text-white placeholder-white/50 focus:outline-none"
                 />
                
                 {/* Aspect Ratio Dropdown */}
                 <div className="relative" data-dropdown="aspect-ratio">
                   <button
                     onClick={(e) => {
                       e.stopPropagation();
                       setShowAspectRatioDropdown(!showAspectRatioDropdown);
                       setShowQualityDropdown(false);
                     }}
                     className="bg-white/10 border border-white/20 rounded-full px-3 py-2 text-sm text-white cursor-pointer hover:bg-white/20 transition-colors flex items-center gap-2 min-w-[80px]"
                   >
                     <span>{selectedAspectRatio.label}</span>
                     <svg className={`w-3 h-3 text-white/50 transition-transform ${showAspectRatioDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                     </svg>
                   </button>
                   {showAspectRatioDropdown && (
                      <div className="absolute bottom-full mb-1 right-0 bg-gray-900/95 backdrop-blur-sm border border-white/20 rounded-xl py-2 min-w-[120px] z-50">
                       {aspectRatios.map((ar) => (
                         <button
                           key={ar.value}
                           onClick={() => {
                             setAspectRatio(ar.value);
                             setShowAspectRatioDropdown(false);
                           }}
                           className={`w-full text-left px-3 py-2 text-sm hover:bg-white/10 transition-colors flex items-center justify-between ${
                             aspectRatio === ar.value ? 'text-emerald-400 bg-emerald-400/10' : 'text-white'
                           }`}
                         >
                           <span>{ar.label}</span>
                           <span className="text-xs text-white/50">{ar.width}×{ar.height}</span>
                         </button>
                       ))}
                     </div>
                   )}
                 </div>

                 {/* Quality Dropdown */}
                 <div className="relative" data-dropdown="quality">
                   <button
                     onClick={(e) => {
                       e.stopPropagation();
                       setShowQualityDropdown(!showQualityDropdown);
                       setShowAspectRatioDropdown(false);
                     }}
                     className="bg-white/10 border border-white/20 rounded-full px-3 py-2 text-sm text-white cursor-pointer hover:bg-white/20 transition-colors flex items-center gap-2 min-w-[80px]"
                   >
                     <span>{selectedQuality.label}</span>
                     <svg className={`w-3 h-3 text-white/50 transition-transform ${showQualityDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                     </svg>
                   </button>
                   {showQualityDropdown && (
                      <div className="absolute bottom-full mb-1 right-0 bg-gray-900/95 backdrop-blur-sm border border-white/20 rounded-xl py-2 min-w-[100px] z-50">
                       {qualityOptions.map((q) => (
                         <button
                           key={q.value}
                           onClick={() => {
                             setQuality(q.value);
                             setShowQualityDropdown(false);
                           }}
                           className={`w-full text-left px-3 py-2 text-sm hover:bg-white/10 transition-colors flex items-center justify-between ${
                             quality === q.value ? 'text-emerald-400 bg-emerald-400/10' : 'text-white'
                           }`}
                         >
                           <span>{q.label}</span>
                           <span className="text-xs text-white/50">{q.steps} steps</span>
                         </button>
                       ))}
                     </div>
                   )}
                 </div>

                 {/* Generate/Edit Button */}
                 <button
                   onClick={selectedEditImage || editSourceBase64 ? handleEdit : handleGenerate}
                   disabled={loading || !prompt.trim()}
                   className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white px-5 py-2.5 rounded-full font-medium transition-colors disabled:cursor-not-allowed flex items-center gap-2"
                 >
                   {loading ? (
                     <>
                       <RefreshCw className="h-4 w-4 animate-spin" />
                       {selectedEditImage || editSourceBase64 ? 'Editing' : 'Generating'}
                     </>
                   ) : (
                     <>
                       <Sparkles className="h-4 w-4" />
                       {selectedEditImage || editSourceBase64 ? 'Apply Edit' : 'Generate'}
                     </>
                   )}
                 </button>
            </div>

            {error && (
               <div className="absolute -top-10 left-0 right-0 text-red-400 text-sm p-2 bg-red-400/10 border border-red-400/20 rounded-lg">
                 {error}
               </div>
             )}
          </div>
        )}
        </div>

        {/* Enhanced Fullscreen Modal */}
        {isFullscreen && generatedImage && (
          <div 
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center overflow-hidden"
            onClick={() => {
              setIsFullscreen(false);
              setZoomLevel(1);
              setImagePosition({ x: 0, y: 0 });
            }}
          >
            <div 
              className="relative w-full h-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Image Container */}
              <div 
                className="relative overflow-hidden cursor-grab active:cursor-grabbing"
                style={{
                  transform: `scale(${zoomLevel}) translate(${imagePosition.x}px, ${imagePosition.y}px)`,
                  transition: isDragging ? 'none' : 'transform 0.2s ease-out'
                }}
                onMouseDown={(e) => {
                  if (zoomLevel > 1) {
                    setIsDragging(true);
                    setDragStart({ x: e.clientX - imagePosition.x, y: e.clientY - imagePosition.y });
                  }
                }}
                onMouseMove={(e) => {
                  if (isDragging && zoomLevel > 1) {
                    setImagePosition({
                      x: e.clientX - dragStart.x,
                      y: e.clientY - dragStart.y
                    });
                  }
                }}
                onMouseUp={() => setIsDragging(false)}
                onMouseLeave={() => setIsDragging(false)}
              >
                <img 
                  src={generatedImage} 
                  alt="Generated image fullscreen" 
                  className="max-w-[90vw] max-h-[90vh] object-contain select-none"
                  draggable={false}
                  onWheel={(e) => {
                    e.preventDefault();
                    const delta = e.deltaY > 0 ? -0.1 : 0.1;
                    const newZoom = Math.max(0.5, Math.min(3, zoomLevel + delta));
                    setZoomLevel(newZoom);
                    if (newZoom === 1) {
                      setImagePosition({ x: 0, y: 0 });
                    }
                  }}
                />
              </div>

              {/* Control Buttons */}
              <div className="absolute top-4 right-4 flex gap-2">
                <button
                  onClick={() => setIsFullscreen(false)}
                  className="bg-black/60 hover:bg-black/80 text-white p-3 rounded-full backdrop-blur-sm transition-colors"
                  title="Close fullscreen"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="absolute top-4 left-4">
                <a 
                  href={generatedImage} 
                  download 
                  className="p-3 rounded-full backdrop-blur-sm bg-black/60 hover:bg-black/80 text-white transition-colors"
                  title="Download"
                >
                  <Download className="h-5 w-5" />
                </a>
              </div>

              {/* Zoom Controls */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-4 py-2">
                <button
                  onClick={() => {
                    const newZoom = Math.max(0.5, zoomLevel - 0.2);
                    setZoomLevel(newZoom);
                    if (newZoom === 1) setImagePosition({ x: 0, y: 0 });
                  }}
                  className="text-white hover:text-emerald-400 transition-colors p-1"
                  title="Zoom out"
                >
                  <span className="text-lg font-bold">−</span>
                </button>
                <span className="text-white text-sm min-w-[60px] text-center">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  onClick={() => setZoomLevel(Math.min(3, zoomLevel + 0.2))}
                  className="text-white hover:text-emerald-400 transition-colors p-1"
                  title="Zoom in"
                >
                  <span className="text-lg font-bold">+</span>
                </button>
                <div className="w-px h-4 bg-white/30 mx-1"></div>
                <button
                  onClick={() => {
                    setZoomLevel(1);
                    setImagePosition({ x: 0, y: 0 });
                  }}
                  className="text-white hover:text-emerald-400 transition-colors text-sm px-2"
                  title="Reset zoom"
                >
                  Reset
                </button>
              </div>

              {/* Instructions */}
              <div className="absolute bottom-4 right-4 text-white/60 text-sm bg-black/40 backdrop-blur-sm rounded-lg px-3 py-2">
                <p>Scroll to zoom • Drag to pan • Click outside to close</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTemplate>
  );
}