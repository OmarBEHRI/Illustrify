import React, { createContext, useState, useEffect } from 'react';
import { AuthState, User } from '../types';

// Mock data - in a real app, this would be handled by a backend service
const MOCK_USER: User = {
  id: '1',
  name: 'Demo User',
  email: 'user@example.com',
  avatar: 'https://images.pexels.com/photos/2379005/pexels-photo-2379005.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1',
};

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  signup: async () => {},
  logout: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    // Check for saved authentication in localStorage
    const savedUser = localStorage.getItem('illustrify_user');
    
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        setAuthState({
          user,
          isAuthenticated: true,
          isLoading: false,
        });
      } catch (error) {
        console.error('Failed to parse user data:', error);
        localStorage.removeItem('illustrify_user');
        setAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    } else {
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  }, []);

  const login = async (email: string, password: string) => {
    // In a real app, this would call an API endpoint
    // For demo, we're just using the mock user
    
    // Simulate API call
    setAuthState(prev => ({ ...prev, isLoading: true }));
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Fake validation
    if (email.trim() === '' || password.trim() === '') {
      throw new Error('Please enter both email and password');
    }
    
    // Save to localStorage and update state
    localStorage.setItem('illustrify_user', JSON.stringify(MOCK_USER));
    
    setAuthState({
      user: MOCK_USER,
      isAuthenticated: true,
      isLoading: false,
    });
  };

  const signup = async (name: string, email: string, password: string) => {
    // In a real app, this would call an API endpoint
    // For demo, we're just using the mock user
    
    // Simulate API call
    setAuthState(prev => ({ ...prev, isLoading: true }));
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Fake validation
    if (name.trim() === '' || email.trim() === '' || password.trim() === '') {
      throw new Error('Please fill in all fields');
    }
    
    // Create a new user with the provided name
    const newUser = {
      ...MOCK_USER,
      name,
      email,
    };
    
    // Save to localStorage and update state
    localStorage.setItem('illustrify_user', JSON.stringify(newUser));
    
    setAuthState({
      user: newUser,
      isAuthenticated: true,
      isLoading: false,
    });
  };

  const logout = () => {
    localStorage.removeItem('illustrify_user');
    setAuthState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  };

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};