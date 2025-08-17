"""
Configuration module for minimal ComfyUI project
"""

import os
from pathlib import Path
from typing import List, Dict, Any

class Config:
    """Configuration class for the minimal ComfyUI project"""

    def __init__(self):
        # Base directories
        self.base_dir = Path(__file__).parent.absolute()
        self.models_dir = self.base_dir / "models"
        self.output_dir = self.base_dir / "output"
        self.temp_dir = self.base_dir / "temp"

        # Create directories if they don't exist
        self.output_dir.mkdir(exist_ok=True)
        self.temp_dir.mkdir(exist_ok=True)

        # Model subdirectories
        self.unet_dir = self.models_dir / "unet"
        self.text_encoders_dir = self.models_dir / "text_encoders"
        self.vae_dir = self.models_dir / "vae"

        # Supported file extensions
        self.supported_extensions = {
            "unet": {".gguf"},
            "text_encoders": {".gguf", ".safetensors", ".bin", ".pt"},
            "vae": {".safetensors", ".bin", ".pt", ".ckpt"}
        }

        # Device configuration
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.dtype = torch.float16 if self.device == "cuda" else torch.float32

        # Default workflow parameters
        self.default_params = {
            "positive_prompt": "A realistic photo of a chubby orange cat playing with a mouse toy in a green garden.",
            "negative_prompt": "jpeg compression",
            "steps": 1,
            "cfg": 4.5,
            "seed": 22,
            "width": 1280,
            "height": 768,
            "sampler_name": "euler",
            "scheduler": "normal",
            "denoise": 1.0
        }

    def get_available_models(self, model_type: str) -> List[str]:
        """Get list of available models for a given type"""
        if model_type not in self.supported_extensions:
            return []

        model_dir = getattr(self, f"{model_type}_dir")
        if not model_dir.exists():
            return []

        extensions = self.supported_extensions[model_type]
        models = []

        for file_path in model_dir.iterdir():
            if file_path.is_file() and file_path.suffix.lower() in extensions:
                models.append(file_path.name)

        return sorted(models)

    def get_model_path(self, model_type: str, model_name: str) -> Path:
        """Get full path to a model file"""
        model_dir = getattr(self, f"{model_type}_dir")
        return model_dir / model_name

    def validate_model_exists(self, model_type: str, model_name: str) -> bool:
        """Check if a model file exists"""
        model_path = self.get_model_path(model_type, model_name)
        return model_path.exists()

# Import torch here to avoid circular imports
import torch