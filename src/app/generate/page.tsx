"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Upload, Youtube, Image, Tv2, FileText, Scissors, Palette, Music, CheckCircle, Clock } from 'lucide-react';
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
  const [availableVoices, setAvailableVoices] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const cost = useMemo(() => quality === 'LOW' ? 0 : quality === 'HIGH' ? 10 : 50, [quality]);

  // Fetch available voices when TTS engine changes
  useEffect(() => {
    const fetchVoices = async () => {
      try {
        if (ttsEngine === 'kokoro') {
          const response = await fetch('http://localhost:8880/v1/audio/voices');
          if (response.ok) {
            const data = await response.json();
            setAvailableVoices(data.voices || []);
            // Set default voice if current selection is not available
            if (!data.voices?.includes(selectedVoice)) {
              setSelectedVoice(data.voices?.[0] || 'af_heart');
            }
          }
        } else {
          // For Eleven Labs, we'll set some common voices
          // This would be replaced with actual Eleven Labs API call
          setAvailableVoices(['Rachel', 'Drew', 'Clyde', 'Paul', 'Domi', 'Dave', 'Fin', 'Sarah']);
          setSelectedVoice('Rachel');
        }
      } catch (error) {
        console.error('Failed to fetch voices:', error);
        // Fallback voices
        setAvailableVoices(['af_heart', 'af_bella', 'am_adam', 'am_michael']);
      }
    };

    fetchVoices();
  }, [ttsEngine]);

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
          voice: selectedVoice
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
        if (data.progress?.scene_progress?.status === 'completed' && isRegenerating) {
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
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start flex-1">
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
                <label className="text-sm text-white/70 mb-2 block">Generation Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    className={`btn text-xs transition-all duration-200 ${useSceneGeneration ? 'bg-emerald-400/90 text-emerald-950 shadow-lg shadow-emerald-400/20' : 'bg-white/10 text-white border border-white/20 hover:bg-white/15'}`} 
                    onClick={() => setUseSceneGeneration(true)}
                  >
                    🎬 Scene-by-Scene
                  </button>
                  <button 
                    className={`btn text-xs transition-all duration-200 ${!useSceneGeneration ? 'bg-emerald-400/90 text-emerald-950 shadow-lg shadow-emerald-400/20' : 'bg-white/10 text-white border border-white/20 hover:bg-white/15'}`} 
                    onClick={() => setUseSceneGeneration(false)}
                  >
                    ⚡ Batch Generation
                  </button>
                </div>
                <p className="text-xs text-white/60 mt-1">
                  {useSceneGeneration ? 'Generate and preview each scene individually' : 'Generate entire video at once'}
                </p>
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
                <div className="relative">
                  <select 
                    className="input text-sm w-full appearance-none bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 focus:bg-white/15 transition-all duration-200 cursor-pointer"
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                  >
                    {availableVoices.map(voice => (
                      <option key={voice} value={voice} className="bg-gray-800 text-white">
                        {voice.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
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
                {loading && generationProgress ? (
                  <GenerationProgressView progress={generationProgress} />
                ) : (
                  <div className="text-center text-white/70">
                    <Tv2 className="mx-auto h-10 w-10 mb-3" />
                    <p className="text-sm">Your video will appear here</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right controls */}
          <div className="card space-y-3 animate-in fade-in slide-in-from-right-4 duration-500">
            <div>
              <label className="text-sm text-white/70 mb-2 block">Visual style</label>
              <div className="grid grid-cols-3 gap-2">
                {stylePresets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      setSelectedStylePreset(preset.id);
                      setStyle(preset.prompt);
                    }}
                    className={`relative overflow-hidden rounded-lg border-2 transition-all aspect-square ${selectedStylePreset === preset.id
                      ? 'border-emerald-400 bg-emerald-400/10'
                      : 'border-white/20 hover:border-white/40'
                      }`}
                  >
                    <StylePresetImage preset={preset} />
                    <div className="absolute bottom-0 left-0 right-0 p-1 bg-gradient-to-t from-black/90 to-transparent">
                      <p className="text-[10px] text-white font-medium leading-tight">{preset.name}</p>
                    </div>
                  </button>
                ))}
                <button
                  onClick={() => {
                    setSelectedStylePreset('other');
                    setStyle(customStyle);
                  }}
                  className={`relative overflow-hidden rounded-lg border-2 transition-all flex flex-col items-center justify-center aspect-square ${selectedStylePreset === 'other'
                    ? 'border-emerald-400 bg-emerald-400/10'
                    : 'border-white/20 hover:border-white/40'
                    }`}
                >
                  <div className="text-lg mb-1">✏️</div>
                  <p className="text-[10px] text-white font-medium">Other</p>
                </button>
              </div>
              {selectedStylePreset === 'other' && (
                <textarea
                  className="input mt-2 h-16 resize-none text-sm"
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

            <button className="btn-accent w-full text-sm" onClick={onGenerate} disabled={loading || !story.trim()}>
              {loading ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Generating...</span> : 'Generate video'}
            </button>
            {error && <p className="text-xs text-red-300">{error}</p>}
            {videoUrl && (
              <div className="flex gap-2">
                <a className="btn-primary flex-1 text-xs text-center" href={videoUrl} download>Download</a>
                <Link href="/gallery" className="btn-primary flex-1 text-xs text-center">Gallery</Link>
              </div>
            )}
          </div>
        </section>

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

function GenerationProgressView({ progress }: { progress: GenerationProgress }) {
  const steps = [
    { key: 'extracting', icon: FileText, label: 'Extracting Content' },
    { key: 'scenes', icon: Scissors, label: 'Creating Scenes' },
    { key: 'images', icon: Palette, label: 'Generating Images' },
    { key: 'audio', icon: Music, label: 'Creating Audio' },
    { key: 'video', icon: Tv2, label: 'Assembling Video' }
  ];

  const currentStepIndex = steps.findIndex(s => s.key === progress.step);

  return (
    <div className="w-full max-w-md mx-auto p-6">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 text-emerald-400 mb-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm font-medium">Generating Video</span>
        </div>
        <p className="text-xs text-white/70">{progress.message}</p>
      </div>

      {/* Progress Steps */}
      <div className="space-y-3 mb-6">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === currentStepIndex;
          const isCompleted = index < currentStepIndex;

          return (
            <div key={step.key} className={`flex items-center gap-3 p-2 rounded-lg transition-all ${isActive ? 'bg-emerald-400/10 border border-emerald-400/20' :
                isCompleted ? 'bg-white/5' : 'opacity-50'
              }`}>
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isCompleted ? 'bg-emerald-400 text-emerald-950' :
                  isActive ? 'bg-emerald-400/20 text-emerald-400' : 'bg-white/10 text-white/50'
                }`}>
                {isCompleted ? <CheckCircle className="h-4 w-4" /> :
                  isActive ? <Icon className="h-4 w-4 animate-pulse" /> :
                    <Icon className="h-4 w-4" />}
              </div>
              <span className={`text-sm ${isActive ? 'text-white font-medium' : isCompleted ? 'text-white/80' : 'text-white/50'}`}>
                {step.label}
              </span>
              {isActive && (
                <div className="ml-auto">
                  <Clock className="h-4 w-4 text-emerald-400 animate-pulse" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-white/10 rounded-full h-2 mb-4">
        <div
          className="bg-gradient-to-r from-emerald-400 to-blue-400 h-2 rounded-full transition-all duration-500"
          style={{ width: `${progress.progress}%` }}
        />
      </div>

      {/* Generated Images Preview */}
      {progress.generatedImages && progress.generatedImages.length > 0 && (
        <div>
          <p className="text-xs text-white/70 mb-2">Generated Images:</p>
          <div className="grid grid-cols-2 gap-2">
            {progress.generatedImages.slice(0, 4).map((imageUrl, index) => (
              <div key={index} className="aspect-square rounded-lg overflow-hidden border border-white/20">
                <img
                  src={imageUrl}
                  alt={`Generated image ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
          {progress.generatedImages.length > 4 && (
            <p className="text-xs text-white/50 mt-1 text-center">
              +{progress.generatedImages.length - 4} more images
            </p>
          )}
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


