import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/Button';
import { ArrowRight, FileText, Video } from 'lucide-react';

export const Hero: React.FC = () => {
  return (
    <div className="relative overflow-hidden bg-black">
      {/* Animated gradient background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -inset-[10px] opacity-30">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-purple-600 blur-[100px] animate-pulse"></div>
          <div className="absolute top-1/4 right-1/4 w-[300px] h-[300px] rounded-full bg-blue-600 blur-[100px] animate-pulse delay-700"></div>
          <div className="absolute bottom-1/3 left-1/3 w-[400px] h-[400px] rounded-full bg-pink-600 blur-[100px] animate-pulse delay-1000"></div>
        </div>
      </div>
      
      {/* Content */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20 md:pt-40 md:pb-28">
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white mb-6">
            <span className="block">Transform Documents Into</span>
            <span className="block mt-2 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Stunning Video Content
            </span>
          </h1>
          
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-gray-300 mb-10">
            Harness the power of open-source AI models like Stable Diffusion and ComfyUI to convert your written content into engaging videos.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/create">
              <Button size="lg" className="w-full sm:w-auto group">
                Start Creating Now
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link to="/how-it-works">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                How It Works
              </Button>
            </Link>
          </div>
        </div>
        
        {/* Features preview */}
        <div className="mt-20 relative">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-purple-900/30"></div>
          </div>
          <div className="relative flex justify-center">
            <span className="bg-black px-3 text-lg font-medium text-white">Powerful Features</span>
          </div>
        </div>
        
        <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative p-6 bg-black/80 border border-purple-900/50 rounded-lg">
              <div className="flex items-center justify-center h-12 w-12 rounded-md bg-purple-500/20 text-purple-400 mb-4">
                <FileText className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Document Processing</h3>
              <p className="text-gray-400">
                Upload and process any text document. Our AI analyzes and segments your content for optimal visual storytelling.
              </p>
            </div>
          </div>
          
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative p-6 bg-black/80 border border-purple-900/50 rounded-lg">
              <div className="flex items-center justify-center h-12 w-12 rounded-md bg-blue-500/20 text-blue-400 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                  <path d="M3 7v6h6"></path>
                  <path d="M21 17V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v10"></path>
                  <path d="M3 17a2 2 0 0 0 2 2h16"></path>
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">AI Image Generation</h3>
              <p className="text-gray-400">
                Leveraging open-source models like Stable Diffusion to create stunning visuals that match your content.
              </p>
            </div>
          </div>
          
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-600 to-orange-600 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative p-6 bg-black/80 border border-purple-900/50 rounded-lg">
              <div className="flex items-center justify-center h-12 w-12 rounded-md bg-pink-500/20 text-pink-400 mb-4">
                <Video className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Video Composition</h3>
              <p className="text-gray-400">
                Automatically compile generated images, text overlays, and optional audio into a cohesive video presentation.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};