import React from 'react';
import { FileText, Settings, Cpu, Palette, Share2, Clock } from 'lucide-react';

const features = [
  {
    name: 'Document Analysis',
    description: 'Intelligent parsing of your documents to identify key themes, topics, and narrative structure.',
    icon: FileText,
  },
  {
    name: 'Custom Workflows',
    description: 'Create and save custom workflows using ComfyUI nodes for consistent style across all your videos.',
    icon: Settings,
  },
  {
    name: 'Multiple AI Models',
    description: 'Choose from a variety of open-source AI models, including Stable Diffusion XL, Midjourney-like models, and more.',
    icon: Cpu,
  },
  {
    name: 'Style Customization',
    description: 'Fine-tune the visual style, pacing, and transitions to match your brand or creative vision.',
    icon: Palette,
  },
  {
    name: 'Easy Sharing',
    description: 'Share your creations directly to social media or download for further editing in video tools.',
    icon: Share2,
  },
  {
    name: 'Fast Processing',
    description: 'Our optimized pipeline ensures quick turnaround even for complex documents and high-quality outputs.',
    icon: Clock,
  },
];

export const FeaturesSection: React.FC = () => {
  return (
    <section className="bg-black py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Advanced Features</h2>
          <p className="max-w-2xl mx-auto text-lg text-gray-400">
            Powerful tools to transform your written content into engaging visual stories
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div 
              key={feature.name} 
              className="relative overflow-hidden rounded-xl border border-purple-900/20 bg-black/50 backdrop-blur-sm p-6 hover:border-purple-600/30 transition-all duration-300"
            >
              <div className="h-10 w-10 rounded-md bg-purple-900/20 flex items-center justify-center mb-4">
                <feature.icon className="h-5 w-5 text-purple-400" />
              </div>
              <h3 className="text-xl font-medium text-white mb-2">{feature.name}</h3>
              <p className="text-gray-400">{feature.description}</p>
              
              {/* Decorative gradient */}
              <div className="absolute -bottom-24 -right-24 w-40 h-40 bg-gradient-to-br from-purple-600/20 to-transparent rounded-full blur-xl"></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};