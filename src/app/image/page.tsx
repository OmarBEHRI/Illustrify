'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Download, RefreshCw, Image as ImageIcon, Settings, X, Maximize2 } from 'lucide-react';
import PageTemplate from '@/components/PageTemplate';
import { useAuth } from '@/contexts/AuthContext';

interface ChatMessage {
  type: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
  timestamp: Date;
}

// Style presets with image references
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

// Aspect ratio options with calculated dimensions
const aspectRatios = [
  { label: '1:1', value: '1:1', width: 1024, height: 1024 },
  { label: '16:9', value: '16:9', width: 1344, height: 768 },
  { label: '9:16', value: '9:16', width: 768, height: 1344 },
  { label: '4:3', value: '4:3', width: 1152, height: 896 },
  { label: '3:4', value: '3:4', width: 896, height: 1152 },
  { label: '21:9', value: '21:9', width: 1536, height: 640 }
];

// Quality options with step counts
const qualityOptions = [
  { label: 'Low', value: 'low', steps: 20 },
  { label: 'Medium', value: 'medium', steps: 30 },
  { label: 'High', value: 'high', steps: 35 }
];

export default function ImageGenerationPage() {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<string | null>('default');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [quality, setQuality] = useState('medium');
  const [loading, setLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showAspectRatioDropdown, setShowAspectRatioDropdown] = useState(false);
  const [showQualityDropdown, setShowQualityDropdown] = useState(false);

  const selectedAspectRatio = aspectRatios.find(ar => ar.value === aspectRatio)!;
  const selectedQuality = qualityOptions.find(q => q.value === quality)!;
  const selectedStylePreset = stylePresets.find(s => s.id === selectedStyle);

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: finalPrompt,
          steps: selectedQuality.steps,
          width: selectedAspectRatio.width,
          height: selectedAspectRatio.height
        })
      });

      const data = await response.json();

      if (data.success && data.url) {
        setGeneratedImage(data.url);
        
        // Add assistant response to chat
        const assistantMessage = {
          type: 'assistant' as const,
          content: `Generated image for: "${prompt}"`,
          imageUrl: data.url,
          timestamp: new Date()
        };
        setChatHistory(prev => [...prev, assistantMessage]);
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
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

  return (
    <PageTemplate>
      <div className="flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
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
           <div className="flex-1 px-6 py-4 flex items-center justify-center" style={{ height: 'calc(100vh - 300px)' }}>
            {generatedImage ? (
              <div className="relative w-full h-full group cursor-pointer" onClick={() => setIsFullscreen(true)}>
                <img 
                  src={generatedImage} 
                  alt="Generated image" 
                  className="w-full h-full object-contain rounded-lg border border-white/20 shadow-2xl transition-transform group-hover:scale-[1.02]"
                />
                <div className="absolute top-4 right-4 flex gap-2">
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
                    href={generatedImage} 
                    download 
                    onClick={(e) => e.stopPropagation()}
                    className="btn-primary px-3 py-2 flex items-center gap-2 backdrop-blur-sm bg-black/50 hover:bg-black/70"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </a>
                </div>
              </div>
            ) : (
              <div className="text-center text-white/50">
                {/* Aspect Ratio Preview Container */}
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
                <p className="text-xl mb-2">Your generated image will appear here</p>
                <p className="text-sm">Enter a prompt below to get started</p>
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
              {chatHistory.length === 0 ? (
                <div className="text-center text-white/40 text-sm mt-8">
                  <p>Generation history will appear here</p>
                </div>
              ) : (
                chatHistory.slice().reverse().map((message, index) => (
                  message.imageUrl && (
                    <div key={index} className="group cursor-pointer" onClick={() => setGeneratedImage(message.imageUrl!)}>
                      <img 
                        src={message.imageUrl} 
                        alt="Generated image" 
                        className="w-full aspect-square object-cover rounded-lg border border-white/10 group-hover:border-emerald-400/50 transition-all group-hover:scale-105"
                        style={{ maxHeight: '200px' }}
                      />
                      <p className="text-xs text-white/60 mt-1 truncate">{message.content}</p>
                    </div>
                  )
                ))
              )}
            </div>
          </div>
        </div>

        {/* Bottom Controls */}
          <div className="flex-shrink-0 space-y-3 pb-4">
           {/* Style Presets - Horizontal Layout */}
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

           {/* Floating Input Area */}
           <div className="relative">
             <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-full p-1.5 flex items-center gap-2">
              {/* Text Input */}
               <input
                 type="text"
                 value={prompt}
                 onChange={(e) => setPrompt(e.target.value)}
                 onKeyPress={handleKeyPress}
                 placeholder="Describe the image you want to generate..."
                 className="flex-1 bg-transparent px-4 py-2.5 text-white placeholder-white/50 focus:outline-none"
                 disabled={loading}
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

               {/* Generate Button */}
               <button
                 onClick={handleGenerate}
                 disabled={loading || !prompt.trim()}
                 className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white px-5 py-2.5 rounded-full font-medium transition-colors disabled:cursor-not-allowed flex items-center gap-2"
               >
                 {loading ? (
                   <>
                     <RefreshCw className="h-4 w-4 animate-spin" />
                     Generating
                   </>
                 ) : (
                   <>
                     <Sparkles className="h-4 w-4" />
                     Generate
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
        </div>

        {/* Fullscreen Modal */}
        {isFullscreen && generatedImage && (
          <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setIsFullscreen(false)}>
            <div className="relative max-w-[95vw] max-h-[95vh]">
              <img 
                src={generatedImage} 
                alt="Generated image fullscreen" 
                className="max-w-full max-h-full object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />
              <button
                onClick={() => setIsFullscreen(false)}
                className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur-sm transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="absolute top-4 left-4">
                <a 
                  href={generatedImage} 
                  download 
                  className="btn-primary px-3 py-2 flex items-center gap-2 backdrop-blur-sm bg-black/50 hover:bg-black/70"
                >
                  <Download className="h-4 w-4" />
                  Download
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTemplate>
  );
}