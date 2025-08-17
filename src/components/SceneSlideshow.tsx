'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Play, Loader2 } from 'lucide-react';

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

interface SceneSlideshowProps {
  jobId: string;
  scenes: Scene[];
  onRegenerateScene: (sceneId: string) => void;
  onAssembleVideo: () => void;
  isRegenerating: boolean;
  isAssembling: boolean;
  regeneratingSceneId?: string;
  progressData?: any;
}

export default function SceneSlideshow({
  jobId,
  scenes,
  onRegenerateScene,
  onAssembleVideo,
  isRegenerating,
  isAssembling,
  regeneratingSceneId,
  progressData
}: SceneSlideshowProps) {
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [showAllScenes, setShowAllScenes] = useState(false);

  const completedScenes = scenes.filter(scene => scene.status === 'completed');
  // Ensure all scenes are completed AND have video_url for proper assembly
  const allScenesCompleted = scenes.length > 0 && 
    completedScenes.length === scenes.length && 
    scenes.every(scene => scene.video_url);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (showAllScenes) return; // Don't navigate when showing all scenes
      
      if (event.key === 'ArrowLeft' && currentSceneIndex > 0) {
        setCurrentSceneIndex(currentSceneIndex - 1);
      } else if (event.key === 'ArrowRight' && currentSceneIndex < scenes.length - 1) {
        setCurrentSceneIndex(currentSceneIndex + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSceneIndex, scenes.length, showAllScenes]);

  const currentScene = scenes[currentSceneIndex];

  const getStatusBadge = (scene: Scene, progressData?: any) => {
    // Check if this scene is currently being regenerated
    const isCurrentlyRegenerating = progressData && 
      progressData.scene_progress && 
      progressData.scene_progress.scene_id === scene.id && 
      (progressData.scene_progress.status === 'regenerating' || 
       progressData.scene_progress.status === 'generating_image' ||
       progressData.scene_progress.status === 'generating_audio' ||
       progressData.scene_progress.status === 'creating_video');
    
    // Check if this scene is currently being generated based on progress data
    const isCurrentlyGenerating = progressData && 
      progressData.scene_progress && 
      progressData.scene_progress.current === scene.scene_number && 
      (progressData.step === 'generating_scenes' || progressData.step === 'scene_completed');
    
    if (isCurrentlyRegenerating) {
      const subStepText: Record<string, string> = {
        'regenerating': 'Starting Regeneration...',
        'generating_image': 'Creating New Image...',
        'generating_audio': 'Creating New Audio...',
        'creating_video': 'Assembling New Video...',
        'regeneration_completed': 'Regeneration Complete!'
      };
      const displayText = subStepText[progressData.scene_progress.status] || 'Regenerating...';
      
      const isCompleted = progressData.scene_progress.status === 'regeneration_completed';
      const bgColor = isCompleted ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800';
      
      return (
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${bgColor}`}>
            {!isCompleted && <Loader2 className="h-3 w-3 animate-spin" />}
            {isCompleted && <Play className="h-3 w-3" />}
            {displayText}
          </span>
        );
    }
    
    if (isCurrentlyGenerating) {
      const subStepText: Record<string, string> = {
        'starting': 'Starting Scene...',
        'generating_image': 'Creating Image...',
        'generating_audio': 'Creating Audio...',
        'creating_video': 'Assembling Video...',
        'completed': 'Scene Complete!'
      };
      const displayText = subStepText[progressData.scene_progress.status] || 
                         subStepText[progressData.sub_step] || 'Processing...';
      
      // Show different colors based on status
      const isCompleted = progressData.scene_progress.status === 'completed' || progressData.sub_step === 'completed';
      const bgColor = isCompleted ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800';
      
      return (
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${bgColor}`}>
            {!isCompleted && <Loader2 className="h-3 w-3 animate-spin" />}
            {isCompleted && <Play className="h-3 w-3" />}
            {displayText}
          </span>
        );
    }
    
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
            <Play className="h-3 w-3" />
            Completed
          </span>
        );
      case 'error':
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">Error</span>;
      default:
        return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Unknown</span>;
    }
  };

  if (showAllScenes) {
    // Show all scenes in a grid view
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">All Scenes</h3>
          <button
            onClick={() => setShowAllScenes(false)}
            className="px-3 py-1 text-sm bg-white/10 text-white border border-white/20 rounded-md hover:bg-white/15 transition-colors"
          >
            Slideshow View
          </button>
        </div>
        
        <div className="grid gap-4">
          {scenes.map((scene, index) => (
            <div key={scene.id} className="relative bg-white/5 border border-white/15 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-white">
                    Scene {index + 1}
                  </h3>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(scene, progressData)}
                    {scene.status === 'completed' && (
                      <button
                        onClick={() => onRegenerateScene(scene.id)}
                        disabled={isRegenerating || isAssembling}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${isRegenerating || isAssembling ? 'bg-white/5 text-white/50 border-white/10 cursor-not-allowed' : 'bg-white/10 text-white border-white/20 hover:bg-white/15'}`}
                      >
                        {isRegenerating && regeneratingSceneId === scene.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          'Regenerate'
                        )}
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
                  <video
                    key={scene.id}
                    controls
                    className="w-full rounded-lg border border-white/15"
                    poster={scene.image_url}
                  >
                    <source src={scene.video_url} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
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

  // Slideshow view
  return (
    <div className="space-y-6">
      {/* Scene Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Generated Scenes</h3>
        <button
          onClick={() => setShowAllScenes(true)}
          className="px-3 py-1 text-sm bg-white/10 text-white border border-white/20 rounded-md hover:bg-white/15 transition-colors"
        >
          View All
        </button>
      </div>

      {/* Scene Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCurrentSceneIndex(Math.max(0, currentSceneIndex - 1))}
          disabled={currentSceneIndex === 0}
          className={`p-2 rounded-lg transition-colors ${currentSceneIndex === 0 ? 'bg-white/5 text-white/30 cursor-not-allowed' : 'bg-white/10 text-white hover:bg-white/15'}`}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        
        <div className="text-center">
                <div className="text-white font-medium">Scene {currentScene?.scene_number || (currentSceneIndex + 1)}</div>
                <div className="text-sm text-white/60">{currentSceneIndex + 1} of {scenes.length}</div>
              </div>
        
        <button
          onClick={() => setCurrentSceneIndex(Math.min(scenes.length - 1, currentSceneIndex + 1))}
          disabled={currentSceneIndex === scenes.length - 1}
          className={`p-2 rounded-lg transition-colors ${currentSceneIndex === scenes.length - 1 ? 'bg-white/5 text-white/30 cursor-not-allowed' : 'bg-white/10 text-white hover:bg-white/15'}`}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Current Scene Display */}
      {currentScene && (
        <div className="bg-white/5 border border-white/15 rounded-xl overflow-hidden">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-white">
                Scene {currentScene.scene_number + 1}
              </h3>
              {getStatusBadge(currentScene, progressData)}
            </div>
            
            {currentScene.status === 'error' && currentScene.error && (
              <div className="text-sm text-red-400 mb-3 p-2 bg-red-900/20 border border-red-500/20 rounded-md">
                Error: {currentScene.error}
              </div>
            )}
            
            {/* Scene Image/Video */}
            <div className="space-y-3">
              {currentScene.video_url ? (
                <video
                  key={currentScene.id}
                  controls
                  className="w-full rounded-lg border border-white/15"
                  poster={currentScene.image_url}
                >
                  <source src={currentScene.video_url} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              ) : currentScene.image_url ? (
                <img
                  src={currentScene.image_url}
                  alt={`Scene ${currentScene.scene_number}`}
                  className="w-full rounded-lg border border-white/15"
                />
              ) : (
                <div className="w-full h-48 bg-white/10 rounded-lg border border-white/15 flex items-center justify-center text-white/60">
                  Scene {currentScene.scene_number}
                </div>
              )}
              
              {/* Scene Narration */}
              <div className="mt-4 p-3 bg-white/5 rounded-lg border border-white/10">
                <p className="text-sm text-white/80 leading-relaxed">{currentScene.narration || currentScene.description}</p>
              </div>
              
              {/* Regenerate Button */}
              {currentScene.status === 'completed' && (
                <div className="flex justify-center">
                  <button
                    onClick={() => onRegenerateScene(currentScene.id)}
                    disabled={isRegenerating || isAssembling}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      isRegenerating || isAssembling 
                        ? 'bg-white/5 text-white/50 border-white/10 cursor-not-allowed' 
                        : 'bg-white/10 text-white border-white/20 hover:bg-white/15'
                    }`}
                  >
                    {isRegenerating && regeneratingSceneId === currentScene.id ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Regenerating...
                      </>
                    ) : (
                      'Regenerate Scene'
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Scene Thumbnails */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {scenes.map((scene, index) => (
          <button
            key={scene.id}
            onClick={() => setCurrentSceneIndex(index)}
            className={`flex-shrink-0 w-16 h-16 rounded-lg border-2 transition-all ${index === currentSceneIndex ? 'border-blue-400 bg-blue-400/10' : 'border-white/20 hover:border-white/40'} overflow-hidden`}
          >
            {scene.image_url ? (
              <img
                src={scene.image_url}
                alt={`Scene ${scene.scene_number}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-white/10 flex items-center justify-center text-xs text-white/60">
                {index + 1}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Keyboard Navigation Hint */}
      <div className="text-center text-xs text-white/50">
        Use ← → arrow keys to navigate between scenes
      </div>

      {allScenesCompleted && (
        <div className="mt-6 text-center">
          <button
            onClick={onAssembleVideo}
            disabled={isAssembling}
            className={`inline-flex items-center px-8 py-4 rounded-lg font-medium text-lg transition-all ${isAssembling ? 'bg-gradient-to-r from-purple-600/50 to-blue-600/50 cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg hover:shadow-xl'} text-white`}
          >
            {isAssembling ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Assembling Video...
              </>
            ) : (
              <>
                <Play className="mr-2 h-5 w-5" />
                Assemble Final Video
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}