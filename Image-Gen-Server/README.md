# Minimal ComfyUI Project

A minimal implementation of ComfyUI workflows (Qwen Image and Flux) that can be run as a Flask server.

## Project Structure

```
minimal_comfyui_project/
├── app.py                 # Flask server
├── config.py             # Configuration management
├── workflow_executor.py  # Workflow execution logic
├── nodes.py              # Simplified ComfyUI nodes
├── requirements.txt      # Python dependencies
├── comfy/                # ComfyUI core modules (copy from original)
├── comfy_extras/         # ComfyUI extra nodes (copy from original)
├── gguf_nodes/           # GGUF loader nodes (copy from original)
├── models/               # Model files
│   ├── unet/            # GGUF UNet models
│   ├── text_encoders/   # GGUF CLIP models
│   └── vae/             # VAE models
├── output/              # Generated images
└── temp/                # Temporary files
```

## Setup Instructions

### 1. Copy Required Files from ComfyUI

You need to copy these directories from the original ComfyUI installation:

```bash
# Copy core ComfyUI modules
cp -r /path/to/ComfyUI/comfy ./comfy/

# Copy GGUF nodes
cp -r /path/to/ComfyUI/custom_nodes/ComfyUI-GGUF/* ./gguf_nodes/

# Copy Hunyuan nodes
cp /path/to/ComfyUI/comfy_extras/nodes_hunyuan.py ./comfy_extras/
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Add Your Models

Place your models in the appropriate directories:

- **UNet models**: `models/unet/qwen-image-Q2_K.gguf`
- **CLIP models**: `models/text_encoders/Qwen2.5-VL-7B-Instruct-Q2_K_L.gguf`
- **VAE models**: `models/vae/qwen_image_vae.safetensors`

### 4. Run the Server

```bash
python app.py
```

The server will start on `http://localhost:5000`

## API Usage

### Health Check
```bash
curl http://localhost:5000/health
```

### Generate Image (Qwen)
```bash
curl -X POST http://localhost:5000/generate \
  -H "Content-Type: application/json" \
  -d '{
    "positive_prompt": "A beautiful landscape with mountains",
    "negative_prompt": "blurry, low quality",
    "steps": 1,
    "cfg": 4.5,
    "seed": 42,
    "width": 1280,
    "height": 768,
    "unet_model": "qwen-image-Q2_K.gguf",
    "clip_model": "Qwen2.5-VL-7B-Instruct-Q2_K_L.gguf",
    "vae_model": "qwen_image_vae.safetensors"
  }'
```

### Generate Image (Flux)
```bash
curl -X POST http://localhost:5000/generate-flux \
  -H "Content-Type: application/json" \
  -d '{
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
    "vae_model": "ae.safetensors"
  }'
```

### List Available Models
```bash
curl http://localhost:5000/models
```

### Get Generated Image
```bash
curl http://localhost:5000/image/generated_12345678.png
```

## Configuration

The `config.py` file contains all configuration options:

- **Model directories**: Where to find different types of models
- **Output directory**: Where generated images are saved
- **Device settings**: CUDA/CPU configuration
- **Default parameters**: Default values for generation

## Workflow Parameters

You can customize these parameters in your API calls:

- `positive_prompt`: Text describing what you want to generate
- `negative_prompt`: Text describing what to avoid
- `steps`: Number of sampling steps (1-50)
- `cfg`: Classifier-free guidance scale (1.0-20.0)
- `seed`: Random seed for reproducible results
- `width`/`height`: Image dimensions (must be multiples of 8)
- `unet_model`: UNet model filename
- `clip_model`: CLIP model filename
- `vae_model`: VAE model filename

## Notes

- This is a minimal implementation focused on the Qwen Image workflow
- You'll need to copy the actual ComfyUI modules for full functionality
- GGUF models require the ComfyUI-GGUF custom node
- Make sure your models are compatible with the Qwen Image architecture