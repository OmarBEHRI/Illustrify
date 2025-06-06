import React from 'react';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { ProjectGrid } from '../components/gallery/ProjectGrid';
import { mockProjects } from '../data/mockProjects';

export const ExplorePage: React.FC = () => {
  return (
    <div className="bg-black min-h-screen text-white">
      <Navbar />
      
      <main className="pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <h1 className="text-3xl font-bold text-white mb-4">Explore Projects</h1>
            <p className="text-gray-400 max-w-2xl">
              Discover videos created by the Illustrify community. Get inspired and see what's possible with AI-powered document-to-video technology.
            </p>
          </div>
          
          {/* Featured Projects */}
          <section className="mb-12">
            <ProjectGrid 
              projects={mockProjects.slice(0, 3)} 
              title="Featured Projects"
            />
          </section>
          
          {/* Recent Projects */}
          <section>
            <ProjectGrid 
              projects={mockProjects.slice(3)} 
              title="Recent Projects"
            />
          </section>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};