from flask import Flask, request, jsonify, send_file
import websocket
import uuid
import json
import urllib.request
import urllib.parse
import io
import base64
from PIL import Image
import os
import tempfile
import random
import logging
from functools import wraps
import traceback

app = Flask(__name__)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ComfyUI server configuration
SERVER_ADDRESS = "127.0.0.1:8188"
CLIENT_ID = str(uuid.uuid4())

# Error handling decorator
def handle_errors(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except ConnectionError as e:
            logger.error(f"Connection error: {str(e)}")
            return jsonify({
                'success': False,
                'error': 'Unable to connect to ComfyUI server. Please ensure it is running.',
                'error_type': 'connection_error'
            }), 503
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {str(e)}")
            return jsonify({
                'success': False,
                'error': 'Invalid JSON data provided.',
                'error_type': 'json_error'
            }), 400
        except ValueError as e:
            logger.error(f"Value error: {str(e)}")
            return jsonify({
                'success': False,
                'error': str(e),
                'error_type': 'value_error'
            }), 400
        except Exception as e:
            logger.error(f"Unexpected error: {str(e)}")
            logger.error(traceback.format_exc())
            return jsonify({
                'success': False,
                'error': 'An unexpected error occurred. Please try again.',
                'error_type': 'internal_error',
                'details': str(e) if app.debug else None
            }), 500
    return decorated_function

# Validation functions
def validate_image_params(width, height, steps, cfg):
    """Validate image generation parameters"""
    if not (64 <= width <= 2048) or not (64 <= height <= 2048):
        raise ValueError("Width and height must be between 64 and 2048 pixels")
    if not (1 <= steps <= 100):
        raise ValueError("Steps must be between 1 and 100")
    if not (0.1 <= cfg <= 30):
        raise ValueError("CFG must be between 0.1 and 30")

def validate_prompt(prompt):
    """Validate prompt text"""
    if len(prompt) > 1000:
        raise ValueError("Prompt must be less than 1000 characters")
    return prompt.strip()

class ComfyUIClient:
    def __init__(self, server_address=SERVER_ADDRESS):
        self.server_address = server_address
        self.client_id = str(uuid.uuid4())
    
    def queue_prompt(self, prompt, prompt_id):
        """Queue a prompt for execution"""
        p = {"prompt": prompt, "client_id": self.client_id, "prompt_id": prompt_id}
        data = json.dumps(p).encode('utf-8')
        req = urllib.request.Request(f"http://{self.server_address}/prompt", data=data)
        urllib.request.urlopen(req).read()
    
    def get_image(self, filename, subfolder, folder_type):
        """Get image from ComfyUI server"""
        data = {"filename": filename, "subfolder": subfolder, "type": folder_type}
        url_values = urllib.parse.urlencode(data)
        with urllib.request.urlopen(f"http://{self.server_address}/view?{url_values}") as response:
            return response.read()
    
    def get_history(self, prompt_id):
        """Get execution history for a prompt"""
        with urllib.request.urlopen(f"http://{self.server_address}/history/{prompt_id}") as response:
            return json.loads(response.read())
    
    def upload_image(self, image_data, filename):
        """Upload image to ComfyUI server"""
        # Create multipart form data
        boundary = '----WebKitFormBoundary' + ''.join(random.choices('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', k=16))
        
        body = f'--{boundary}\r\n'
        body += f'Content-Disposition: form-data; name="image"; filename="{filename}"\r\n'
        body += 'Content-Type: image/jpeg\r\n\r\n'
        body = body.encode('utf-8') + image_data + f'\r\n--{boundary}--\r\n'.encode('utf-8')
        
        req = urllib.request.Request(
            f"http://{self.server_address}/upload/image",
            data=body,
            headers={'Content-Type': f'multipart/form-data; boundary={boundary}'}
        )
        
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read())
    
    def execute_workflow(self, workflow):
        """Execute a workflow and return the generated images and videos"""
        prompt_id = str(uuid.uuid4())
        
        # Connect to websocket
        ws = websocket.WebSocket()
        ws.connect(f"ws://{self.server_address}/ws?clientId={self.client_id}")
        
        try:
            # Queue the prompt
            self.queue_prompt(workflow, prompt_id)
            
            # Wait for execution to complete
            output_images = {}
            while True:
                out = ws.recv()
                if isinstance(out, str):
                    message = json.loads(out)
                    if message['type'] == 'executing':
                        data = message['data']
                        if data['node'] is None and data['prompt_id'] == prompt_id:
                            break  # Execution is done
                else:
                    continue  # Skip binary data (previews)
            
            # Get the results from history
            history = self.get_history(prompt_id)[prompt_id]
            logger.info(f"Workflow execution completed. History keys: {list(history.keys())}")
            logger.info(f"Output nodes: {list(history['outputs'].keys())}")
            
            # Extract images and videos from the results
            for node_id in history['outputs']:
                node_output = history['outputs'][node_id]
                logger.info(f"Node {node_id} output keys: {list(node_output.keys())}")
                
                # Handle images, videos, and gifs
                if 'images' in node_output:
                    images_output = []
                    for image in node_output['images']:
                        logger.info(f"Processing image: {image['filename']} from {image['subfolder']}")
                        image_data = self.get_image(image['filename'], image['subfolder'], image['type'])
                        images_output.append(image_data)
                    output_images[node_id] = images_output
                elif 'videos' in node_output:
                    videos_output = []
                    for video in node_output['videos']:
                        logger.info(f"Processing video: {video['filename']} from {video['subfolder']}")
                        video_data = self.get_image(video['filename'], video['subfolder'], video['type'])
                        videos_output.append(video_data)
                    output_images[node_id] = videos_output
                elif 'gifs' in node_output:
                    gifs_output = []
                    for gif in node_output['gifs']:
                        logger.info(f"Processing gif: {gif['filename']} from {gif['subfolder']}")
                        gif_data = self.get_image(gif['filename'], gif['subfolder'], gif['type'])
                        gifs_output.append(gif_data)
                    output_images[node_id] = gifs_output
            
            logger.info(f"Final output_images keys: {list(output_images.keys())}")
            return output_images
            
        finally:
            ws.close()

# Initialize ComfyUI client
comfy_client = ComfyUIClient()

# Load workflow templates
def load_workflow_template(filename):
    """Load workflow template from JSON file"""
    with open(filename, 'r', encoding='utf-8') as f:
        return json.load(f)

# Load the workflow templates
FLUX_WORKFLOW_PATH = "c:\\Users\\Asus\\Desktop\\Illustrify\\image-gen-worflows\\Flux-KREA-Image-Gen.json"
EDIT_WORKFLOW_PATH = "c:\\Users\\Asus\\Desktop\\Illustrify\\image-gen-worflows\\Image-Edit-Workflow.json"
I2V_WORKFLOW_PATH = "c:\\Users\\Asus\\Desktop\\Illustrify\\image-gen-worflows\\Image-To-Video.json"

flux_workflow_template = load_workflow_template(FLUX_WORKFLOW_PATH)
edit_workflow_template = load_workflow_template(EDIT_WORKFLOW_PATH)
i2v_workflow_template = load_workflow_template(I2V_WORKFLOW_PATH)

@app.route('/generate-image', methods=['POST'])
@handle_errors
def generate_image():
    """Generate image using Flux-KREA workflow"""
    try:
        data = request.get_json()
        
        # Extract and validate parameters from request
        prompt = validate_prompt(data.get('prompt', 'A beautiful landscape'))
        negative_prompt = validate_prompt(data.get('negative_prompt', 'Blurry, bad quality'))
        width = int(data.get('width', 1024))
        height = int(data.get('height', 1024))
        steps = int(data.get('steps', 20))
        cfg = float(data.get('cfg', 1))
        seed = int(data.get('seed', random.randint(1, 2**32)))
        
        # Validate parameters
        validate_image_params(width, height, steps, cfg)
        
        # Create a copy of the workflow template
        workflow = flux_workflow_template.copy()
        
        # Modify workflow parameters
        # Update positive prompt (node 100)
        workflow["100"]["inputs"]["text"] = prompt
        
        # Update negative prompt (node 139)
        workflow["139"]["inputs"]["text"] = negative_prompt
        
        # Update image dimensions (node 136)
        workflow["136"]["inputs"]["width"] = width
        workflow["136"]["inputs"]["height"] = height
        
        # Update sampling parameters (node 137)
        workflow["137"]["inputs"]["seed"] = seed
        workflow["137"]["inputs"]["steps"] = steps
        workflow["137"]["inputs"]["cfg"] = cfg
        
        # Execute the workflow
        output_images = comfy_client.execute_workflow(workflow)
        
        # Convert images to base64 for response
        result_images = []
        for node_id, images in output_images.items():
            for image_data in images:
                # Convert to base64
                image_b64 = base64.b64encode(image_data).decode('utf-8')
                result_images.append({
                    'image': image_b64,
                    'format': 'png'
                })
        
        return jsonify({
            'success': True,
            'images': result_images,
            'parameters': {
                'prompt': prompt,
                'negative_prompt': negative_prompt,
                'width': width,
                'height': height,
                'steps': steps,
                'cfg': cfg,
                'seed': seed
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/image-to-video', methods=['POST'])
@handle_errors
def image_to_video():
    """Generate video from image using Image-To-Video workflow"""
    try:
        # Handle both JSON and form data
        if request.content_type and 'multipart/form-data' in request.content_type:
            # Handle file upload
            if 'image' not in request.files:
                return jsonify({'success': False, 'error': 'No image file provided'}), 400
            
            image_file = request.files['image']
            prompt = request.form.get('prompt', '')
            negative_prompt = request.form.get('negative_prompt', '色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，整体发灰，最差质量，低质量，JPEG压缩残留，丑陋的，残缺的，多余的手指，画得不好的手部，画得不好的脸部，畸形的，毁容的，形态畸形的肢体，手指融合，静止不动的画面，杂乱的背景，三条腿，背景人很多，倒着走')
            width = int(request.form.get('width', 480))
            height = int(request.form.get('height', 832))
            length = int(request.form.get('length', 81))
            steps = int(request.form.get('steps', 6))
            cfg = float(request.form.get('cfg', 1))
            seed = int(request.form.get('seed', random.randint(1, 2**32)))
            frame_rate = int(request.form.get('frame_rate', 32))
            
            # Read image data
            image_data = image_file.read()
            filename = image_file.filename or 'uploaded_image.jpg'
            
        else:
            # Handle base64 encoded image in JSON
            data = request.get_json()
            
            if 'image' not in data:
                return jsonify({'success': False, 'error': 'No image data provided'}), 400
            
            # Decode base64 image
            try:
                image_b64 = data['image']
                if ',' in image_b64:  # Remove data URL prefix if present
                    image_b64 = image_b64.split(',')[1]
                image_data = base64.b64decode(image_b64)
            except Exception as e:
                return jsonify({'success': False, 'error': f'Invalid image data: {str(e)}'}), 400
            
            prompt = data.get('prompt', '')
            negative_prompt = data.get('negative_prompt', '色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，整体发灰，最差质量，低质量，JPEG压缩残留，丑陋的，残缺的，多余的手指，画得不好的手部，画得不好的脸部，畸形的，毁容的，形态畸形的肢体，手指融合，静止不动的画面，杂乱的背景，三条腿，背景人很多，倒着走')
            width = data.get('width', 480)
            height = data.get('height', 832)
            length = data.get('length', 81)
            steps = data.get('steps', 6)
            cfg = data.get('cfg', 1.0)
            seed = data.get('seed', random.randint(1, 2**32))
            frame_rate = data.get('frame_rate', 32)
            filename = data.get('filename', 'uploaded_image.jpg')
        
        # Upload image to ComfyUI server
        upload_result = comfy_client.upload_image(image_data, filename)
        uploaded_filename = upload_result['name']
        
        # Create a copy of the workflow template
        workflow = i2v_workflow_template.copy()
        
        # Modify workflow parameters
        # Update the image input (node 91)
        workflow["91"]["inputs"]["image"] = uploaded_filename
        
        # Update positive prompt (node 88)
        workflow["88"]["inputs"]["text"] = prompt
        
        # Update negative prompt (node 86)
        workflow["86"]["inputs"]["text"] = negative_prompt
        
        # Update video dimensions and length (node 89)
        workflow["89"]["inputs"]["width"] = width
        workflow["89"]["inputs"]["height"] = height
        workflow["89"]["inputs"]["length"] = length
        
        # Update sampling parameters (nodes 81 and 82)
        workflow["81"]["inputs"]["noise_seed"] = seed
        workflow["81"]["inputs"]["steps"] = steps
        workflow["81"]["inputs"]["cfg"] = cfg
        
        workflow["82"]["inputs"]["noise_seed"] = seed + 1
        workflow["82"]["inputs"]["steps"] = steps
        workflow["82"]["inputs"]["cfg"] = cfg
        
        # Update video output settings (node 62)
        workflow["62"]["inputs"]["frame_rate"] = frame_rate
        
        # Execute the workflow
        logger.info(f"Executing image-to-video workflow with prompt: '{prompt}'")
        output_images = comfy_client.execute_workflow(workflow)
        
        # Print detailed ComfyUI response for debugging
        logger.info("=== COMFYUI RESPONSE DEBUG ===")
        logger.info(f"Raw result type: {type(output_images)}")
        logger.info(f"Raw result: {output_images}")
        
        if output_images:
            logger.info(f"Result keys: {list(output_images.keys())}")
            for key, value in output_images.items():
                logger.info(f"Key '{key}': type={type(value)}, value={value}")
                if isinstance(value, list):
                    logger.info(f"  List length: {len(value)}")
                    for i, item in enumerate(value):
                        logger.info(f"    Item {i}: type={type(item)}, length={len(item) if hasattr(item, '__len__') else 'N/A'}")
        logger.info("=== END COMFYUI RESPONSE DEBUG ===")
        
        logger.info(f"Workflow execution completed. Output nodes: {list(output_images.keys())}")
        
        # The video output should be in node 62 (VHS_VideoCombine)
        # But since ComfyUI returns images, we need to handle video files differently
        # For now, we'll return the generated frames and let the client handle video creation
        result_videos = []
        result_frames = []
        
        for node_id, images in output_images.items():
            logger.info(f"Processing node {node_id} with {len(images)} outputs")
            if node_id == "62":  # Video output node
                # This should contain the video file, but ComfyUI API might return frames
                for i, image_data in enumerate(images):
                    logger.info(f"Processing video output {i+1}/{len(images)}, size: {len(image_data)} bytes")
                    # Check if this is actually a video file or frames
                    video_b64 = base64.b64encode(image_data).decode('utf-8')
                    result_videos.append({
                        'video': video_b64,
                        'format': 'mp4'
                    })
            else:
                # These are intermediate frames
                for i, image_data in enumerate(images):
                    logger.info(f"Processing frame {i+1}/{len(images)} from node {node_id}, size: {len(image_data)} bytes")
                    frame_b64 = base64.b64encode(image_data).decode('utf-8')
                    result_frames.append({
                        'image': frame_b64,
                        'format': 'png'
                    })
        
        logger.info(f"Final result: {len(result_videos)} videos, {len(result_frames)} frames")
        
        return jsonify({
            'success': True,
            'videos': result_videos,
            'frames': result_frames,
            'parameters': {
                'prompt': prompt,
                'negative_prompt': negative_prompt,
                'width': width,
                'height': height,
                'length': length,
                'steps': steps,
                'cfg': cfg,
                'seed': seed,
                'frame_rate': frame_rate,
                'original_filename': filename
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/edit-image', methods=['POST'])
@handle_errors
def edit_image():
    """Edit image using Qwen Image Edit workflow"""
    try:
        # Handle both JSON and form data
        if request.content_type and 'multipart/form-data' in request.content_type:
            # Handle file upload
            if 'image' not in request.files:
                return jsonify({'success': False, 'error': 'No image file provided'}), 400
            
            image_file = request.files['image']
            prompt = request.form.get('prompt', '')
            negative_prompt = request.form.get('negative_prompt', '')
            steps = int(request.form.get('steps', 4))
            cfg = float(request.form.get('cfg', 1))
            seed = int(request.form.get('seed', random.randint(1, 2**32)))
            
            # Read image data
            image_data = image_file.read()
            filename = image_file.filename or 'uploaded_image.jpg'
            
        else:
            # Handle base64 encoded image in JSON
            data = request.get_json()
            
            if 'image' not in data:
                return jsonify({'success': False, 'error': 'No image data provided'}), 400
            
            # Decode base64 image
            try:
                image_b64 = data['image']
                if ',' in image_b64:  # Remove data URL prefix if present
                    image_b64 = image_b64.split(',')[1]
                image_data = base64.b64decode(image_b64)
            except Exception as e:
                return jsonify({'success': False, 'error': f'Invalid image data: {str(e)}'}), 400
            
            prompt = data.get('prompt', '')
            negative_prompt = data.get('negative_prompt', '')
            steps = data.get('steps', 4)
            cfg = data.get('cfg', 1.0)
            seed = data.get('seed', random.randint(1, 2**32))
            filename = data.get('filename', 'uploaded_image.jpg')
        
        # Upload image to ComfyUI server
        upload_result = comfy_client.upload_image(image_data, filename)
        uploaded_filename = upload_result['name']
        
        # Create a copy of the workflow template
        workflow = edit_workflow_template.copy()
        
        # Modify workflow parameters
        # Update the image input (node 105)
        workflow["105"]["inputs"]["image"] = uploaded_filename
        
        # Update positive prompt (node 76)
        workflow["76"]["inputs"]["prompt"] = prompt
        
        # Update negative prompt (node 77)
        workflow["77"]["inputs"]["prompt"] = negative_prompt
        
        # Update sampling parameters (node 3)
        workflow["3"]["inputs"]["seed"] = seed
        workflow["3"]["inputs"]["steps"] = steps
        workflow["3"]["inputs"]["cfg"] = cfg
        
        # Execute the workflow
        output_images = comfy_client.execute_workflow(workflow)
        
        # Convert images to base64 for response
        result_images = []
        for node_id, images in output_images.items():
            for image_data in images:
                # Convert to base64
                image_b64 = base64.b64encode(image_data).decode('utf-8')
                result_images.append({
                    'image': image_b64,
                    'format': 'png'
                })
        
        return jsonify({
            'success': True,
            'images': result_images,
            'parameters': {
                'prompt': prompt,
                'negative_prompt': negative_prompt,
                'steps': steps,
                'cfg': cfg,
                'seed': seed,
                'original_filename': filename
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/interrupt', methods=['POST'])
@handle_errors
def interrupt_generation():
    """Interrupt current generation in ComfyUI"""
    try:
        # Send interrupt request to ComfyUI server
        req = urllib.request.Request(f"http://{SERVER_ADDRESS}/interrupt", method='POST')
        with urllib.request.urlopen(req, timeout=5) as response:
            result = response.read()
        
        return jsonify({
            'success': True,
            'message': 'Generation interrupted successfully'
        })
        
    except Exception as e:
        logger.error(f"Failed to interrupt generation: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Failed to interrupt generation: {str(e)}'
        }), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    try:
        # Test connection to ComfyUI server
        test_req = urllib.request.Request(f"http://{SERVER_ADDRESS}/system_stats")
        with urllib.request.urlopen(test_req, timeout=5) as response:
            comfy_status = "connected"
    except:
        comfy_status = "disconnected"
    
    return jsonify({
        "status": "healthy",
        "message": "ComfyUI Flask API is running",
        "comfyui_status": comfy_status,
        "server_address": SERVER_ADDRESS
    })

@app.route('/workflows', methods=['GET'])
def list_workflows():
    """List available workflows"""
    return jsonify({
        "workflows": [
            {
                "name": "flux-krea-image-gen",
                "description": "Generate images using Flux-KREA model",
                "endpoint": "/generate-image",
                "method": "POST",
                "parameters": {
                    "prompt": "string (required)",
                    "negative_prompt": "string (optional)",
                    "width": "integer (64-2048, default: 1024)",
                    "height": "integer (64-2048, default: 1024)",
                    "steps": "integer (1-100, default: 20)",
                    "cfg": "float (0.1-30, default: 1)",
                    "seed": "integer (optional, random if not provided)"
                }
            },
            {
                "name": "qwen-image-edit",
                "description": "Edit images using Qwen Image Edit model",
                "endpoint": "/edit-image",
                "method": "POST",
                "parameters": {
                    "image": "file or base64 string (required)",
                    "prompt": "string (optional)",
                    "negative_prompt": "string (optional)",
                    "steps": "integer (1-100, default: 4)",
                    "cfg": "float (0.1-30, default: 1)",
                    "seed": "integer (optional, random if not provided)"
                }
            },
            {
                "name": "wan-image-to-video",
                "description": "Generate video from image using WAN Image-To-Video model",
                "endpoint": "/image-to-video",
                "method": "POST",
                "parameters": {
                    "image": "file or base64 string (required)",
                    "prompt": "string (required)",
                    "negative_prompt": "string (optional)",
                    "width": "integer (default: 480)",
                    "height": "integer (default: 832)",
                    "length": "integer (frames, default: 81)",
                    "steps": "integer (1-100, default: 6)",
                    "cfg": "float (0.1-30, default: 1)",
                    "seed": "integer (optional, random if not provided)",
                    "frame_rate": "integer (default: 32)"
                }
            }
        ]
    })

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'success': False,
        'error': 'Endpoint not found',
        'error_type': 'not_found'
    }), 404

@app.errorhandler(405)
def method_not_allowed(error):
    return jsonify({
        'success': False,
        'error': 'Method not allowed',
        'error_type': 'method_not_allowed'
    }), 405

if __name__ == '__main__':
    logger.info(f"Starting ComfyUI Flask API on port 5000")
    logger.info(f"ComfyUI server expected at: {SERVER_ADDRESS}")
    app.run(debug=True, host='0.0.0.0', port=5000)