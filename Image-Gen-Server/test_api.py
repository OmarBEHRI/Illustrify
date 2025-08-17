#!/usr/bin/env python3
"""
Test script for the minimal ComfyUI API
"""

import requests
import json
import time

def test_health():
    """Test health endpoint"""
    try:
        response = requests.get("http://localhost:5000/health")
        if response.status_code == 200:
            print("✓ Health check passed")
            return True
        else:
            print(f"✗ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ Health check failed: {e}")
        return False

def test_models():
    """Test models endpoint"""
    try:
        response = requests.get("http://localhost:5000/models")
        if response.status_code == 200:
            data = response.json()
            print("✓ Models endpoint working")
            print(f"  - UNet models: {len(data.get('unet_models', []))}")
            print(f"  - CLIP models: {len(data.get('clip_models', []))}")
            print(f"  - VAE models: {len(data.get('vae_models', []))}")
            return True
        else:
            print(f"✗ Models endpoint failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"✗ Models endpoint failed: {e}")
        return False

def test_flux_generation():
    """Test Flux generation endpoint"""
    payload = {
        "positive_prompt": "A simple test image",
        "negative_prompt": "blurry",
        "steps": 1,  # Use minimal steps for testing
        "cfg": 1.0,
        "seed": 42,
        "width": 512,  # Use smaller size for testing
        "height": 512,
        "unet_model": "flux1-krea-dev-Q5_1.gguf",
        "clip_model1": "clip_l.safetensors",
        "clip_model2": "t5xxl_fp8_e4m3fn.safetensors",
        "vae_model": "ae.safetensors"
    }

    try:
        print("Testing Flux generation (this may take a while)...")
        start_time = time.time()

        response = requests.post(
            "http://localhost:5000/generate-flux",
            json=payload,
            timeout=300  # 5 minute timeout
        )

        elapsed = time.time() - start_time

        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                print(f"✓ Flux generation successful in {elapsed:.2f}s")
                print(f"  - Image: {data.get('image_path')}")
                return True
            else:
                print(f"✗ Flux generation failed: {data.get('error')}")
                return False
        else:
            print(f"✗ Flux generation failed: {response.status_code}")
            try:
                error_data = response.json()
                print(f"  Error: {error_data.get('error', 'Unknown error')}")
            except:
                print(f"  Response: {response.text}")
            return False
    except Exception as e:
        print(f"✗ Flux generation failed: {e}")
        return False

def main():
    """Run API tests"""
    print("=== Minimal ComfyUI API Test ===\n")

    tests = [
        ("Health Check", test_health),
        ("Models Endpoint", test_models),
        ("Flux Generation", test_flux_generation)
    ]

    passed = 0
    total = len(tests)

    for name, test_func in tests:
        print(f"Running {name}...")
        if test_func():
            passed += 1
        print()

    print(f"=== API Test Results: {passed}/{total} passed ===")

    if passed == total:
        print("✓ All API tests passed!")
        return True
    else:
        print("✗ Some API tests failed.")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)