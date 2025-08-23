'use client';

import { useState, useRef, useEffect } from 'react';
import { Volume2, Download, Play, Pause, Mic, Settings, Sparkles } from 'lucide-react';
import PageTemplate from '@/components/PageTemplate';
import { useAuth } from '@/contexts/AuthContext';
import pb, { pbHelpers } from '@/lib/pocketbase';
// TODO: Fix Audio import issue
// import { Audio } from '@/lib/pocketbase';
type Audio = any;

// Voice options for Kokoro TTS
const voiceOptions = [
  // American Female Voices
  {
    id: 'af_alloy',
    name: 'Alloy (Female)',
    description: 'Clear, versatile female voice',
    gender: 'female',
    preview: '/voice-previews/af_alloy.wav'
  },
  {
    id: 'af_bella',
    name: 'Bella (Female)',
    description: 'Warm, expressive female voice',
    gender: 'female',
    preview: '/voice-previews/af_bella.wav'
  },
  {
    id: 'af_heart',
    name: 'Heart (Female)',
    description: 'Gentle, caring female voice',
    gender: 'female',
    preview: '/voice-previews/af_heart.wav'
  },
  {
    id: 'af_nova',
    name: 'Nova (Female)',
    description: 'Bright, energetic female voice',
    gender: 'female',
    preview: '/voice-previews/af_nova.wav'
  },
  {
    id: 'af_sarah',
    name: 'Sarah (Female)',
    description: 'Professional, confident female voice',
    gender: 'female',
    preview: '/voice-previews/af_sarah.wav'
  },
  // American Male Voices
  {
    id: 'am_adam',
    name: 'Adam (Male)',
    description: 'Deep, authoritative male voice',
    gender: 'male',
    preview: '/voice-previews/am_adam.wav'
  },
  {
    id: 'am_echo',
    name: 'Echo (Male)',
    description: 'Clear, resonant male voice',
    gender: 'male',
    preview: '/voice-previews/am_echo.wav'
  },
  {
    id: 'am_liam',
    name: 'Liam (Male)',
    description: 'Smooth, conversational male voice',
    gender: 'male',
    preview: '/voice-previews/am_liam.wav'
  },
  {
    id: 'am_michael',
    name: 'Michael (Male)',
    description: 'Warm, friendly male voice',
    gender: 'male',
    preview: '/voice-previews/am_michael.wav'
  },
  {
    id: 'am_onyx',
    name: 'Onyx (Male)',
    description: 'Rich, sophisticated male voice',
    gender: 'male',
    preview: '/voice-previews/am_onyx.wav'
  }
];

interface AudioMessage {
  type: 'user' | 'assistant';
  content: string;
  audioUrl?: string;
  voice?: string;
  timestamp: Date;
}

export default function AudioGenerationPage() {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('af_heart');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioHistory, setAudioHistory] = useState<AudioMessage[]>([]);
  const [pbAudioHistory, setPbAudioHistory] = useState<Audio[]>([]);
  const [playingPreview, setPlayingPreview] = useState<string | null>(null);
  const [playingGenerated, setPlayingGenerated] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const generatedAudioRef = useRef<HTMLAudioElement | null>(null);

  const selectedVoiceData = voiceOptions.find(v => v.id === selectedVoice)!;

  // Fetch audio history from PocketBase
  useEffect(() => {
    const fetchAudioHistory = async () => {
      if (user) {
        try {
          const userAudio = await pbHelpers.getUserAudio(user.id);
          // Filter for audio with non-empty files
          const filteredAudio = userAudio.filter(audio => audio.audio_file);
          setPbAudioHistory(filteredAudio);
        } catch (error) {
          console.error('Error fetching audio history:', error);
        }
      }
    };

    fetchAudioHistory();
  }, [user]);

  // Helper function to get file URL
  const getFileUrl = (record: Audio, filename: string) => {
    return pb.files.getUrl(record, filename);
  };

  const handleGenerate = async () => {
    if (!text.trim()) return;

    setLoading(true);
    setError(null);

    // Add user message to history
    const userMessage: AudioMessage = {
      type: 'user',
      content: text,
      timestamp: new Date()
    };
    setAudioHistory(prev => [...prev, userMessage]);

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${pb.authStore.token}`
        },
        body: JSON.stringify({
          text: text,
          voice: selectedVoice
        })
      });

      if (response.ok) {
        // Get the audio blob from response
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Add assistant response to history (audio-only, no text message)
        const assistantMessage: AudioMessage = {
          type: 'assistant',
          content: '', // Empty content to show only audio player
          audioUrl: audioUrl,
          voice: selectedVoiceData.name,
          timestamp: new Date()
        };
        setAudioHistory(prev => [...prev, assistantMessage]);
        
        // Refresh audio history from PocketBase
        if (user) {
          try {
            const userAudio = await pbHelpers.getUserAudio(user.id);
            const filteredAudio = userAudio.filter(audio => audio.audio_file);
            setPbAudioHistory(filteredAudio);
          } catch (error) {
            console.error('Error refreshing audio history:', error);
          }
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Failed to generate audio' }));
        throw new Error(errorData.error || 'Failed to generate audio');
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
      setText(''); // Clear input after generation
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  const playPreview = async (voiceId: string) => {
    const voice = voiceOptions.find(v => v.id === voiceId);
    if (!voice) return;

    if (playingPreview === voiceId) {
      // Stop current preview
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current.currentTime = 0;
      }
      setPlayingPreview(null);
    } else {
      // Stop any currently playing preview
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      
      // Play new preview
      const audio = new Audio(voice.preview);
      previewAudioRef.current = audio;
      setPlayingPreview(voiceId);
      
      audio.onended = () => setPlayingPreview(null);
      audio.onerror = () => setPlayingPreview(null);
      
      try {
        await audio.play();
      } catch (error) {
        console.error('Error playing preview:', error);
        setPlayingPreview(null);
      }
    }
  };

  const playGeneratedAudio = async (audioUrl: string) => {
    if (playingGenerated === audioUrl) {
      // Stop current audio
      if (generatedAudioRef.current) {
        generatedAudioRef.current.pause();
        generatedAudioRef.current.currentTime = 0;
      }
      setPlayingGenerated(null);
    } else {
      // Stop any currently playing audio
      if (generatedAudioRef.current) {
        generatedAudioRef.current.pause();
      }
      
      // Play new audio
      const audio = new Audio(audioUrl);
      generatedAudioRef.current = audio;
      setPlayingGenerated(audioUrl);
      
      audio.onended = () => setPlayingGenerated(null);
      audio.onerror = () => setPlayingGenerated(null);
      
      try {
        await audio.play();
      } catch (error) {
        console.error('Error playing audio:', error);
        setPlayingGenerated(null);
      }
    }
  };

  return (
    <PageTemplate>
      <div className="flex flex-col" style={{ height: 'calc(100vh - 120px)' }}>
        {/* Header */}
        <div className="flex-shrink-0 pb-3">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Volume2 className="h-6 w-6 text-emerald-400" />
            Audio Generation
          </h1>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden gap-6">
          {/* Audio History - Left Side */}
          <div className="flex-1 bg-white/5 backdrop-blur-sm border border-white/20 rounded-2xl p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
              <Sparkles className="h-4 w-4 text-emerald-400" />
              <h2 className="font-semibold">History</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3">
              {/* Show PocketBase history first */}
              {pbAudioHistory.length === 0 && audioHistory.length === 0 ? (
                <div className="text-center text-white/50 mt-8">
                  <Volume2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Generated audio will appear here</p>
                </div>
              ) : (
                <>
                  {/* PocketBase Audio History */}
                  {pbAudioHistory.slice().reverse().map((audio) => (
                    <div key={audio.id} className="bg-white/5 border border-white/10 rounded-xl p-3">
                      <div className="space-y-2">
                        <p className="text-sm text-white/80">{audio.transcript}</p>
                        <div className="flex items-center gap-1 text-xs text-white/60">
                          <Mic className="h-3 w-3" />
                          {audio.voice} • {new Date(audio.created).toLocaleDateString()}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => playGeneratedAudio(getFileUrl(audio, audio.audio_file))}
                            className="text-xs px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 rounded-md flex items-center gap-2 transition-colors font-medium"
                          >
                            {playingGenerated === getFileUrl(audio, audio.audio_file) ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                            {playingGenerated === getFileUrl(audio, audio.audio_file) ? 'Pause' : 'Play Audio'}
                          </button>
                          <a 
                            href={getFileUrl(audio, audio.audio_file)} 
                            download 
                            className="text-xs px-3 py-2 bg-white/10 hover:bg-white/20 rounded-md flex items-center gap-2 transition-colors font-medium"
                          >
                            <Download className="h-4 w-4" />
                            Download
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Local Session History */}
                  {audioHistory.map((message, index) => (
                    <div key={`local-${index}`} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-xl p-3 text-sm ${
                        message.type === 'user' 
                          ? 'bg-emerald-500/20 border border-emerald-400/30' 
                          : 'bg-white/5 border border-white/10'
                      }`}>
                        {message.content && <p>{message.content}</p>}
                        {message.audioUrl && (
                          <div className={`${message.content ? 'mt-2' : ''} space-y-2`}>
                            <div className="flex items-center gap-1 text-xs text-white/60">
                              <Mic className="h-3 w-3" />
                              {message.voice}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => playGeneratedAudio(message.audioUrl!)}
                                className="text-xs px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 rounded-md flex items-center gap-2 transition-colors font-medium"
                              >
                                {playingGenerated === message.audioUrl ? (
                                  <Pause className="h-4 w-4" />
                                ) : (
                                  <Play className="h-4 w-4" />
                                )}
                                {playingGenerated === message.audioUrl ? 'Pause' : 'Play Audio'}
                              </button>
                              <a 
                                href={message.audioUrl} 
                                download 
                                className="text-xs px-3 py-2 bg-white/10 hover:bg-white/20 rounded-md flex items-center gap-2 transition-colors font-medium"
                              >
                                <Download className="h-4 w-4" />
                                Download
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Voice Selection - Right Side */}
          <div className="w-80 bg-white/5 backdrop-blur-sm border border-white/20 rounded-2xl p-4 overflow-y-auto">
            <div className="flex items-center gap-2 mb-3">
              <Settings className="h-4 w-4 text-emerald-400" />
              <h3 className="font-semibold">Voice</h3>
            </div>
            <div className="space-y-2">
              {voiceOptions.map((voice) => (
                <button
                  key={voice.id}
                  onClick={() => setSelectedVoice(voice.id)}
                  className={`w-full p-3 rounded-lg border transition-all text-left ${
                    selectedVoice === voice.id 
                      ? 'border-emerald-400 bg-emerald-400/10' 
                      : 'border-white/20 hover:border-white/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-medium text-white">{voice.name}</h4>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          voice.gender === 'female' 
                            ? 'bg-pink-500/20 text-pink-300' 
                            : 'bg-blue-500/20 text-blue-300'
                        }`}>
                          {voice.gender}
                        </span>
                      </div>
                      <p className="text-xs text-white/70">{voice.description}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        playPreview(voice.id);
                      }}
                      className="ml-2 p-1.5 rounded-md bg-white/10 hover:bg-white/20 transition-colors"
                    >
                      {playingPreview === voice.id ? (
                        <Pause className="h-3 w-3 text-white" />
                      ) : (
                        <Play className="h-3 w-3 text-white" />
                      )}
                    </button>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Input Area */}
        <div className="flex-shrink-0 pt-4 pb-2">
          <div className="relative">
            <div className="bg-white/5 backdrop-blur-sm border border-white/20 rounded-full p-2 flex items-center gap-3">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter text to convert to speech..."
                className="flex-1 bg-transparent px-4 py-2 text-white placeholder-white/50 resize-none focus:outline-none min-h-[40px] max-h-[120px]"
                rows={1}
                disabled={loading}
                style={{ lineHeight: '1.5' }}
              />
              
              <div className="text-xs text-white/60 px-2 border-l border-white/20">
                {selectedVoiceData.name}
              </div>
              
              <button
                onClick={handleGenerate}
                disabled={loading || !text.trim()}
                className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white px-5 py-2.5 rounded-full font-medium transition-colors disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Volume2 className="h-4 w-4 animate-pulse" />
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
      </div>
    </PageTemplate>
  );
}