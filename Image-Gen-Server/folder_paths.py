"""
Simplified folder_paths module for minimal ComfyUI project
"""

import os
from pathlib import Path
from typing import List, Dict

# Base directories
base_path = Path(__file__).parent.absolute()
models_dir = base_path / "models"

# Folder mappings - ComfyUI format: (paths_list, extensions_set)
folder_names_and_paths = {
    "checkpoints": ([str(models_dir / "checkpoints")], {".safetensors", ".ckpt", ".pt"}),
    "configs": ([str(models_dir / "configs")], {".yaml", ".yml"}),
    "loras": ([str(models_dir / "loras")], {".safetensors", ".ckpt", ".pt"}),
    "vae": ([str(models_dir / "vae")], {".safetensors", ".ckpt", ".pt"}),
    "clip": ([str(models_dir / "text_encoders")], {".safetensors", ".ckpt", ".pt"}),
    "text_encoders": ([str(models_dir / "text_encoders")], {".safetensors", ".ckpt", ".pt"}),
    "unet": ([str(models_dir / "unet")], {".safetensors", ".ckpt", ".pt"}),
    "diffusion_models": ([str(models_dir / "unet")], {".safetensors", ".ckpt", ".pt"}),
    "clip_vision": ([str(models_dir / "clip_vision")], {".safetensors", ".ckpt", ".pt"}),
    "style_models": ([str(models_dir / "style_models")], {".safetensors", ".ckpt", ".pt"}),
    "embeddings": ([str(models_dir / "embeddings")], {".safetensors", ".ckpt", ".pt"}),
    "diffusers": ([str(models_dir / "diffusers")], {}),
    "vae_approx": ([str(models_dir / "vae_approx")], {".safetensors", ".ckpt", ".pt"}),
    "controlnet": ([str(models_dir / "controlnet")], {".safetensors", ".ckpt", ".pt"}),
    "gligen": ([str(models_dir / "gligen")], {".safetensors", ".ckpt", ".pt"}),
    "upscale_models": ([str(models_dir / "upscale_models")], {".safetensors", ".ckpt", ".pt"}),
    "custom_nodes": ([str(base_path / "custom_nodes")], {}),
    "hypernetworks": ([str(models_dir / "hypernetworks")], {".safetensors", ".ckpt", ".pt"}),
    "photomaker": ([str(models_dir / "photomaker")], {".safetensors", ".ckpt", ".pt"}),
    "classifiers": ([str(models_dir / "classifiers")], {".safetensors", ".ckpt", ".pt"}),
}

def get_folder_paths(folder_name: str) -> List[str]:
    """Get folder paths for a given folder name"""
    entry = folder_names_and_paths.get(folder_name, ([], {}))
    return entry[0] if isinstance(entry, tuple) else entry

def get_filename_list(folder_name: str) -> List[str]:
    """Get list of files in a folder"""
    entry = folder_names_and_paths.get(folder_name, ([], {}))
    paths = entry[0] if isinstance(entry, tuple) else entry
    extensions = entry[1] if isinstance(entry, tuple) and len(entry) > 1 else set()

    files = []

    for path in paths:
        if os.path.exists(path):
            for file in os.listdir(path):
                if os.path.isfile(os.path.join(path, file)):
                    # Check extensions if specified
                    if not extensions or any(file.lower().endswith(ext) for ext in extensions):
                        files.append(file)

    return sorted(files)

def get_full_path(folder_name: str, filename: str) -> str:
    """Get full path to a file"""
    paths = get_folder_paths(folder_name)

    for path in paths:
        full_path = os.path.join(path, filename)
        if os.path.exists(full_path):
            return full_path

    # If not found, return path in first directory
    if paths:
        return os.path.join(paths[0], filename)

    return filename

def add_model_folder_path(folder_name: str, full_folder_path: str):
    """Add a model folder path"""
    if folder_name in folder_names_and_paths:
        current_entry = folder_names_and_paths[folder_name]
        if isinstance(current_entry, tuple):
            paths, extensions = current_entry
            paths.append(full_folder_path)
            folder_names_and_paths[folder_name] = (paths, extensions)
        else:
            folder_names_and_paths[folder_name] = ([full_folder_path], {})
    else:
        folder_names_and_paths[folder_name] = ([full_folder_path], {})

def get_save_image_path(filename_prefix: str, output_dir: str = None, image_width: int = 0, image_height: int = 0) -> tuple:
    """Get save image path and filename"""
    if output_dir is None:
        output_dir = str(base_path / "output")

    os.makedirs(output_dir, exist_ok=True)

    counter = 1
    while True:
        filename = f"{filename_prefix}_{counter:05d}.png"
        full_path = os.path.join(output_dir, filename)
        if not os.path.exists(full_path):
            break
        counter += 1

    return full_path, filename, counter, output_dir