#!/usr/bin/env python3
"""
Simple test for Flux generation
"""

import requests
import json

def test_flux_simple():
    """Test Flux generation with minimal parameters"""
    payload = {
        "positive_prompt": "A cute little orange happy cat playing with a mouse toy in anime style, very detailed, dramatic lighting.",
        "negative_prompt": "blurry",
        "steps": 20,  # Minimal steps for testing
        "cfg": 1.0,
        "seed": 42,
        "width": 512,  # Small size for testing
        "height": 512,
        "unet_model": "flux1-krea-dev-Q5_1.gguf",
        "clip_model1": "clip_l.safetensors",
        "clip_model2": "t5xxl_fp8_e4m3fn.safetensors",
        "vae_model": "ae.safetensors"
    }

    print("Testing Flux generation...")
    print(f"Payload: {json.dumps(payload, indent=2)}")

    try:
        response = requests.post(
            "http://localhost:5000/generate-flux",
            json=payload,
            timeout=60
        )

        print(f"Status Code: {response.status_code}")

        if response.status_code == 200:
            data = response.json()
            print("Success!")
            print(f"Response: {json.dumps(data, indent=2)}")
        else:
            print("Error!")
            try:
                error_data = response.json()
                print(f"Error Response: {json.dumps(error_data, indent=2)}")
            except:
                print(f"Raw Response: {response.text}")

    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    test_flux_simple()