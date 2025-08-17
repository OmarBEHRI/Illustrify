"""
Workflow Executor for minimal ComfyUI project
Executes the Qwen Image workflow with dynamic parameters
"""

import time
import logging
import uuid
from pathlib import Path
from typing import Dict, Any
import torch
from PIL import Image
import numpy as np

# Import our minimal ComfyUI nodes
from nodes import (
    CLIPTextEncode, VAELoader, KSampler, VAEDecode, PreviewImage
)
from comfy_extras.nodes_hunyuan import EmptyHunyuanLatentVideo
from gguf_nodes.nodes import UnetLoaderGGUF, CLIPLoaderGGUF

logger = logging.getLogger(__name__)

class WorkflowExecutor:
    """Executes the Qwen Image workflow"""

    def __init__(self, config):
        self.config = config
        self.loaded_models = {}

        # Initialize node instances
        self.unet_loader = UnetLoaderGGUF()
        self.clip_loader = CLIPLoaderGGUF()
        self.vae_loader = VAELoader()
        self.clip_text_encode = CLIPTextEncode()
        self.empty_latent = EmptyHunyuanLatentVideo()
        self.ksampler = KSampler()
        self.vae_decode = VAEDecode()
        self.preview_image = PreviewImage()

    def load_models(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Load all required models"""
        models = {}

        try:
            # Load UNet model (GGUF)
            logger.info(f"Loading UNet model: {params['unet_model']}")
            if not self.config.validate_model_exists("unet", params["unet_model"]):
                raise FileNotFoundError(f"UNet model not found: {params['unet_model']}")

            unet_result = self.unet_loader.load_unet(params["unet_model"])
            models["model"] = unet_result[0]

            # Load CLIP model (GGUF)
            logger.info(f"Loading CLIP model: {params['clip_model']}")
            if not self.config.validate_model_exists("text_encoders", params["clip_model"]):
                raise FileNotFoundError(f"CLIP model not found: {params['clip_model']}")

            clip_result = self.clip_loader.load_clip(params["clip_model"], type="qwen_image")
            models["clip"] = clip_result[0]

            # Load VAE model
            logger.info(f"Loading VAE model: {params['vae_model']}")
            if not self.config.validate_model_exists("vae", params["vae_model"]):
                raise FileNotFoundError(f"VAE model not found: {params['vae_model']}")

            vae_result = self.vae_loader.load_vae(params["vae_model"])
            models["vae"] = vae_result[0]

            logger.info("All models loaded successfully")
            return models

        except Exception as e:
            logger.error(f"Error loading models: {str(e)}")
            raise

    def execute_workflow(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the complete workflow"""
        start_time = time.time()

        try:
            # Load models
            models = self.load_models(params)

            # Step 1: Create empty latent
            logger.info("Creating empty latent...")
            latent_result = self.empty_latent.generate(
                width=params["width"],
                height=params["height"],
                length=1,
                batch_size=1
            )
            latent = latent_result[0]

            # Step 2: Encode positive prompt
            logger.info("Encoding positive prompt...")
            positive_result = self.clip_text_encode.encode(
                clip=models["clip"],
                text=params["positive_prompt"]
            )
            positive_conditioning = positive_result[0]

            # Step 3: Encode negative prompt
            logger.info("Encoding negative prompt...")
            negative_result = self.clip_text_encode.encode(
                clip=models["clip"],
                text=params["negative_prompt"]
            )
            negative_conditioning = negative_result[0]

            # Step 4: Sample
            logger.info("Sampling...")
            sample_result = self.ksampler.sample(
                model=models["model"],
                seed=params["seed"],
                steps=params["steps"],
                cfg=params["cfg"],
                sampler_name=params.get("sampler_name", "euler"),
                scheduler=params.get("scheduler", "normal"),
                positive=positive_conditioning,
                negative=negative_conditioning,
                latent_image=latent,
                denoise=params.get("denoise", 1.0)
            )
            sampled_latent = sample_result[0]

            # Step 5: Decode VAE
            logger.info("Decoding VAE...")
            decode_result = self.vae_decode.decode(
                vae=models["vae"],
                samples=sampled_latent
            )
            images = decode_result[0]

            # Step 6: Save image
            logger.info("Saving image...")
            image_filename = f"generated_{uuid.uuid4().hex[:8]}.png"
            image_path = self.config.output_dir / image_filename

            # Convert tensor to PIL Image and save
            if isinstance(images, torch.Tensor):
                # Convert from tensor to numpy
                image_np = images.squeeze(0).cpu().numpy()
                # Convert from [C, H, W] to [H, W, C] if needed
                if image_np.shape[0] == 3:
                    image_np = np.transpose(image_np, (1, 2, 0))
                # Convert to 0-255 range
                image_np = (image_np * 255).astype(np.uint8)
                # Create PIL Image
                pil_image = Image.fromarray(image_np)
                pil_image.save(image_path)

            execution_time = time.time() - start_time
            logger.info(f"Workflow completed in {execution_time:.2f} seconds")

            return {
                "success": True,
                "image_path": image_filename,
                "execution_time": execution_time
            }

        except Exception as e:
            execution_time = time.time() - start_time
            logger.error(f"Workflow failed after {execution_time:.2f} seconds: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "execution_time": execution_time
            }