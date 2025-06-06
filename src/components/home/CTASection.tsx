import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/Button';

export const CTASection: React.FC = () => {
  return (
    <section className="relative bg-black py-24 overflow-hidden">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-2xl overflow-hidden">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 via-black to-pink-900/40"></div>
          
          {/* Animated background elements */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -inset-[10px] opacity-50">
              <div className="absolute top-1/2 left-1/3 w-[300px] h-[300px] rounded-full bg-purple-600/30 blur-[80px] animate-pulse"></div>
              <div className="absolute bottom-1/3 right-1/3 w-[250px] h-[250px] rounded-full bg-pink-600/30 blur-[80px] animate-pulse delay-700"></div>
            </div>
          </div>
          
          {/* Content */}
          <div className="relative z-10 py-16 px-8 md:p-16 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to Transform Your Content?
            </h2>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
              Join thousands of creators and businesses who are already using Illustrify to create stunning video content from their documents.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/signup">
                <Button size="lg" className="w-full sm:w-auto">
                  Get Started For Free
                </Button>
              </Link>
              <Link to="/explore">
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  Explore Examples
                </Button>
              </Link>
            </div>
            
            <p className="mt-6 text-gray-400 text-sm">
              No credit card required. Free tier includes 3 videos per month.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};