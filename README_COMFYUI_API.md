# ComfyUI Flask API

A Flask-based REST API for interacting with ComfyUI workflows for image generation and editing.

## Features

- **Image Generation**: Generate images using the Flux-KREA model
- **Image Editing**: Edit images using the Qwen Image Edit model
- **Error Handling**: Comprehensive error handling and validation
- **Health Checks**: Monitor API and ComfyUI server status
- **Flexible Input**: Support for both JSON and multipart form data

## Prerequisites

1. **ComfyUI Server**: Ensure ComfyUI is running on `127.0.0.1:8188`
2. **Required Models**: Make sure the following models are installed in ComfyUI:
   - `flux1-krea-dev-Q5_1.gguf`
   - `ae.safetensors`
   - `clip_l.safetensors`
   - `t5xxl_fp8_e4m3fn.safetensors`
   - `Qwen_Image_Edit-Q4_0.gguf`
   - `qwen_2.5_vl_7b_fp8_scaled.safetensors`
   - `qwen_image_vae.safetensors`
   - `Qwen-Image-Lightning-4steps-V1.0.safetensors`

## Installation

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the Flask app:
```bash
python comfyui_flask_app.py
```

The API will be available at `http://localhost:5000`

## API Endpoints

### Health Check
```http
GET /health
```

Returns the status of the API and ComfyUI server connection.

### List Workflows
```http
GET /workflows
```

Returns information about available workflows and their parameters.

### Generate Image
```http
POST /generate-image
Content-Type: application/json

{
  "prompt": "A beautiful landscape with mountains and lakes",
  "negative_prompt": "blurry, low quality",
  "width": 1024,
  "height": 1024,
  "steps": 20,
  "cfg": 1,
  "seed": 12345
}
```

**Parameters:**
- `prompt` (string, required): Description of the image to generate
- `negative_prompt` (string, optional): What to avoid in the image
- `width` (integer, optional): Image width (64-2048, default: 1024)
- `height` (integer, optional): Image height (64-2048, default: 1024)
- `steps` (integer, optional): Number of sampling steps (1-100, default: 20)
- `cfg` (float, optional): CFG scale (0.1-30, default: 1)
- `seed` (integer, optional): Random seed for reproducibility

### Edit Image
```http
POST /edit-image
Content-Type: application/json

{
  "image": "base64_encoded_image_data",
  "prompt": "Make the sky more dramatic",
  "negative_prompt": "artifacts, distortion",
  "steps": 4,
  "cfg": 1,
  "seed": 12345
}
```

Or using multipart form data:
```http
POST /edit-image
Content-Type: multipart/form-data

image: [image file]
prompt: Make the sky more dramatic
negative_prompt: artifacts, distortion
steps: 4
cfg: 1
seed: 12345
```

**Parameters:**
- `image` (file or base64 string, required): Input image to edit
- `prompt` (string, optional): Description of desired changes
- `negative_prompt` (string, optional): What to avoid in the edited image
- `steps` (integer, optional): Number of sampling steps (1-100, default: 4)
- `cfg` (float, optional): CFG scale (0.1-30, default: 1)
- `seed` (integer, optional): Random seed for reproducibility

## Response Format

All endpoints return JSON responses with the following structure:

**Success Response:**
```json
{
  "success": true,
  "images": [
    {
      "image": "base64_encoded_image_data",
      "format": "png"
    }
  ],
  "parameters": {
    "prompt": "...",
    "width": 1024,
    "height": 1024,
    ...
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error description",
  "error_type": "error_category"
}
```

## Error Types

- `connection_error`: Cannot connect to ComfyUI server
- `json_error`: Invalid JSON data
- `value_error`: Invalid parameter values
- `not_found`: Endpoint not found
- `method_not_allowed`: HTTP method not allowed
- `internal_error`: Unexpected server error

## Example Usage

### Python Example
```python
import requests
import base64

# Generate an image
response = requests.post('http://localhost:5000/generate-image', json={
    'prompt': 'A cute cat in a garden',
    'width': 512,
    'height': 512,
    'steps': 15
})

if response.json()['success']:
    image_data = base64.b64decode(response.json()['images'][0]['image'])
    with open('generated_image.png', 'wb') as f:
        f.write(image_data)
```

### cURL Example
```bash
# Generate image
curl -X POST http://localhost:5000/generate-image \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A beautiful sunset over the ocean",
    "width": 1024,
    "height": 1024
  }'

# Edit image with file upload
curl -X POST http://localhost:5000/edit-image \
  -F "image=@input_image.jpg" \
  -F "prompt=Make it more colorful" \
  -F "steps=4"
```

## Troubleshooting

1. **Connection Error**: Ensure ComfyUI is running on the correct port (8188)
2. **Model Not Found**: Verify all required models are installed in ComfyUI
3. **Memory Issues**: Reduce image dimensions or steps if running out of memory
4. **Timeout**: Increase timeout values for large images or complex prompts

## Configuration

You can modify the following variables in `comfyui_flask_app.py`:
- `SERVER_ADDRESS`: ComfyUI server address (default: "127.0.0.1:8188")
- Workflow file paths
- Parameter validation ranges