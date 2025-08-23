"use client";
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Upload, Youtube, Image, Tv2, FileText, Scissors, Palette, Music, CheckCircle, Clock, Film, Volume2, Video } from 'lucide-react';
import Link from 'next/link';
import PageTemplate from '@/components/PageTemplate';
import { useAuth } from '@/contexts/AuthContext';
import pb from '@/lib/pocketbase';
import SceneSlideshow from '@/components/SceneSlideshow';
type Quality = 'LOW' | 'HIGH' | 'MAX';

type GenerationStep = 'extracting' | 'scenes' | 'images' | 'audio' | 'video' | 'done';

interface GenerationProgress {
  step: GenerationStep;
  progress: number;
  message: string;
  generatedImages?: string[];
  current_scene?: number;
  total_scenes?: number;
  sub_step?: string;
  scene_progress?: {
    current: number;
    total: number;
    status: string;
    scene_id?: string;
    description?: string;
    narration?: string;
    duration?: number;
  };
  assembly_progress?: {
    status: string;
    total_scenes: number;
    current_step: string;
  };
  completed_scenes?: number;
  scenes_ready?: boolean;
  video_ready?: boolean;
  finalVideoUrl?: string;
  timestamp?: string;
}

interface GenerationJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: {
    step: string;
    message: string;
  };
  video_url?: string;
  error?: string;
}

interface Scene {
  id: string;
  scene_number: number;
  description: string;
  narration?: string;
  image_url?: string;
  audio_url?: string;
  video_url?: string;
  status: 'pending' | 'generating' | 'completed' | 'error';
  error?: string;
}

const stylePresets = [
  {
    id: 'anime',
    name: 'Anime',
    prompt: 'anime style, vibrant colors, cel-shaded, Japanese animation',
    image: '/style-presets/anime.jpg'
  },
  {
    id: 'realistic',
    name: 'Realistic',
    prompt: 'photorealistic, high detail, natural lighting, professional photography',
    image: '/style-presets/realistic.jpg'
  },
  {
    id: 'cartoon',
    name: 'Cartoon',
    prompt: 'cartoon style, bold outlines, bright colors, playful and fun',
    image: '/style-presets/cartoon.jpg'
  },
  {
    id: 'watercolor',
    name: 'Watercolor',
    prompt: 'watercolor painting, soft edges, flowing colors, artistic brush strokes',
    image: '/style-presets/watercolor.jpg'
  },
  {
    id: 'oil-painting',
    name: 'Oil Painting',
    prompt: 'oil painting, rich textures, classical art style, museum quality',
    image: '/style-presets/oil-painting.jpg'
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    prompt: 'cyberpunk style, neon colors, futuristic, dark atmosphere, sci-fi',
    image: '/style-presets/cyberpunk.jpg'
  }
];

export default function GeneratePage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'TEXT' | 'PDF' | 'YOUTUBE'>('TEXT');
  const [story, setStory] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [style, setStyle] = useState('anime style, vibrant colors, cel-shaded, Japanese animation');
  const [selectedStylePreset, setSelectedStylePreset] = useState<string | null>('anime');
  const [customStyle, setCustomStyle] = useState('');
  const [quality, setQuality] = useState<Quality>('LOW');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isAssembling, setIsAssembling] = useState(false);
  const [regeneratingSceneId, setRegeneratingSceneId] = useState<string | undefined>();
  const [useSceneGeneration, setUseSceneGeneration] = useState(true);
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null);
  const [ttsEngine, setTtsEngine] = useState<'kokoro' | 'elevenlabs'>('kokoro');
  const [selectedVoice, setSelectedVoice] = useState('af_heart');
  const [showVoiceDropdown, setShowVoiceDropdown] = useState(false);
  const [showGenerationModeDropdown, setShowGenerationModeDropdown] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [availableVoices, setAvailableVoices] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const cost = useMemo(() => quality === 'LOW' ? 0 : quality === 'HIGH' ? 10 : 50, [quality]);

  // Available voice previews (only voices with preview files)
  const availableVoicePreviews = [
    'adam', 'af_alloy', 'af_bella', 'af_heart', 'af_nova', 'af_sarah',
    'am_adam', 'am_echo', 'am_liam', 'am_michael', 'am_onyx', 'bella',
    'charlie', 'charlotte', 'drew', 'rachel'
  ];

  // Fetch available voices when TTS engine changes
  useEffect(() => {
    const fetchVoices = async () => {
      try {
        if (ttsEngine === 'kokoro') {
          const response = await fetch('http://localhost:8880/v1/audio/voices');
          const data = await response.json();
          // Filter voices to only include those with preview files
          const filteredVoices = (data.voices || []).filter((voice: string) => 
            availableVoicePreviews.includes(voice)
          );
          setAvailableVoices(filteredVoices);
          // Set default voice if current selection is not available
          if (!filteredVoices.includes(selectedVoice)) {
            setSelectedVoice(filteredVoices[0] || 'af_heart');
          }
        } else {
          // For Eleven Labs, only include voices with preview files
          const elevenlabsVoices = ['rachel', 'drew', 'charlie', 'charlotte', 'bella', 'adam'];
          setAvailableVoices(elevenlabsVoices);
          setSelectedVoice('rachel');
        }
      } catch (error) {
        console.error('Failed to fetch voices:', error);
        // Fallback to voices with preview files
        setAvailableVoices(['af_heart', 'af_bella', 'am_adam', 'am_michael']);
      }
    };
    fetchVoices();
  }, [ttsEngine]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const voiceDropdown = target.closest('[data-dropdown="voice"]');
      const generationModeDropdown = target.closest('[data-dropdown="generation-mode"]');
      
      if (!voiceDropdown) {
        setShowVoiceDropdown(false);
      }
      if (!generationModeDropdown) {
        setShowGenerationModeDropdown(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }
    };
  }, [currentAudio]);

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
    if (!user) {
      setError('Please sign in to generate videos');
      return;
    }

    if (!story.trim()) {
      setError('Please enter a story');
      return;
    }

    setError(null);
    setLoading(true);
    setVideoUrl(null);
    setGenerationProgress({ step: 'extracting', progress: 0, message: 'Starting generation...', generatedImages: [] });
    setScenes([]);
    
    try {
      const endpoint = useSceneGeneration ? '/api/generate-scenes' : '/api/generate';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${pb.authStore.token}`
        },
        body: JSON.stringify({ 
          story, 
          style, 
          quality,
          ttsEngine,
          voice: selectedVoice
        })
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to start generation');
      }
      
      const data = await res.json();
      setJobId(data.jobId);
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
      setGenerationProgress(null);
    }
  }

  const handleRegenerateScene = async (sceneId: string) => {
    if (!user || !jobId) return;

    setIsRegenerating(true);
    setRegeneratingSceneId(sceneId);
    setError(null);

    try {
      const response = await fetch('/api/regenerate-scene', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${pb.authStore.token}`
        },
        body: JSON.stringify({
          jobId,
          sceneId,
          ttsEngine,
          voice: selectedVoice,
          quality: quality.toLowerCase()
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to regenerate scene');
      }

      // Continue polling for updates
    } catch (error: any) {
      console.error('Scene regeneration failed:', error);
      setError(error.message || 'Failed to regenerate scene');
      setIsRegenerating(false);
      setRegeneratingSceneId(undefined);
    }
  };

  const handleAssembleVideo = async () => {
    if (!user || !jobId) return;

    setIsAssembling(true);
    setError(null);

    try {
      const response = await fetch('/api/assemble-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${pb.authStore.token}`
        },
        body: JSON.stringify({
          jobId
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to assemble video');
      }

      // Continue polling for updates
    } catch (error: any) {
      console.error('Video assembly failed:', error);
      setError(error.message || 'Failed to assemble video');
      setIsAssembling(false);
    }
  };

  useEffect(() => {
    if (!jobId || !user) return;
    
    const t = setInterval(async () => {
      try {
        const endpoint = useSceneGeneration ? `/api/generate-scenes?id=${jobId}` : `/api/generate?id=${jobId}`;
        const res = await fetch(endpoint, {
          headers: {
            'Authorization': `Bearer ${pb.authStore.token}`
          }
        });
        
        if (!res.ok) return;
        const data = await res.json();

        // Update progress based on API response
        if (data.progress) {
          const progressData = data.progress;
          setGenerationProgress(progressData);
          
          // Handle video assembly completion
          if (progressData.video_ready && progressData.finalVideoUrl) {
            setVideoUrl(progressData.finalVideoUrl);
            setIsAssembling(false);
          }
        }

        // Update scenes if using scene generation
        if (useSceneGeneration && data.scenes) {
          setScenes(data.scenes);
        }

        // Update regeneration state based on progress
        if ((data.progress?.scene_progress?.status === 'completed' || 
             data.progress?.scene_progress?.status === 'regeneration_completed') && isRegenerating) {
          setIsRegenerating(false);
          setRegeneratingSceneId(undefined);
        }

        // Update assembly state based on progress
        if (data.progress?.assembly_progress?.status === 'preparing' && !isAssembling) {
          setIsAssembling(true);
        }

        if (data.status === 'completed') {
          // Check if this is scene generation completion or final video completion
          if (data.progress?.video_ready && data.progress?.finalVideoUrl) {
            // Final video is ready
            setVideoUrl(data.progress.finalVideoUrl);
            setGenerationProgress({ 
              step: 'done', 
              progress: 100, 
              message: 'Video assembled successfully!', 
              generatedImages: data.progress?.generatedImages || [],
              video_ready: true,
              finalVideoUrl: data.progress.finalVideoUrl
            });
          } else if (data.progress?.scenes_ready) {
            // Scenes are ready, but video not assembled yet
            setGenerationProgress({ 
              step: 'done', 
              progress: 100, 
              message: 'All scenes generated! Ready for video assembly.', 
              generatedImages: data.progress?.generatedImages || [],
              scenes_ready: true
            });
          } else {
            // Fallback for other completion types
            setVideoUrl(data.url || data.video_url);
            setGenerationProgress({ 
              step: 'done', 
              progress: 100, 
              message: 'Video generated successfully!', 
              generatedImages: data.progress?.generatedImages || [] 
            });
          }
          
          setLoading(false);
          setIsRegenerating(false);
          setIsAssembling(false);
          setRegeneratingSceneId(undefined);
          
          // Only clear interval if final video is ready or not using scene generation
          if (!useSceneGeneration || data.progress?.video_ready) {
            clearInterval(t);
          }
        }
        
        if (data.status === 'failed') {
          setError(data.error || 'Generation failed');
          setLoading(false);
          setIsRegenerating(false);
          setIsAssembling(false);
          setRegeneratingSceneId(undefined);
          setGenerationProgress(null);
          clearInterval(t);
        }
      } catch (error) {
        console.error('Error polling job status:', error);
      }
    }, 2000); // Poll every 2 seconds to reduce server load
    
    return () => clearInterval(t);
  }, [jobId, user]);

  return (
    <PageTemplate>
      <div className="min-h-[calc(100vh-8rem)] flex flex-col">
        {/* Compact Progress UI - Always visible when loading, hidden when video is ready */}
        {loading && generationProgress && !generationProgress.video_ready && (
          <div className="mb-4">
            <CompactProgressUI progress={generationProgress} useSceneGeneration={useSceneGeneration} />
          </div>
        )}
        
        <div className="flex-1 space-y-4">
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          {/* Left controls */}
          <div className="space-y-4">
            {/* Input Selection */}
            <div className="card space-y-3 animate-in fade-in slide-in-from-left-4 duration-500">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-medium text-white">Input Source</h3>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <button className={`btn text-xs ${tab === 'TEXT' ? 'bg-white/15 border border-white/20' : ''}`} onClick={() => setTab('TEXT')}>Story</button>
                <button className={`btn text-xs ${tab === 'PDF' ? 'bg-white/15 border border-white/20' : ''}`} onClick={() => setTab('PDF')}>PDF</button>
                <button className={`btn text-xs ${tab === 'YOUTUBE' ? 'bg-white/15 border border-white/20' : ''}`} onClick={() => setTab('YOUTUBE')}>YouTube</button>
              </div>

              {tab === 'TEXT' && (
                <textarea className="input h-48 resize-none text-sm" placeholder="Write or paste your story..." value={story} onChange={(e) => setStory(e.target.value)} />
              )}
              {tab === 'PDF' && (
                <div>
                  <input type="file" accept=".pdf" className="hidden" ref={inputRef} onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) { setFile(f); handleUploadPdf(f).catch(() => setError('Could not read PDF')); }
                  }} />
                  <div
                    className="border-2 border-dashed border-white/20 rounded-xl p-6 text-center cursor-pointer hover:border-white/30 transition-colors"
                    onClick={() => inputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const f = e.dataTransfer.files?.[0];
                      if (f && f.type === 'application/pdf') {
                        setFile(f);
                        handleUploadPdf(f).catch(() => setError('Could not read PDF'));
                      }
                    }}
                  >
                    <Upload className="h-6 w-6 mx-auto mb-2 text-white/50" />
                    <p className="text-white/70 text-sm mb-1">Drop PDF or click to browse</p>
                    <p className="text-xs text-white/50">PDF files only</p>
                    {file && <p className="text-xs text-emerald-400 mt-2 font-medium">{file.name}</p>}
                  </div>
                </div>
              )}
              {tab === 'YOUTUBE' && (
                <div className="space-y-2">
                  <input className="input text-sm" placeholder="YouTube URL..." value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} />
                  <button className="btn-primary w-full inline-flex items-center justify-center gap-2 text-sm" onClick={() => handleExtractYoutube(youtubeUrl).catch(() => setError('Could not extract from YouTube'))} disabled={!youtubeUrl.trim()}>
                    <Youtube className="h-4 w-4" /> Extract
                  </button>
                </div>
              )}
            </div>

            {/* Audio Settings */}
            <div className="card space-y-3 animate-in fade-in slide-in-from-left-4 duration-500 delay-100">
              <div className="flex items-center gap-2 mb-2">
                <Music className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-medium text-white">Audio Settings</h3>
              </div>
              
              <div>
                <label className="text-sm text-white/70 mb-2 block">Text-to-Speech Engine</label>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    className={`btn text-xs transition-all duration-200 ${ttsEngine === 'kokoro' ? 'bg-emerald-400/90 text-emerald-950 shadow-lg shadow-emerald-400/20' : 'bg-white/10 text-white border border-white/20 hover:bg-white/15'}`} 
                    onClick={() => setTtsEngine('kokoro')}
                  >
                    🏠 Local Kokoro
                  </button>
                  <button 
                    className={`btn text-xs transition-all duration-200 ${ttsEngine === 'elevenlabs' ? 'bg-emerald-400/90 text-emerald-950 shadow-lg shadow-emerald-400/20' : 'bg-white/10 text-white border border-white/20 hover:bg-white/15'}`} 
                    onClick={() => setTtsEngine('elevenlabs')}
                  >
                    ☁️ Eleven Labs
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm text-white/70 mb-2 block">Voice Selection</label>
                <div className="relative" data-dropdown="voice">
                  <button
                    onClick={() => setShowVoiceDropdown(!showVoiceDropdown)}
                    className="w-full p-3 rounded-lg border border-white/20 bg-white/5 text-white hover:bg-white/10 hover:border-white/30 transition-all duration-200 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">
                        {selectedVoice.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                      <span className="text-xs text-white/60">
                        {selectedVoice.startsWith('af_') ? 'Female' : selectedVoice.startsWith('am_') ? 'Male' : 
                         ['rachel', 'bella', 'charlotte', 'af_sarah', 'af_nova', 'af_alloy'].includes(selectedVoice) ? 'Female' : 'Male'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                         onClick={(e) => {
                           e.stopPropagation();
                           if (currentAudio) {
                             currentAudio.pause();
                             currentAudio.currentTime = 0;
                           }
                           const audio = new Audio(`/voice-previews/${selectedVoice}.wav`);
                           setCurrentAudio(audio);
                           audio.play().catch(console.error);
                         }}
                         className="p-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
                         title="Play preview"
                       >
                         <Volume2 className="w-3 h-3" />
                       </div>
                      <svg className={`w-4 h-4 transition-transform ${showVoiceDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                  
                  {showVoiceDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900/95 border border-white/20 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                      {availableVoices.map(voice => (
                        <div
                          key={voice}
                          onClick={() => {
                            setSelectedVoice(voice);
                            setShowVoiceDropdown(false);
                          }}
                          className={`p-3 border-b border-white/10 last:border-b-0 cursor-pointer transition-all duration-200 ${
                            selectedVoice === voice
                              ? 'bg-emerald-400/20 text-emerald-400'
                              : 'text-white hover:bg-white/10'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-sm font-medium block">
                                {voice.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </span>
                              <span className="text-xs text-white/60">
                                {voice.startsWith('af_') ? 'Female' : voice.startsWith('am_') ? 'Male' : 
                                 ['rachel', 'bella', 'charlotte', 'af_sarah', 'af_nova', 'af_alloy'].includes(voice) ? 'Female' : 'Male'}
                              </span>
                            </div>
                            <div
                               onClick={(e) => {
                                 e.stopPropagation();
                                 if (currentAudio) {
                                   currentAudio.pause();
                                   currentAudio.currentTime = 0;
                                 }
                                 const audio = new Audio(`/voice-previews/${voice}.wav`);
                                 setCurrentAudio(audio);
                                 audio.play().catch(console.error);
                               }}
                               className="p-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
                               title="Play preview"
                             >
                               <Volume2 className="w-3 h-3" />
                             </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <div className={`w-2 h-2 rounded-full ${ttsEngine === 'kokoro' ? 'bg-green-400' : 'bg-blue-400'}`}></div>
                  <p className="text-xs text-white/60">
                    {ttsEngine === 'kokoro' ? 'Local TTS - No additional cost' : 'Cloud TTS - May incur additional charges'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Middle preview container */}
          <div className="lg:col-span-1 order-first lg:order-none">
            {/* Show final video if it's ready, regardless of scene generation mode */}
            {videoUrl || (generationProgress?.video_ready && generationProgress?.finalVideoUrl) ? (
              <div className="card h-[400px] flex items-center justify-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                <video controls className="w-full h-full object-cover rounded-xl border border-white/15">
                  <source src={videoUrl || generationProgress?.finalVideoUrl} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>
            ) : useSceneGeneration && scenes.length > 0 ? (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <SceneSlideshow
                  jobId={jobId || ''}
                  scenes={scenes}
                  onRegenerateScene={handleRegenerateScene}
                  onAssembleVideo={handleAssembleVideo}
                  isRegenerating={isRegenerating}
                  isAssembling={isAssembling}
                  regeneratingSceneId={regeneratingSceneId}
                  progressData={generationProgress}
                />
              </div>
            ) : (
              <div className="card h-[400px] flex items-center justify-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="text-center text-white/70">
                  <Tv2 className="mx-auto h-10 w-10 mb-3" />
                  <p className="text-sm">Your video will appear here</p>
                </div>
              </div>
            )}
          </div>

          {/* Right controls */}
          <div className="card space-y-3 animate-in fade-in slide-in-from-right-4 duration-500">

            <div>
              <label className="text-sm text-white/70 mb-2 block">Visual style</label>
              <div className="grid grid-cols-4 gap-1.5">
                {stylePresets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      setSelectedStylePreset(preset.id);
                      setStyle(preset.prompt);
                    }}
                    className={`relative overflow-hidden rounded-md border-2 transition-all aspect-square ${selectedStylePreset === preset.id
                      ? 'border-emerald-400 bg-emerald-400/10'
                      : 'border-white/20 hover:border-white/40'
                      }`}
                  >
                    <StylePresetImage preset={preset} />
                    <div className="absolute bottom-0 left-0 right-0 p-0.5 bg-gradient-to-t from-black/90 to-transparent">
                      <p className="text-[8px] text-white font-medium leading-tight">{preset.name}</p>
                    </div>
                  </button>
                ))}
                <button
                  onClick={() => {
                    setSelectedStylePreset('other');
                    setStyle(customStyle);
                  }}
                  className={`relative overflow-hidden rounded-md border-2 transition-all flex flex-col items-center justify-center aspect-square ${selectedStylePreset === 'other'
                    ? 'border-emerald-400 bg-emerald-400/10'
                    : 'border-white/20 hover:border-white/40'
                    }`}
                >
                  <div className="text-sm mb-0.5">✏️</div>
                  <p className="text-[8px] text-white font-medium">Other</p>
                </button>
              </div>
              {selectedStylePreset === 'other' && (
                <textarea
                  className="input mt-2 h-12 resize-none text-xs"
                  placeholder="Describe your custom style..."
                  value={customStyle}
                  onChange={(e) => {
                    setCustomStyle(e.target.value);
                    setStyle(e.target.value);
                  }}
                />
              )}
            </div>

            <div>
              <label className="text-sm text-white/70 mb-2 block">Quality</label>
              <div className="grid grid-cols-3 gap-2">
                {(['LOW', 'HIGH', 'MAX'] as Quality[]).map(q => (
                  <button key={q} className={`btn text-xs ${quality === q ? 'bg-emerald-400/90 text-emerald-950' : 'bg-white/10 text-white border border-white/20'}`} onClick={() => setQuality(q)}>
                    {q}
                  </button>
                ))}
              </div>
              <p className="text-xs text-white/70 mt-1">Cost: {cost} credits</p>
            </div>

            {error && <p className="text-xs text-red-300">{error}</p>}
            {videoUrl && (
              <div className="flex gap-2">
                <a className="btn-primary flex-1 text-xs text-center" href={videoUrl} download>Download</a>
                <Link href="/gallery" className="btn-primary flex-1 text-xs text-center">Gallery</Link>
              </div>
            )}
          </div>
        </section>

        {/* Generate Controls - Below center block */}
        {!loading && (
          <div className="flex items-center gap-4 justify-center">
            {/* Generate Button - Bigger */}
            <button className="btn-accent px-8 py-3 text-base font-semibold" onClick={onGenerate} disabled={loading || !story.trim()}>
              <span className="inline-flex items-center gap-2">
                <Video className="h-5 w-5" />
                Generate Video
              </span>
            </button>
            
            {/* Generation Mode Dropdown */}
            <div className="relative" data-dropdown="generation-mode">
              <button 
                className="btn bg-white/10 text-white border border-white/20 hover:bg-white/15 px-4 py-3 text-sm transition-all duration-200"
                onClick={() => setShowGenerationModeDropdown(!showGenerationModeDropdown)}
              >
                <span className="inline-flex items-center gap-2">
                  {useSceneGeneration ? '🎬 Scene-by-Scene' : '⚡ Batch Generation'}
                  <svg className={`w-4 h-4 transition-transform ${showGenerationModeDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </button>
              
              {showGenerationModeDropdown && (
                <div className="absolute top-full mt-1 left-0 bg-black/90 backdrop-blur-sm border border-white/20 rounded-lg shadow-xl z-50 min-w-[200px]">
                  <div className="p-1">
                    <button
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                        useSceneGeneration ? 'bg-emerald-400/20 text-emerald-300' : 'text-white hover:bg-white/10'
                      }`}
                      onClick={() => {
                        setUseSceneGeneration(true);
                        setShowGenerationModeDropdown(false);
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span>🎬</span>
                        <div>
                          <div className="font-medium">Scene-by-Scene</div>
                          <div className="text-xs text-white/60">Generate and preview each scene individually</div>
                        </div>
                      </div>
                    </button>
                    <button
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                        !useSceneGeneration ? 'bg-emerald-400/20 text-emerald-300' : 'text-white hover:bg-white/10'
                      }`}
                      onClick={() => {
                        setUseSceneGeneration(false);
                        setShowGenerationModeDropdown(false);
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span>⚡</span>
                        <div>
                          <div className="font-medium">Batch Generation</div>
                          <div className="text-xs text-white/60">Generate entire video at once</div>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        </div>

        {/* Gallery snippet - only show when not generating */}
        {!loading && <RecentGallerySnippet />}
      </div>
    </PageTemplate>
  );
}



function StylePresetImage({ preset }: { preset: typeof stylePresets[0] }) {
  const [imageError, setImageError] = useState(false);

  if (imageError) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
        <div className="text-center">
          <Palette className="h-4 w-4 mx-auto mb-1 text-white/60" />
          <p className="text-[8px] text-white/60 font-medium">{preset.name}</p>
        </div>
      </div>
    );
  }

  return (
    <img
      src={preset.image}
      alt={preset.name}
      className="w-full h-full object-cover"
      onError={() => setImageError(true)}
    />
  );
}



// Compact Progress Component
function CompactProgressUI({ progress, useSceneGeneration }: { progress: GenerationProgress; useSceneGeneration: boolean }) {
  const getCurrentSceneInfo = () => {
    const currentScene = progress.current_scene || progress.scene_progress?.current || 1;
    const totalScenes = progress.total_scenes || progress.scene_progress?.total || 1;
    const subStep = progress.sub_step || progress.scene_progress?.status || '';
    
    let sceneStepLabel = '';
    switch (subStep) {
      case 'starting':
      case 'generating_image':
        sceneStepLabel = 'Image';
        break;
      case 'generating_audio':
        sceneStepLabel = 'Narration';
        break;
      case 'creating_video':
      case 'assembling':
        sceneStepLabel = 'Assembly';
        break;
      default:
        sceneStepLabel = 'Image';
    }
    
    return { currentScene, totalScenes, sceneStepLabel };
  };

  const steps = useSceneGeneration ? [
    { key: 'extracting', label: 'Extracting Text', icon: FileText },
    { key: 'scenes', label: 'Scenes Direction', icon: Film }
  ] : [
    { key: 'extracting', label: 'Extracting', icon: FileText },
    { key: 'images', label: 'Images', icon: Image },
    { key: 'audio', label: 'Audio', icon: Volume2 },
    { key: 'video', label: 'Video', icon: Video }
  ];

  const getStepStatus = (stepKey: string) => {
    if (useSceneGeneration) {
      // For scene generation, handle the flow differently
      if (progress.step === 'extracting' && stepKey === 'extracting') return 'current';
      if (progress.step === 'scenes' && stepKey === 'scenes') return 'current';
      if (progress.step === 'extracting' && stepKey === 'scenes') return 'pending';
      if ((progress.step === 'images' || progress.step === 'audio' || progress.step === 'video' || progress.step === 'generating_scenes') && stepKey === 'extracting') return 'completed';
      if ((progress.step === 'images' || progress.step === 'audio' || progress.step === 'video' || progress.step === 'generating_scenes') && stepKey === 'scenes') return 'completed';
    } else {
      // For batch generation, use the original logic
      if (progress.step === stepKey) return 'current';
      
      const stepOrder = ['extracting', 'images', 'audio', 'video'];
      const currentIndex = stepOrder.indexOf(progress.step);
      const stepIndex = stepOrder.indexOf(stepKey);
      
      return stepIndex < currentIndex ? 'completed' : 'pending';
    }
    
    return 'pending';
  };

  const { currentScene, totalScenes, sceneStepLabel } = getCurrentSceneInfo();
  const progressPercentage = Math.round((progress.progress || 0));

  return (
    <div className="bg-white/5 border border-white/15 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">Generation Progress</h3>
        <span className="text-xs text-white/60">{progressPercentage}%</span>
      </div>
      
      {/* Compact Steps */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {steps.map((step, index) => {
          const status = getStepStatus(step.key);
          const Icon = step.icon;
          
          return (
            <React.Fragment key={step.key}>
              <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs ${
                status === 'completed' ? 'bg-green-500/20 text-green-400' :
                status === 'current' ? 'bg-blue-500/20 text-blue-400' :
                'bg-white/5 text-white/40'
              }`}>
                <Icon className="h-3 w-3" />
                <span>{step.label}</span>
                {status === 'current' && <div className="w-1 h-1 bg-current rounded-full animate-pulse ml-1" />}
              </div>
              {index < steps.length - 1 && (
                <div className={`w-2 h-px ${
                  status === 'completed' ? 'bg-green-400/40' : 'bg-white/20'
                }`} />
              )}
            </React.Fragment>
          );
        })}
        
        {/* Scene-by-scene progress for scene generation */}
        {useSceneGeneration && (progress.step === 'images' || progress.step === 'audio' || progress.step === 'video' || progress.step === 'generating_scenes') && (
          <>
            <div className="w-2 h-px bg-green-400/40" />
            <div className="bg-blue-500/20 text-blue-400 flex items-center gap-1 px-2 py-1 rounded-md text-xs">
              <span>Scene {currentScene}/{totalScenes}: {sceneStepLabel}</span>
              <div className="w-1 h-1 bg-current rounded-full animate-pulse ml-1" />
            </div>
          </>
        )}
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-white/10 rounded-full h-1.5">
        <div 
          className="bg-gradient-to-r from-blue-500 to-purple-500 h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>
      
      {/* Current Message */}
      {progress.message && (
        <div className="text-xs text-white/70 mt-2 text-center">
          {progress.message}
        </div>
      )}
    </div>
  );
}

function RecentGallerySnippet() {
  const [videos, setVideos] = useState<any[]>([]);
  useEffect(() => {
    fetch('/api/gallery/recent').then(r => r.json()).then(d => setVideos(d.videos || [])).catch(() => setVideos([]));
  }, []);
  if (videos.length === 0) return null;
  return (
    <section className="mt-6">
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Image className="h-5 w-5" /> Recent videos</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {videos.slice(0, 4).map((v) => (
          <div key={v.id} className="card animate-in fade-in duration-500">
            <video controls className="w-full rounded-xl border border-white/15">
              <source src={v.url} type="video/mp4" />
            </video>
            <div className="mt-2 text-sm text-white/80 truncate">{v.title}</div>
          </div>
        ))}
      </div>
    </section>
  );
}