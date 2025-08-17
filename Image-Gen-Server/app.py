#!/usr/bin/env python3
"""
Minimal ComfyUI Flask Server
Runs the Qwen Image workflow with configurable parameters
"""

import os
import sys
import json
import logging
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import torch
import traceback
from pathlib import Path

# Add current directory to Python path
current_dir = Path(__file__).parent.absolute()
sys.path.insert(0, str(current_dir))

# Import our minimal ComfyUI components
from workflow_executor import WorkflowExecutor
from flux_workflow_executor import FluxWorkflowExecutor
from config import Config

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Initialize workflow executors
config = Config()
qwen_executor = WorkflowExecutor(config)
flux_executor = FluxWorkflowExecutor(config)

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "message": "Minimal ComfyUI server is running"})

@app.route('/generate', methods=['POST'])
def generate_image():
    """
    Generate image using the Qwen workflow

    Expected JSON payload:
    {
        "positive_prompt": "A realistic photo of a chubby orange cat...",
        "negative_prompt": "jpeg compression",
        "steps": 1,
        "cfg": 4.5,
        "seed": 22,
        "width": 1280,
        "height": 768,
        "unet_model": "qwen-image-Q2_K.gguf",
        "clip_model": "Qwen2.5-VL-7B-Instruct-Q2_K_L.gguf",
        "vae_model": "qwen_image_vae.safetensors"
    }
    """
    try:
        # Parse request data
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400

        # Extract parameters with defaults
        params = {
            "positive_prompt": data.get("positive_prompt", "A realistic photo of a chubby orange cat playing with a mouse toy in a green garden."),
            "negative_prompt": data.get("negative_prompt", "jpeg compression"),
            "steps": data.get("steps", 1),
            "cfg": data.get("cfg", 4.5),
            "seed": data.get("seed", 22),
            "width": data.get("width", 1280),
            "height": data.get("height", 768),
            "unet_model": data.get("unet_model", "qwen-image-Q2_K.gguf"),
            "clip_model": data.get("clip_model", "Qwen2.5-VL-7B-Instruct-Q2_K_L.gguf"),
            "vae_model": data.get("vae_model", "qwen_image_vae.safetensors")
        }

        logger.info(f"Generating image with params: {params}")

        # Execute workflow
        result = qwen_executor.execute_workflow(params)

        if result["success"]:
            return jsonify({
                "success": True,
                "image_path": result["image_path"],
                "execution_time": result["execution_time"],
                "message": "Image generated successfully"
            })
        else:
            return jsonify({
                "success": False,
                "error": result["error"]
            }), 500

    except Exception as e:
        logger.error(f"Error generating image: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/generate-flux', methods=['POST'])
def generate_flux_image():
    """
    Generate image using the Flux workflow

    Expected JSON payload:
    {
        "positive_prompt": "A beautiful landscape with mountains",
        "negative_prompt": "blurry, low quality",
        "steps": 20,
        "cfg": 1.0,
        "seed": 42,
        "width": 1024,
        "height": 1024,
        "unet_model": "flux1-krea-dev-Q5_1.gguf",
        "clip_model1": "clip_l.safetensors",
        "clip_model2": "t5xxl_fp8_e4m3fn.safetensors",
        "vae_model": "ae.safetensors",
        "filename_prefix": "flux"
    }
    """
    try:
        # Parse request data
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400

        # Extract parameters with defaults for Flux
        params = {
            "positive_prompt": data.get("positive_prompt", "A beautiful landscape with mountains"),
            "negative_prompt": data.get("negative_prompt", "blurry, low quality"),
            "steps": data.get("steps", 20),
            "cfg": data.get("cfg", 1.0),
            "seed": data.get("seed", 42),
            "width": data.get("width", 1024),
            "height": data.get("height", 1024),
            "unet_model": data.get("unet_model", "flux1-krea-dev-Q5_1.gguf"),
            "clip_model1": data.get("clip_model1", "clip_l.safetensors"),
            "clip_model2": data.get("clip_model2", "t5xxl_fp8_e4m3fn.safetensors"),
            "vae_model": data.get("vae_model", "ae.safetensors"),
            "filename_prefix": data.get("filename_prefix", "flux"),
            "sampler_name": data.get("sampler_name", "euler"),
            "scheduler": data.get("scheduler", "simple"),
            "denoise": data.get("denoise", 1.0)
        }

        logger.info(f"Generating Flux image with params: {params}")

        # Execute Flux workflow
        result = flux_executor.execute_workflow(params)

        if result["success"]:
            return jsonify({
                "success": True,
                "image_path": result["image_path"],
                "execution_time": result["execution_time"],
                "message": "Flux image generated successfully"
            })
        else:
            return jsonify({
                "success": False,
                "error": result["error"]
            }), 500

    except Exception as e:
        logger.error(f"Error generating Flux image: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/image/<path:filename>')
def serve_image(filename):
    """Serve generated images"""
    try:
        image_path = config.output_dir / filename
        if image_path.exists():
            return send_file(str(image_path))
        else:
            return jsonify({"error": "Image not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/models', methods=['GET'])
def list_models():
    """List available models"""
    try:
        models = {
            "unet_models": config.get_available_models("unet"),
            "clip_models": config.get_available_models("text_encoders"),
            "vae_models": config.get_available_models("vae")
        }
        return jsonify(models)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    logger.info("Starting Minimal ComfyUI Flask Server...")
    logger.info(f"Models directory: {config.models_dir}")
    logger.info(f"Output directory: {config.output_dir}")

    # Check if models directory exists
    if not config.models_dir.exists():
        logger.warning(f"Models directory does not exist: {config.models_dir}")
        logger.info("Please create the models directory and add your GGUF models")

    app.run(host='0.0.0.0', port=5000, debug=True)