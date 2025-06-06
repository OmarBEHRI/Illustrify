import React, { useState } from 'react';
import { Upload, File, Check, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';

interface DocumentUploaderProps {
  onUpload: (content: string) => void;
}

export const DocumentUploader: React.FC<DocumentUploaderProps> = ({ onUpload }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [content, setContent] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      handleFile(droppedFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      handleFile(selectedFile);
    }
  };

  const handleFile = (file: File) => {
    const validTypes = ['text/plain', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    
    if (!validTypes.includes(file.type)) {
      setError('Please upload a valid document (TXT, PDF, DOC, DOCX)');
      return;
    }
    
    setFile(file);
    setError('');
    
    // Simulate file reading
    setIsLoading(true);
    setTimeout(() => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        if (e.target && typeof e.target.result === 'string') {
          // For simplicity, we're just using the raw text content
          // In a real app, you'd need proper parsing for different file types
          setContent(e.target.result);
          setIsLoading(false);
        }
      };
      
      reader.onerror = () => {
        setError('Error reading file');
        setIsLoading(false);
      };
      
      reader.readAsText(file);
    }, 1000);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pastedText = e.clipboardData.getData('text');
    if (pastedText) {
      setContent(pastedText);
      setFile(null);
    }
  };

  const handleSubmit = () => {
    if (content.trim()) {
      onUpload(content);
    } else {
      setError('Please provide some content');
    }
  };

  return (
    <div className="space-y-6">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging 
            ? 'border-purple-500 bg-purple-900/10' 
            : 'border-purple-900/30 hover:border-purple-700/50'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="h-14 w-14 rounded-full bg-purple-900/20 flex items-center justify-center">
            <Upload className="h-7 w-7 text-purple-400" />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-white">Upload Your Document</h3>
            <p className="text-sm text-gray-400 max-w-xs mx-auto">
              Drag and drop your document, or click to browse
            </p>
          </div>
          
          <label className="cursor-pointer">
            <Button variant="outline" size="sm">
              Select Document
            </Button>
            <input 
              type="file" 
              className="hidden" 
              accept=".txt,.pdf,.doc,.docx"
              onChange={handleFileChange}
            />
          </label>
          
          <p className="text-xs text-gray-500">
            Supported formats: TXT, PDF, DOC, DOCX
          </p>
        </div>
      </div>
      
      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          <span className="ml-3 text-gray-400">Processing document...</span>
        </div>
      )}
      
      {file && !isLoading && (
        <div className="flex items-center p-3 bg-purple-900/10 border border-purple-900/30 rounded-lg">
          <div className="mr-3 h-10 w-10 rounded-full bg-purple-900/20 flex items-center justify-center">
            <File className="h-5 w-5 text-purple-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{file.name}</p>
            <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(2)} KB</p>
          </div>
          <Check className="h-5 w-5 text-green-500" />
        </div>
      )}
      
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">
          Or paste your content here:
        </label>
        <textarea 
          className="w-full h-40 px-4 py-2 bg-black/30 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-all"
          placeholder="Paste your document content here..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onPaste={handlePaste}
        ></textarea>
      </div>
      
      {error && (
        <div className="flex items-center p-3 bg-red-900/10 border border-red-900/30 text-red-400 rounded-lg">
          <AlertCircle className="h-5 w-5 mr-2" />
          <span>{error}</span>
        </div>
      )}
      
      <div className="flex justify-end">
        <Button 
          onClick={handleSubmit}
          disabled={!content.trim() || isLoading}
        >
          Continue
        </Button>
      </div>
    </div>
  );
};