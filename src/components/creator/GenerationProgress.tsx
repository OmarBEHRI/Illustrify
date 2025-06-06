import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';

interface GenerationProgressProps {
  onComplete: (videoUrl: string) => void;
}

export const GenerationProgress: React.FC<GenerationProgressProps> = ({ onComplete }) => {
  const stageVisuals: { [key: string]: string } = {
    'Analyzing content': 'https://picsum.photos/seed/analyzing_doc/640/360',
    'Generating images': 'https://picsum.photos/seed/gen_images/640/360',
    'Creating frames': 'https://picsum.photos/seed/anim_frames/640/360',
    'Composing video': 'https://picsum.photos/seed/compose_video/640/360',
    'Finalizing': 'https://picsum.photos/seed/finalize_render/640/360',
  };
  const completedVideoThumbnail = 'https://picsum.photos/seed/final_video_thumb/640/360';

  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState('Analyzing content');
  const [isComplete, setIsComplete] = useState(false);

  const stages = [
    'Analyzing content',
    'Generating images',
    'Creating frames',
    'Composing video',
    'Finalizing'
  ];

  useEffect(() => {
    // Simulate generation process
    const interval = setInterval(() => {
      setProgress((prevProgress) => {
        if (prevProgress >= 100) {
          clearInterval(interval);
          setIsComplete(true);
          return 100;
        }
        
        // Update current stage based on progress
        const newProgress = prevProgress + 1;
        const stageIndex = Math.min(
          Math.floor((newProgress / 100) * stages.length),
          stages.length - 1
        );
        setCurrentStage(stages[stageIndex]);
        
        return newProgress;
      });
    }, 150); // Adjust timing for demo purposes

    return () => clearInterval(interval);
  }, []);

  const handleComplete = () => {
    // In a real app, this would return the actual video URL
    onComplete('https://example.com/generated-video.mp4');
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-xl font-bold text-white mb-2">Generating Your Video</h3>
        <p className="text-gray-400">
          Please wait while we process your content and generate your video.
        </p>
      </div>
      
      {/* Progress indicator */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-purple-400">{currentStage}</span>
          <span className="text-white">{progress}%</span>
        </div>
        
        <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden">
          <div 
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-600 to-pink-600 transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>
      
      {/* Visual representation of progress */}
      <div className="grid grid-cols-5 gap-2">
        {stages.map((stage, index) => {
          const stageProgress = Math.min(100, Math.max(0, 
            progress - (index * (100 / stages.length)) 
          ) * (stages.length));
          
          const isActive = progress >= (index * (100 / stages.length));
          const isCompleted = stageProgress >= (100 / stages.length);
          
          return (
            <div key={stage} className="space-y-1">
              <div 
                className={`h-1 rounded-full transition-colors duration-300 ${
                  isActive ? 'bg-purple-600' : 'bg-gray-800'
                }`}
              ></div>
              <p className={`text-xs ${
                isActive ? 'text-purple-400' : 'text-gray-500'
              }`}>
                {stage}
              </p>
            </div>
          );
        })}
      </div>
      
      {/* Visual animation */}
      <div className="flex justify-center py-8">
        <div className="relative rounded-lg overflow-hidden w-full max-w-md aspect-video bg-gray-900 border border-purple-900/50 flex items-center justify-center">
          {isComplete ? (
            <>
              <img 
                src={completedVideoThumbnail} 
                alt="Generated Video Thumbnail" 
                className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ease-in-out opacity-100"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-white opacity-80 hover:opacity-100 transition-opacity cursor-pointer" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="absolute bottom-4 left-4 right-4 p-2 bg-black bg-opacity-50 rounded">
                 <h4 className="text-lg font-medium text-white text-center">Video Ready! Click to 'View Result'</h4>
              </div>
            </>
          ) : (
            <>
              {stageVisuals[currentStage] && (
                <img 
                  key={currentStage} /* Force re-render for transition */
                  src={stageVisuals[currentStage]} 
                  alt={`Generating: ${currentStage}`} 
                  className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out opacity-0 animate-fadeIn"
                />
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-10">
                {/* Optional: Add an overlay spinner or text if image loading is slow */}
              </div>
            </>
          )}
        </div>
      </div>
      {/* Add simple fade-in animation for images */}
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          .animate-fadeIn {
            animation: fadeIn 1s ease-in-out;
          }
        `}
      </style>
      
      <div className="flex justify-end">
        <Button 
          onClick={handleComplete}
          disabled={!isComplete}
        >
          {isComplete ? 'View Result' : 'Processing...'}
        </Button>
      </div>
    </div>
  );
};