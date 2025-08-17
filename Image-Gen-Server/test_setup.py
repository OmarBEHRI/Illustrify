#!/usr/bin/env python3
"""
Test script to verify the minimal ComfyUI setup
"""

import sys
import os
from pathlib import Path

# Add current directory to Python path
current_dir = Path(__file__).parent.absolute()
sys.path.insert(0, str(current_dir))

def test_imports():
    """Test if all required modules can be imported"""
    print("Testing imports...")

    try:
        import torch
        print("✓ PyTorch imported successfully")
    except ImportError as e:
        print(f"✗ PyTorch import failed: {e}")
        return False

    try:
        import folder_paths
        print("✓ folder_paths imported successfully")
    except ImportError as e:
        print(f"✗ folder_paths import failed: {e}")
        return False

    try:
        import node_helpers
        print("✓ node_helpers imported successfully")
    except ImportError as e:
        print(f"✗ node_helpers import failed: {e}")
        return False

    try:
        import nodes
        print("✓ nodes imported successfully")
    except ImportError as e:
        print(f"✗ nodes import failed: {e}")
        return False

    try:
        from gguf_nodes.nodes import UnetLoaderGGUF, CLIPLoaderGGUF
        print("✓ GGUF nodes imported successfully")
    except ImportError as e:
        print(f"✗ GGUF nodes import failed: {e}")
        return False

    try:
        import comfy.sd
        import comfy.sample
        import comfy.samplers
        print("✓ ComfyUI core modules imported successfully")
    except ImportError as e:
        print(f"✗ ComfyUI core modules import failed: {e}")
        return False

    return True

def test_node_creation():
    """Test if nodes can be created"""
    print("\nTesting node creation...")

    try:
        from nodes import CLIPTextEncode, VAELoader, KSampler, VAEDecode, EmptySD3LatentImage, DualCLIPLoader

        # Test node creation
        clip_encode = CLIPTextEncode()
        vae_loader = VAELoader()
        ksampler = KSampler()
        vae_decode = VAEDecode()
        empty_latent = EmptySD3LatentImage()
        dual_clip = DualCLIPLoader()

        print("✓ All nodes created successfully")
        return True
    except Exception as e:
        print(f"✗ Node creation failed: {e}")
        return False

def test_config():
    """Test configuration"""
    print("\nTesting configuration...")

    try:
        from config import Config
        config = Config()

        print(f"✓ Config created successfully")
        print(f"  - Models directory: {config.models_dir}")
        print(f"  - Output directory: {config.output_dir}")
        print(f"  - Device: {config.device}")

        return True
    except Exception as e:
        print(f"✗ Config test failed: {e}")
        return False

def main():
    """Run all tests"""
    print("=== Minimal ComfyUI Setup Test ===\n")

    tests = [
        test_imports,
        test_node_creation,
        test_config
    ]

    passed = 0
    total = len(tests)

    for test in tests:
        if test():
            passed += 1
        print()

    print(f"=== Test Results: {passed}/{total} passed ===")

    if passed == total:
        print("✓ All tests passed! Your setup is ready.")
        return True
    else:
        print("✗ Some tests failed. Please check the errors above.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)