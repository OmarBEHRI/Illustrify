import React from 'react';
import { Link } from 'react-router-dom';
import { Play, Heart, Eye } from 'lucide-react';
import { Project } from '../../types';

interface ProjectCardProps {
  project: Project;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project }) => {
  return (
    <div className="group relative rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-1">
      {/* Thumbnail */}
      <div className="aspect-video relative overflow-hidden">
        <img 
          src={project.thumbnail} 
          alt={project.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="absolute inset-0 flex items-center justify-center">
            <Link 
              to={`/project/${project.id}`}
              className="w-14 h-14 rounded-full bg-purple-600/80 flex items-center justify-center"
            >
              <Play className="h-6 w-6 text-white" />
            </Link>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4 bg-black/70 backdrop-blur-sm border border-purple-900/20">
        <Link to={`/project/${project.id}`} className="block">
          <h3 className="text-lg font-medium text-white truncate mb-1">
            {project.title}
          </h3>
        </Link>
        <p className="text-gray-400 text-sm line-clamp-2 mb-3">
          {project.description}
        </p>
        
        {/* Meta info */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4 text-gray-400">
            <div className="flex items-center">
              <Eye className="h-4 w-4 mr-1" />
              <span>{project.views}</span>
            </div>
            <div className="flex items-center">
              <Heart className="h-4 w-4 mr-1" />
              <span>{project.likes}</span>
            </div>
          </div>
          <span className="text-gray-500">
            {new Date(project.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  );
};