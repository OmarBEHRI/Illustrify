import React from 'react';
import { cn } from '../../utils/cn';

interface CardProps {
  className?: string;
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ className, children }) => {
  return (
    <div 
      className={cn(
        "bg-black/40 backdrop-blur-sm border border-purple-900/50 rounded-xl p-4 transition-all duration-300 hover:border-purple-700/50", 
        className
      )}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<CardProps> = ({ className, children }) => {
  return (
    <div className={cn("mb-2", className)}>
      {children}
    </div>
  );
};

export const CardTitle: React.FC<CardProps> = ({ className, children }) => {
  return (
    <h3 className={cn("text-xl font-bold text-white", className)}>
      {children}
    </h3>
  );
};

export const CardDescription: React.FC<CardProps> = ({ className, children }) => {
  return (
    <p className={cn("text-gray-400 text-sm", className)}>
      {children}
    </p>
  );
};

export const CardContent: React.FC<CardProps> = ({ className, children }) => {
  return (
    <div className={cn("py-2", className)}>
      {children}
    </div>
  );
};

export const CardFooter: React.FC<CardProps> = ({ className, children }) => {
  return (
    <div className={cn("mt-4 flex items-center", className)}>
      {children}
    </div>
  );
};