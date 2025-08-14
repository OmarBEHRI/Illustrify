'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import pb from '@/lib/pocketbase';

interface TTSTestProps {
  className?: string;
}

export default function TTSTest({ className = '' }: TTSTestProps) {
  const { user } = useAuth();
  const [text, setText] = useState('Hello, this is a test of our text-to-speech system.');
  const [voice, setVoice] = useState('af_heart');
  const [speed, setSpeed] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateAudio = async () => {
    if (!text.trim()) {
      setError('Please enter some text');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setAudioUrl(null);

    try {
      // Check if user is authenticated
      console.log('🔍 Client-side auth check:');
      console.log('User:', user);
      console.log('PB Auth Store Token:', pb.authStore.token);
      console.log('PB Auth Store Valid:', pb.authStore.isValid);
      console.log('PB Auth Store Model:', pb.authStore.model);
      
      if (!user || !pb.authStore.token) {
        throw new Error('Please sign in to use text-to-speech');
      }

      console.log('🚀 Making TTS API request with token:', pb.authStore.token?.substring(0, 20) + '...');
      
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${pb.authStore.token}`,
        },
        body: JSON.stringify({
          text,
          voice,
          speed,
        }),
      });
      
      console.log('📡 TTS API Response Status:', response.status);
      console.log('📡 TTS API Response Headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate audio');
      }

      // Create a blob URL for the audio
      const audioBlob = await response.blob();
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadAudio = () => {
    if (audioUrl) {
      const a = document.createElement('a');
      a.href = audioUrl;
      a.download = 'generated_audio.mp3';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // Show sign-in message if user is not authenticated
  if (!user) {
    return (
      <div className={`space-y-4 ${className}`}>
        <h3 className="text-lg font-semibold text-white">Text-to-Speech Test</h3>
        <div className="p-4 bg-yellow-500/20 border border-yellow-500/30 rounded-lg text-yellow-200">
          <p className="text-sm">Please sign in to use the text-to-speech feature.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <h3 className="text-lg font-semibold text-white">Text-to-Speech Test</h3>
      
      <div>
        <label className="block text-sm text-white/70 mb-2">Text to convert</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="input h-24 resize-none"
          placeholder="Enter text to convert to speech..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-white/70 mb-2">Voice</label>
          <select
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
            className="input"
          >
            <option value="af_heart">AF Heart</option>
            <option value="af_sky">AF Sky</option>
            <option value="af_bella">AF Bella</option>
            <option value="am_adam">AM Adam</option>
            <option value="am_michael">AM Michael</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-white/70 mb-2">Speed</label>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            className="w-full"
          />
          <div className="text-xs text-white/50 text-center">{speed}x</div>
        </div>
      </div>

      <button
        onClick={generateAudio}
        disabled={isGenerating || !text.trim()}
        className="btn btn-primary w-full"
      >
        {isGenerating ? 'Generating Audio...' : 'Generate Audio'}
      </button>

      {error && (
        <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-200 text-sm">
          {error}
        </div>
      )}

      {audioUrl && (
        <div className="space-y-3">
          <div className="p-3 bg-green-500/20 border border-green-500/30 rounded-lg">
            <p className="text-green-200 text-sm mb-2">✅ Audio generated successfully!</p>
            <audio controls className="w-full">
              <source src={audioUrl} type="audio/mpeg" />
              Your browser does not support the audio element.
            </audio>
          </div>
          
          <button
            onClick={downloadAudio}
            className="btn btn-accent w-full"
          >
            Download Audio
          </button>
        </div>
      )}
    </div>
  );
}