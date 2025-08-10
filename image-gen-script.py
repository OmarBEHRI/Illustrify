#This is an example that uses the websockets api to know when a prompt execution is done
#Once the prompt execution is done it downloads the images using the /history endpoint

# import websocket #NOTE: websocket-client (https://github.com/websocket-client/websocket-client)
import uuid
import json
import urllib.request
import urllib.parse
import random
import time
import os
from pathlib import Path

# Attempt to use websockets if available; otherwise fallback to HTTP polling
try:
    import websocket  # websocket-client
    HAS_WS = True
except Exception:
    websocket = None
    HAS_WS = False

server_address = "127.0.0.1:8188"
client_id = str(uuid.uuid4())


def queue_prompt(prompt):
    p = {"prompt": prompt, "client_id": client_id}
    data = json.dumps(p).encode('utf-8')
    req = urllib.request.Request(
        "http://{}/prompt".format(server_address),
        data=data,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as resp:
        try:
            payload = json.loads(resp.read())
            return payload.get("prompt_id")
        except Exception:
            return None


def get_image(filename, subfolder, folder_type):
    data = {"filename": filename, "subfolder": subfolder, "type": folder_type}
    url_values = urllib.parse.urlencode(data)
    with urllib.request.urlopen("http://{}/view?{}".format(server_address, url_values)) as response:
        return response.read()


def get_history(prompt_id):
    with urllib.request.urlopen("http://{}/history/{}".format(server_address, prompt_id)) as response:
        return json.loads(response.read())


# Polling-based image retrieval (no websockets required)
# Waits for history to contain outputs with images, then downloads them.
def get_images_poll(prompt, timeout_seconds: int = 300, poll_interval: float = 0.5):
    prompt_id = queue_prompt(prompt)
    if not prompt_id:
        raise RuntimeError("Failed to queue prompt; no prompt_id returned")

    print(f"[Polling] queued prompt_id={prompt_id}")
    start = time.time()
    while True:
        # Timeout check
        if time.time() - start > timeout_seconds:
            raise TimeoutError("Image generation timed out after {} seconds".format(timeout_seconds))

        try:
            history_wrapper = get_history(prompt_id)
            history = history_wrapper.get(prompt_id) if isinstance(history_wrapper, dict) else None
            if history and isinstance(history, dict):
                # Optional lightweight progress: print current node in 'status'
                status = history.get('status')
                if isinstance(status, dict):
                    current = status.get('current')
                    if current:
                        print(f"[Polling] executing node: {current}")

                outputs = history.get('outputs', {})
                if outputs:
                    # Collect images from any node that produced them
                    output_images = {}
                    has_any_image = False
                    for node_id, node_output in outputs.items():
                        images_output = []
                        if isinstance(node_output, dict) and 'images' in node_output:
                            for image in node_output['images']:
                                image_data = get_image(image['filename'], image['subfolder'], image['type'])
                                images_output.append(image_data)
                            if images_output:
                                has_any_image = True
                        output_images[node_id] = images_output
                    if has_any_image:
                        return output_images
            # If no outputs yet, keep polling
        except Exception:
            # Ignore transient errors and continue polling
            pass

        time.sleep(poll_interval)


# Websocket-based image retrieval with progress from ComfyUI
def get_images_ws(prompt, timeout_seconds: int = 300):
    if not HAS_WS:
        raise RuntimeError("websocket-client not available")

    prompt_id = queue_prompt(prompt)
    if not prompt_id:
        raise RuntimeError("Failed to queue prompt; no prompt_id returned")

    print(f"[WebSocket] queued prompt_id={prompt_id}; connecting to ws...")
    ws = websocket.WebSocket()
    ws.settimeout(timeout_seconds)
    ws.connect(f"ws://{server_address}/ws?clientId={client_id}")

    try:
        current_node = None
        start = time.time()
        while True:
            if time.time() - start > timeout_seconds:
                raise TimeoutError("Image generation timed out during websocket wait")

            out = ws.recv()
            if isinstance(out, str):
                message = json.loads(out)
                mtype = message.get('type')
                if mtype == 'executing':
                    data = message.get('data', {})
                    if data.get('prompt_id') == prompt_id:
                        node = data.get('node')
                        if node is None:
                            print("[WebSocket] execution complete.")
                            break
                        if node != current_node:
                            current_node = node
                            print(f"[WebSocket] executing node: {current_node}")
                elif mtype == 'progress':
                    # Some ComfyUI builds send 'progress' messages with value/max
                    prog = message.get('data', {})
                    value = prog.get('value')
                    maximum = prog.get('max') or prog.get('maximum')
                    if value is not None and maximum:
                        pct = (value / maximum) * 100.0
                        print(f"[WebSocket] progress: {value}/{maximum} ({pct:.1f}%)")
            else:
                # Binary previews (optional)
                continue
    finally:
        try:
            ws.close()
        except Exception:
            pass

    # After execution done, fetch images from history
    history = get_history(prompt_id).get(prompt_id, {})
    output_images = {}
    for node_id, node_output in history.get('outputs', {}).items():
        images_output = []
        if isinstance(node_output, dict) and 'images' in node_output:
            for image in node_output['images']:
                image_data = get_image(image['filename'], image['subfolder'], image['type'])
                images_output.append(image_data)
        output_images[node_id] = images_output

    return output_images


# Load the workflow from json file
with open(r"C:\Users\Asus\Desktop\Illustrify\image-gen-worflows\qwen-image_workflow.json", "r") as f:
    prompt = json.load(f)

# Set Positive Prompt TO the prompt of the user
user_text = input("Enter the prompt: ")
prompt["100"]["inputs"]["text"] = user_text

# Set the seed for our KSampler node to a random big int
prompt["95"]["inputs"]["seed"] = random.randint(0, 2**32)

# Choose method: websockets if available, else polling
TIMEOUT_SECONDS = 300
if HAS_WS:
    try:
        images = get_images_ws(prompt, timeout_seconds=TIMEOUT_SECONDS)
    except Exception as e:
        print(f"[WebSocket] error: {e}. Falling back to polling...")
        images = get_images_poll(prompt, timeout_seconds=TIMEOUT_SECONDS)
else:
    images = get_images_poll(prompt, timeout_seconds=TIMEOUT_SECONDS)

# Save images to disk under ./image_outputs
out_dir = Path(__file__).parent / "image_outputs"
out_dir.mkdir(exist_ok=True)
count = 0
for node_id, imgs in images.items():
    for idx, image_data in enumerate(imgs):
        count += 1
        out_path = out_dir / f"{node_id}_{idx}.png"
        with open(out_path, "wb") as f:
            f.write(image_data)
        print(f"Saved: {out_path}")

if count == 0:
    print("No images generated. Check your ComfyUI server and workflow.")
else:
    print(f"Done. {count} image(s) saved to {out_dir}.")

