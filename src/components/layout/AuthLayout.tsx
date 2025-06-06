import React from 'react';
import { Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  description: string;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ 
  children, 
  title, 
  description 
}) => {
  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row">
      {/* Left side (form) */}
      <div className="w-full md:w-1/2 flex flex-col items-center justify-center px-6 py-12 lg:px-8 bg-black">
        <div className="sm:mx-auto sm:w-full sm:max-w-sm">
          <Link to="/" className="flex items-center justify-center space-x-2 mb-8">
            <Zap className="h-10 w-10 text-purple-500" />
            <span className="text-white font-bold text-2xl">Illustrify</span>
          </Link>
          <h2 className="text-center text-3xl font-bold text-white">{title}</h2>
          <p className="mt-2 text-center text-gray-400">{description}</p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-sm">
          {children}
        </div>
      </div>
      
      {/* Right side (image/graphics) */}
      <div className="hidden md:block w-1/2 bg-gradient-to-br from-black via-purple-900/30 to-black relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.pexels.com/photos/8386440/pexels-photo-8386440.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1')] bg-cover bg-center opacity-30"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-black via-transparent to-black"></div>
        <div className="absolute inset-0 flex items-center justify-center p-12">
          <div className="text-center max-w-lg">
            <h3 className="text-3xl font-bold text-white mb-4">Transform Your Content</h3>
            <p className="text-lg text-gray-300">
              Easily convert your documents and written content into engaging video content with the power of AI.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};