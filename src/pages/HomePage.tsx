import React from 'react';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { Hero } from '../components/home/Hero';
import { FeaturesSection } from '../components/home/FeaturesSection';
import { WorkflowSection } from '../components/home/WorkflowSection';
import { TestimonialSection } from '../components/home/TestimonialSection';
import { CTASection } from '../components/home/CTASection';

export const HomePage: React.FC = () => {
  return (
    <div className="bg-black min-h-screen text-white">
      <Navbar />
      
      <main>
        <Hero />
        <FeaturesSection />
        <WorkflowSection />
        <TestimonialSection />
        <CTASection />
      </main>
      
      <Footer />
    </div>
  );
};