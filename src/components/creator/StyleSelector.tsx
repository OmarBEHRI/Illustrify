import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '../ui/Button';

interface StyleOption {
  id: string;
  name: string;
  description: string;
  preview: string;
}

interface StyleSelectorProps {
  onSelect: (styleId: string) => void;
  onContinue: () => void;
}

export const StyleSelector: React.FC<StyleSelectorProps> = ({ onSelect, onContinue }) => {
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);

  const styleOptions: StyleOption[] = [
    {
      id: 'cinematic',
      name: 'Cinematic',
      description: 'Movie-like quality with dramatic lighting and composition',
      preview: 'https://images.pexels.com/photos/3062541/pexels-photo-3062541.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1'
    },
    {
      id: 'digital-art',
      name: 'Digital Art',
      description: 'Vibrant digital illustrations with modern aesthetic',
      preview: 'https://images.pexels.com/photos/7005280/pexels-photo-7005280.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1'
    },
    {
      id: 'photorealistic',
      name: 'Photorealistic',
      description: 'Highly detailed images that look like real photographs',
      preview: 'https://images.pexels.com/photos/1535162/pexels-photo-1535162.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1'
    },
    {
      id: 'anime',
      name: 'Anime',
      description: 'Japanese animation style with distinctive visual elements',
      preview: 'https://images.pexels.com/photos/5011647/pexels-photo-5011647.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1'
    },
    {
      id: 'abstract',
      name: 'Abstract',
      description: 'Non-representational art using shapes, colors, and textures',
      preview: 'https://images.pexels.com/photos/2110951/pexels-photo-2110951.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1'
    },
    {
      id: 'watercolor',
      name: 'Watercolor',
      description: 'Soft, dreamy images mimicking watercolor painting techniques',
      preview: 'https://images.pexels.com/photos/1616403/pexels-photo-1616403.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1'
    },
  ];

  const handleStyleSelect = (styleId: string) => {
    setSelectedStyle(styleId);
    onSelect(styleId);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-white mb-2">Choose a Visual Style</h3>
        <p className="text-gray-400">
          Select a style that best matches the mood and tone of your content.
        </p>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {styleOptions.map((style) => (
          <div 
            key={style.id}
            className={`relative cursor-pointer rounded-lg overflow-hidden transition-all duration-300 border-2 ${
              selectedStyle === style.id 
                ? 'border-purple-500 shadow-lg shadow-purple-500/20' 
                : 'border-transparent hover:border-purple-700/50'
            }`}
            onClick={() => handleStyleSelect(style.id)}
          >
            {/* Preview image */}
            <div className="aspect-video relative">
              <img 
                src={style.preview} 
                alt={style.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent opacity-70"></div>
            </div>
            
            {/* Content */}
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <h4 className="text-white font-medium">{style.name}</h4>
              <p className="text-gray-300 text-sm">{style.description}</p>
            </div>
            
            {/* Selected indicator */}
            {selectedStyle === style.id && (
              <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-purple-600 flex items-center justify-center">
                <Check className="h-4 w-4 text-white" />
              </div>
            )}
          </div>
        ))}
      </div>
      
      <div className="flex justify-end">
        <Button 
          onClick={onContinue}
          disabled={!selectedStyle}
        >
          Continue
        </Button>
      </div>
    </div>
  );
};