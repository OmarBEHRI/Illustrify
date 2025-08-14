'use client';

import Navigation from './Navigation';

interface PageTemplateProps {
  children: React.ReactNode;
  className?: string;
}

export default function PageTemplate({ children, className = '' }: PageTemplateProps) {
  return (
    <main className={`min-h-screen px-6 md:px-10 py-6 ${className}`}>
      <Navigation />
      <div className="mt-8">
        {children}
      </div>
    </main>
  );
}