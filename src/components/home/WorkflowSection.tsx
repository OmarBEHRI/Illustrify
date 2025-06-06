import React from 'react';
import { ArrowRight } from 'lucide-react';

export const WorkflowSection: React.FC = () => {
  const steps = [
    {
      number: '01',
      title: 'Upload Your Document',
      description: 'Import your text document, blog post, script, or any written content into our platform.',
    },
    {
      number: '02',
      title: 'AI Analysis',
      description: 'Our AI analyzes your content to understand structure, key points, and visual opportunities.',
    },
    {
      number: '03',
      title: 'Image Generation',
      description: 'Using open-source AI models, we generate custom images that visualize your content.',
    },
    {
      number: '04',
      title: 'Video Composition',
      description: 'Images are arranged into a video sequence with text overlays, transitions, and optional audio.',
    },
  ];

  return (
    <section className="relative bg-black py-24 overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-purple-900/20 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-900/20 rounded-full blur-[100px]"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">How It Works</h2>
          <p className="max-w-2xl mx-auto text-lg text-gray-400">
            Four simple steps to transform your documents into engaging video content
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <div 
              key={step.number} 
              className="relative"
            >
              <div className="rounded-xl border border-purple-900/30 bg-black/50 backdrop-blur-sm p-6 h-full flex flex-col group hover:border-purple-600/50 transition-all duration-300">
                <div className="mb-4">
                  <span className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                    {step.number}
                  </span>
                </div>
                <h3 className="text-xl font-medium text-white mb-3">{step.title}</h3>
                <p className="text-gray-400 mb-4">{step.description}</p>
                
                {index < steps.length - 1 && (
                  <div className="hidden lg:flex items-center justify-center absolute -right-4 top-1/2 transform -translate-y-1/2 z-10">
                    <ArrowRight className="h-6 w-6 text-purple-500" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-20 max-w-3xl mx-auto text-center">
          <h3 className="text-2xl font-bold text-white mb-4">Ready to Get Started?</h3>
          <p className="text-gray-400 mb-8">
            Join thousands of content creators who are already using Illustrify to transform their content into engaging videos.
          </p>
          <a 
            href="#" 
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 transition-colors duration-200"
          >
            Try It For Free
          </a>
        </div>
      </div>
    </section>
  );
};