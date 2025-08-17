"""
Flux Workflow Executor for minimal ComfyUI project
Executes the Flux workflow with dynamic parameters
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
    CLIPTextEncode, VAELoader, KSampler, VAEDecode, SaveImage,
    EmptySD3LatentImage, DualCLIPLoader
)
from gguf_nodes.nodes import UnetLoaderGGUF

logger = logging.getLogger(__name__)

class FluxWorkflowExecutor:
    """Executes the Flux workflow"""

    def __init__(self, config):
        self.config = config
        self.loaded_models = {}

        # Initialize node instances
        self.unet_loader = UnetLoaderGGUF()
        self.dual_clip_loader = DualCLIPLoader()
        self.vae_loader = VAELoader()
        self.clip_text_encode = CLIPTextEncode()
        self.empty_latent = EmptySD3LatentImage()
        self.ksampler = KSampler()
        self.vae_decode = VAEDecode()
        self.save_image = SaveImage()

    def load_models(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Load all required models for Flux"""
        models = {}

        try:
            # Load UNet model (GGUF)
            logger.info(f"Loading Flux UNet model: {params['unet_model']}")
            if not self.config.validate_model_exists("unet", params["unet_model"]):
                raise FileNotFoundError(f"UNet model not found: {params['unet_model']}")

            unet_result = self.unet_loader.load_unet(params["unet_model"])
            models["model"] = unet_result[0]

            # Load Dual CLIP models
            logger.info(f"Loading CLIP models: {params['clip_model1']}, {params['clip_model2']}")
            if not self.config.validate_model_exists("text_encoders", params["clip_model1"]):
                raise FileNotFoundError(f"CLIP model 1 not found: {params['clip_model1']}")
            if not self.config.validate_model_exists("text_encoders", params["clip_model2"]):
                raise FileNotFoundError(f"CLIP model 2 not found: {params['clip_model2']}")

            clip_result = self.dual_clip_loader.load_clip(
                params["clip_model1"],
                params["clip_model2"],
                type="flux"
            )
            models["clip"] = clip_result[0]

            # Load VAE model
            logger.info(f"Loading VAE model: {params['vae_model']}")
            if not self.config.validate_model_exists("vae", params["vae_model"]):
                raise FileNotFoundError(f"VAE model not found: {params['vae_model']}")

            vae_result = self.vae_loader.load_vae(params["vae_model"])
            models["vae"] = vae_result[0]

            logger.info("All Flux models loaded successfully")
            return models

        except Exception as e:
            logger.error(f"Error loading Flux models: {str(e)}")
            raise

    def execute_workflow(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the complete Flux workflow"""
        start_time = time.time()

        try:
            # Load models
            models = self.load_models(params)

            # Step 1: Create empty latent (SD3/Flux format)
            logger.info("Creating empty SD3 latent...")
            latent_result = self.empty_latent.generate(
                width=params["width"],
                height=params["height"],
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
                scheduler=params.get("scheduler", "simple"),
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
            save_result = self.save_image.save_images(
                images=images,
                filename_prefix=params.get("filename_prefix", "flux")
            )

            # Extract filename from save result
            image_filename = None
            if "ui" in save_result and "images" in save_result["ui"]:
                if save_result["ui"]["images"]:
                    image_filename = save_result["ui"]["images"][0]["filename"]

            if not image_filename:
                # Fallback filename generation
                image_filename = f"flux_{uuid.uuid4().hex[:8]}.png"

            execution_time = time.time() - start_time
            logger.info(f"Flux workflow completed in {execution_time:.2f} seconds")

            return {
                "success": True,
                "image_path": image_filename,
                "execution_time": execution_time
            }

        except Exception as e:
            execution_time = time.time() - start_time
            logger.error(f"Flux workflow failed after {execution_time:.2f} seconds: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "execution_time": execution_time
            }