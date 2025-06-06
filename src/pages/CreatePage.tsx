import React, { useState } from 'react';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { DocumentUploader } from '../components/creator/DocumentUploader';
import { StyleSelector } from '../components/creator/StyleSelector';
import { GenerationProgress } from '../components/creator/GenerationProgress';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { useNavigate } from 'react-router-dom';

type CreationStep = 'upload' | 'style' | 'generate' | 'complete';

export const CreatePage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<CreationStep>('upload');
  const [documentContent, setDocumentContent] = useState<string>('');
  const [selectedStyle, setSelectedStyle] = useState<string>('');
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string>('');
  const navigate = useNavigate();

  const handleDocumentUpload = (content: string) => {
    setDocumentContent(content);
    setCurrentStep('style');
  };

  const handleStyleSelect = (styleId: string) => {
    setSelectedStyle(styleId);
  };

  const handleStyleContinue = () => {
    setCurrentStep('generate');
  };

  const handleGenerationComplete = (videoUrl: string) => {
    setGeneratedVideoUrl(videoUrl);
    setCurrentStep('complete');
  };

  const resetCreation = () => {
    setDocumentContent('');
    setSelectedStyle('');
    setGeneratedVideoUrl('');
    setCurrentStep('upload');
  };

  const viewProject = () => {
    // In a real app, this would navigate to the project page
    navigate('/explore');
  };

  return (
    <div className="bg-black min-h-screen text-white">
      <Navbar />
      
      <main className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <h1 className="text-3xl font-bold text-white mb-4">Create a Video</h1>
            <p className="text-gray-400">
              Transform your document or written content into an engaging video with AI-powered visuals.
            </p>
          </div>
          
          {/* Steps indicator */}
          <div className="mb-8">
            <div className="flex items-center">
              {['upload', 'style', 'generate', 'complete'].map((step, index) => (
                <React.Fragment key={step}>
                  {/* Step indicator */}
                  <div className="flex flex-col items-center">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                      currentStep === step 
                        ? 'bg-purple-600 text-white' 
                        : (index < ['upload', 'style', 'generate', 'complete'].indexOf(currentStep as CreationStep))
                          ? 'bg-purple-900 text-purple-300'
                          : 'bg-gray-800 text-gray-500'
                    }`}>
                      {index + 1}
                    </div>
                    <span className={`text-xs mt-1 ${
                      currentStep === step 
                        ? 'text-purple-400' 
                        : (index < ['upload', 'style', 'generate', 'complete'].indexOf(currentStep as CreationStep))
                          ? 'text-purple-600'
                          : 'text-gray-600'
                    }`}>
                      {step.charAt(0).toUpperCase() + step.slice(1)}
                    </span>
                  </div>
                  
                  {/* Connector line */}
                  {index < 3 && (
                    <div className="flex-1 h-0.5 mx-2 md:mx-4">
                      <div className={`h-full ${
                        index < ['upload', 'style', 'generate', 'complete'].indexOf(currentStep as CreationStep)
                          ? 'bg-purple-600'
                          : 'bg-gray-800'
                      }`}></div>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
          
          {/* Content based on current step */}
          <Card>
            <CardHeader>
              <CardTitle>
                {currentStep === 'upload' && 'Upload Your Document'}
                {currentStep === 'style' && 'Choose a Style'}
                {currentStep === 'generate' && 'Generating Video'}
                {currentStep === 'complete' && 'Video Complete'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {currentStep === 'upload' && (
                <DocumentUploader onUpload={handleDocumentUpload} />
              )}
              
              {currentStep === 'style' && (
                <StyleSelector onSelect={handleStyleSelect} onContinue={handleStyleContinue} />
              )}
              
              {currentStep === 'generate' && (
                <GenerationProgress onComplete={handleGenerationComplete} />
              )}
              
              {currentStep === 'complete' && (
                <div className="space-y-6 text-center">
                  <div className="bg-green-900/20 border border-green-900/30 rounded-lg py-4 px-6">
                    <h3 className="text-xl font-medium text-white mb-2">Video Generated Successfully!</h3>
                    <p className="text-gray-400">
                      Your document has been transformed into a video.
                    </p>
                  </div>
                  
                  <div className="flex justify-center space-x-4">
                    <button
                      onClick={resetCreation}
                      className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
                    >
                      Create Another
                    </button>
                    <button
                      onClick={viewProject}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                    >
                      View Project
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};