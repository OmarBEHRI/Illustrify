import PageTemplate from '@/components/PageTemplate';
import TTSTest from '@/components/TTSTest';

export default function TTSTestPage() {
  return (
    <PageTemplate>
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Text-to-Speech Test</h1>
          <p className="text-white/70">
            Test the integrated Kokoro TTS system. Enter text below and generate high-quality speech audio.
          </p>
        </div>
        
        <div className="card">
          <TTSTest />
        </div>
        
        <div className="mt-8 p-4 bg-white/5 rounded-lg">
          <h3 className="text-lg font-semibold text-white mb-2">How it works:</h3>
          <ul className="text-white/70 text-sm space-y-1">
            <li>• Uses local Kokoro TTS model running in Docker</li>
            <li>• Supports multiple voices and speed control</li>
            <li>• Generates high-quality MP3 audio files</li>
            <li>• No external API calls - completely local</li>
          </ul>
        </div>
      </div>
    </PageTemplate>
  );
}