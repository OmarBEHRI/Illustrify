'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, RefreshCw, Play, CheckCircle } from 'lucide-react';

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

interface SceneProgressViewProps {
  jobId: string;
  scenes: Scene[];
  onRegenerateScene: (sceneId: string) => void;
  onAssembleVideo: () => void;
  isRegenerating: boolean;
  isAssembling: boolean;
  regeneratingSceneId?: string;
}

export default function SceneProgressView({
  jobId,
  scenes,
  onRegenerateScene,
  onAssembleVideo,
  isRegenerating,
  isAssembling,
  regeneratingSceneId
}: SceneProgressViewProps) {
  const [selectedScene, setSelectedScene] = useState<string | null>(null);

  const completedScenes = scenes.filter(scene => scene.status === 'completed');
  const allScenesCompleted = scenes.length > 0 && completedScenes.length === scenes.length;

  const getStatusBadge = (scene: Scene) => {
    switch (scene.status) {
      case 'pending':
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Pending</span>;
      case 'generating':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Loader2 className="h-3 w-3 animate-spin" />
            Generating
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3" />
            Completed
          </span>
        );
      case 'error':
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">Error</span>;
      default:
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Unknown</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Scene Generation Progress</h3>
        <div className="text-sm text-gray-600">
          {completedScenes.length} of {scenes.length} scenes completed
        </div>
      </div>

      <div className="grid gap-4">
        {scenes.map((scene) => (
          <div key={scene.id} className="relative bg-white/5 border border-white/15 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-white">
                  Scene {scene.scene_number}
                </h3>
                <div className="flex items-center gap-2">
                  {getStatusBadge(scene)}
                  {scene.status === 'completed' && (
                    <button
                      onClick={() => onRegenerateScene(scene.id)}
                      disabled={isRegenerating || isAssembling}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${isRegenerating || isAssembling ? 'bg-white/5 text-white/50 border-white/10 cursor-not-allowed' : 'bg-white/10 text-white border-white/20 hover:bg-white/15'}`}
                    >
                      {isRegenerating && regeneratingSceneId === scene.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3" />
                      )}
                      Regenerate
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="p-4">
              <p className="text-sm text-white/70 mb-3">{scene.description}</p>
              
              {scene.status === 'error' && scene.error && (
                <div className="text-sm text-red-400 mb-3 p-2 bg-red-900/20 border border-red-500/20 rounded-md">
                  Error: {scene.error}
                </div>
              )}
              
              {scene.video_url && (
                <div className="space-y-2">
                  <video
                    controls
                    className="w-full rounded-lg border border-white/15"
                    poster={scene.image_url}
                  >
                    <source src={scene.video_url} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                  <div className="flex gap-2 text-xs text-white/60">
                    {scene.image_url && (
                      <button
                        onClick={() => setSelectedScene(selectedScene === scene.id ? null : scene.id)}
                        className="hover:text-blue-400 transition-colors"
                      >
                        {selectedScene === scene.id ? 'Hide' : 'Show'} Image
                      </button>
                    )}
                    {scene.audio_url && (
                      <a
                        href={scene.audio_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-blue-400 transition-colors"
                      >
                        Audio
                      </a>
                    )}
                  </div>
                  {selectedScene === scene.id && scene.image_url && (
                    <img
                      src={scene.image_url}
                      alt={`Scene ${scene.scene_number}`}
                      className="w-full rounded-lg mt-2 border border-white/15"
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {allScenesCompleted && (
        <div className="mt-6 text-center">
          <button
            onClick={onAssembleVideo}
            disabled={isAssembling}
            className={`inline-flex items-center px-6 py-3 rounded-lg font-medium transition-all ${isAssembling ? 'bg-gradient-to-r from-purple-600/50 to-blue-600/50 cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'} text-white`}
          >
            {isAssembling ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Assembling Video...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Assemble Final Video
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}