import React from 'react';
import { cn } from '../../utils/cn';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { 
      className, 
      children, 
      variant = 'primary', 
      size = 'md', 
      isLoading = false,
      disabled,
      ...props 
    }, 
    ref
  ) => {
    const baseStyles = "font-medium rounded-lg transition-all duration-200 flex items-center justify-center";
    
    const variants = {
      primary: "bg-purple-600 hover:bg-purple-700 text-white border border-transparent",
      secondary: "bg-purple-200 hover:bg-purple-300 text-purple-900 border border-transparent",
      outline: "bg-transparent hover:bg-purple-950 text-purple-400 border border-purple-800",
      ghost: "bg-transparent hover:bg-white/10 text-white border border-transparent",
    };
    
    const sizes = {
      sm: "text-sm py-1 px-3",
      md: "text-base py-2 px-4",
      lg: "text-lg py-3 px-6",
    };
    
    const loadingState = isLoading ? "opacity-80 pointer-events-none" : "";
    const disabledState = disabled ? "opacity-50 cursor-not-allowed" : "";
    
    return (
      <button
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          loadingState,
          disabledState,
          className
        )}
        disabled={disabled || isLoading}
        ref={ref}
        {...props}
      >
        {isLoading ? (
          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";