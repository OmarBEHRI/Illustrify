"""
Simplified ComfyUI nodes for minimal implementation
Contains only the essential nodes needed for the Qwen workflow
"""

import torch
import logging
import sys
import os
from pathlib import Path
from typing import Tuple, Any, Dict

# Setup logging first
logger = logging.getLogger(__name__)

# Add the current directory to Python path for imports
current_dir = Path(__file__).parent.absolute()
sys.path.insert(0, str(current_dir))

try:
    import comfy.sd
    import comfy.utils
    import comfy.sample
    import comfy.samplers
    import comfy.model_management
    import comfy.latent_formats
    import folder_paths
    COMFY_AVAILABLE = True
    logger.info("ComfyUI modules loaded successfully")
except ImportError as e:
    # Fallback implementations for testing
    logger.warning(f"ComfyUI modules not found: {e}, using fallback implementations")
    COMFY_AVAILABLE = False

class CLIPTextEncode:
    """CLIP Text Encoder node"""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text": ("STRING", {"multiline": True}),
                "clip": ("CLIP",)
            }
        }

    RETURN_TYPES = ("CONDITIONING",)
    FUNCTION = "encode"
    CATEGORY = "conditioning"

    def encode(self, clip, text: str) -> Tuple[Any]:
        """Encode text using CLIP model"""
        if clip is None:
            raise RuntimeError("ERROR: clip input is invalid: None")

        try:
            tokens = clip.tokenize(text)
            conditioning = clip.encode_from_tokens_scheduled(tokens)
            return (conditioning,)
        except Exception as e:
            logger.error(f"Error encoding text: {str(e)}")
            raise

class VAELoader:
    """VAE Loader node"""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "vae_name": ("STRING",)
            }
        }

    RETURN_TYPES = ("VAE",)
    FUNCTION = "load_vae"
    CATEGORY = "loaders"

    def load_vae(self, vae_name: str) -> Tuple[Any]:
        """Load VAE model"""
        try:
            if not COMFY_AVAILABLE:
                logger.warning("Using fallback VAE loader")
                return (None,)

            from config import Config
            config = Config()
            vae_path = config.get_model_path("vae", vae_name)

            if not vae_path.exists():
                raise FileNotFoundError(f"VAE model not found: {vae_path}")

            # Load using ComfyUI's VAE loader (mirror ComfyUI's VAELoader)
            from folder_paths import get_full_path
            vae_path_str = get_full_path("vae", vae_name)
            if not os.path.exists(vae_path_str):
                raise FileNotFoundError(f"VAE model not found: {vae_path_str}")
            sd = comfy.utils.load_torch_file(vae_path_str)
            vae = comfy.sd.VAE(sd=sd)
            # Optionally validate
            if hasattr(vae, "throw_exception_if_invalid"):
                vae.throw_exception_if_invalid()
            return (vae,)

        except Exception as e:
            logger.error(f"Error loading VAE: {str(e)}")
            raise

class KSampler:
    """K-Sampler node"""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "model": ("MODEL",),
                "seed": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
                "steps": ("INT", {"default": 20, "min": 1, "max": 10000}),
                "cfg": ("FLOAT", {"default": 8.0, "min": 0.0, "max": 100.0}),
                "sampler_name": ("STRING", {"default": "euler"}),
                "scheduler": ("STRING", {"default": "normal"}),
                "positive": ("CONDITIONING",),
                "negative": ("CONDITIONING",),
                "latent_image": ("LATENT",),
                "denoise": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 1.0})
            }
        }

    RETURN_TYPES = ("LATENT",)
    FUNCTION = "sample"
    CATEGORY = "sampling"

    def sample(self, model, seed: int, steps: int, cfg: float, sampler_name: str,
               scheduler: str, positive, negative, latent_image, denoise: float = 1.0) -> Tuple[Dict]:
        """Sample using the model"""
        try:
            if COMFY_AVAILABLE:
                return self._comfy_sample(model, seed, steps, cfg, sampler_name,
                                        scheduler, positive, negative, latent_image, denoise)
            else:
                # Fallback for testing
                logger.warning("Using fallback sampler")
                return (latent_image,)

        except Exception as e:
            logger.error(f"Error during sampling: {str(e)}")
            raise

    def _comfy_sample(self, model, seed, steps, cfg, sampler_name, scheduler,
                     positive, negative, latent_image, denoise):
        """Use ComfyUI's sampling implementation"""
        import random

        # Set random seed
        torch.manual_seed(seed)
        random.seed(seed)

        latent = latent_image["samples"]

        # Get the sampler
        sampler = comfy.samplers.KSampler(model, steps=steps, device=model.load_device, sampler=sampler_name, scheduler=scheduler, denoise=denoise, model_options=model.model_options)

        # Prepare noise
        noise = torch.randn_like(latent)

        # Sample
        samples = sampler.sample(noise, positive, negative, cfg=cfg, latent_image=latent, start_step=0, last_step=steps, force_full_denoise=denoise == 1.0)

        out = latent_image.copy()
        out["samples"] = samples
        return (out,)

class VAEDecode:
    """VAE Decoder node"""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "samples": ("LATENT",),
                "vae": ("VAE",)
            }
        }

    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "decode"
    CATEGORY = "latent"

    def decode(self, vae, samples: Dict) -> Tuple[torch.Tensor]:
        """Decode latent samples to images"""
        try:
            if vae is None:
                raise RuntimeError("ERROR: vae input is invalid: None")

            images = vae.decode(samples["samples"])
            if len(images.shape) == 5:  # Combine batches
                images = images.reshape(-1, images.shape[-3], images.shape[-2], images.shape[-1])
            return (images,)

        except Exception as e:
            logger.error(f"Error decoding VAE: {str(e)}")
            raise

class PreviewImage:
    """Preview Image node (simplified)"""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "images": ("IMAGE",)
            }
        }

    RETURN_TYPES = ()
    FUNCTION = "save_images"
    CATEGORY = "image"

    def save_images(self, images: torch.Tensor):
        """Save images (simplified implementation)"""
        # This is a placeholder - in the real implementation,
        # this would save images to the temp directory
        logger.info(f"Preview image called with tensor shape: {images.shape}")
        return {}

class EmptySD3LatentImage:
    """Empty SD3 Latent Image node"""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "width": ("INT", {"default": 1024, "min": 16, "max": 16384, "step": 8}),
                "height": ("INT", {"default": 1024, "min": 16, "max": 16384, "step": 8}),
                "batch_size": ("INT", {"default": 1, "min": 1, "max": 4096})
            }
        }

    RETURN_TYPES = ("LATENT",)
    FUNCTION = "generate"
    CATEGORY = "latent"

    def generate(self, width: int, height: int, batch_size: int = 1) -> Tuple[Dict]:
        """Generate empty latent for SD3/Flux models"""
        try:
            # SD3/Flux uses 16 channels, 8x8 downsampling
            if COMFY_AVAILABLE and hasattr(comfy.model_management, 'intermediate_device'):
                device = comfy.model_management.intermediate_device()
            else:
                device = 'cpu'

            latent = torch.zeros([batch_size, 16, height // 8, width // 8], device=device)
            return ({"samples": latent},)
        except Exception as e:
            logger.error(f"Error generating SD3 latent: {str(e)}")
            raise

class DualCLIPLoader:
    """Dual CLIP Loader for Flux models"""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "clip_name1": ("STRING",),
                "clip_name2": ("STRING",),
                "type": ("STRING", {"default": "flux"})
            }
        }

    RETURN_TYPES = ("CLIP",)
    FUNCTION = "load_clip"
    CATEGORY = "loaders"

    def load_clip(self, clip_name1: str, clip_name2: str, type: str = "flux") -> Tuple[Any]:
        """Load dual CLIP models for Flux"""
        try:
            if not COMFY_AVAILABLE:
                logger.warning("Using fallback dual CLIP loader")
                return (None,)

            from config import Config
            config = Config()

            # Get paths for both CLIP models
            clip_path1 = config.get_model_path("text_encoders", clip_name1)
            clip_path2 = config.get_model_path("text_encoders", clip_name2)

            if not clip_path1.exists():
                raise FileNotFoundError(f"CLIP model 1 not found: {clip_path1}")
            if not clip_path2.exists():
                raise FileNotFoundError(f"CLIP model 2 not found: {clip_path2}")

            # Load using ComfyUI's CLIP loader (preserve UI order: clip_l first, then t5 for flux)
            clip_paths = [str(clip_path1), str(clip_path2)]
            embedding_dirs = folder_paths.get_folder_paths("embeddings")
            clip_type = getattr(comfy.sd.CLIPType, type.upper(), comfy.sd.CLIPType.STABLE_DIFFUSION)
            clip = comfy.sd.load_clip(ckpt_paths=clip_paths, embedding_directory=embedding_dirs, clip_type=clip_type, model_options={})
            return (clip,)

        except Exception as e:
            logger.error(f"Error loading dual CLIP: {str(e)}")
            raise

class SaveImage:
    """Save Image node"""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "images": ("IMAGE",),
                "filename_prefix": ("STRING", {"default": "ComfyUI"})
            }
        }

    RETURN_TYPES = ()
    FUNCTION = "save_images"
    CATEGORY = "image"

    def save_images(self, images: torch.Tensor, filename_prefix: str = "ComfyUI"):
        """Save images to output directory"""
        try:
            from config import Config
            import uuid
            from PIL import Image
            import numpy as np

            config = Config()
            results = []

            if isinstance(images, torch.Tensor):
                images = images.detach().cpu()

            # Ensure batch dimension
            if images.dim() == 3:
                images = images.unsqueeze(0)

            for i in range(images.shape[0]):
                img = images[i]
                # Handle CHW vs HWC
                if img.shape[0] in (1, 3, 4):  # CHW
                    img = img.permute(1, 2, 0)

                img = img.clamp(0.0, 1.0)
                image_np = (img.numpy() * 255.0).astype(np.uint8)

                # If alpha channel, drop it for PNG RGB for simplicity
                if image_np.shape[-1] == 4:
                    image_np = image_np[:, :, :3]

                pil_image = Image.fromarray(image_np)
                filename = f"{filename_prefix}_{uuid.uuid4().hex[:8]}.png"
                image_path = config.output_dir / filename
                pil_image.save(image_path)

                results.append({
                    "filename": filename,
                    "type": "output"
                })

            return {"ui": {"images": results}}

        except Exception as e:
            logger.error(f"Error saving images: {str(e)}")
            raise

# Node mappings for registration
NODE_CLASS_MAPPINGS = {
    "CLIPTextEncode": CLIPTextEncode,
    "VAELoader": VAELoader,
    "KSampler": KSampler,
    "VAEDecode": VAEDecode,
    "PreviewImage": PreviewImage,
    "EmptySD3LatentImage": EmptySD3LatentImage,
    "DualCLIPLoader": DualCLIPLoader,
    "SaveImage": SaveImage,
}