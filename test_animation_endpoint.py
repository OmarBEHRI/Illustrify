#!/usr/bin/env python3
"""
Test script for the animation generation endpoint
Tests both Flask server and Next.js API endpoints
"""

import requests
import base64
import json
import time
from PIL import Image
import io

# Configuration
FLASK_URL = "http://localhost:5000"
NEXTJS_URL = "http://localhost:3000"

def create_test_image():
    """Create a simple test image as base64"""
    # Create a simple 512x512 red square
    img = Image.new('RGB', (512, 512), color='red')
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    img_data = buffer.getvalue()
    return base64.b64encode(img_data).decode('utf-8')

def test_flask_endpoint(prompt="", test_name="Flask Test"):
    """Test the Flask /image-to-video endpoint directly"""
    print(f"\n=== {test_name} ===")
    print(f"Testing Flask endpoint with prompt: '{prompt}'")
    
    test_image = create_test_image()
    
    payload = {
        "image": test_image,
        "prompt": prompt,
        "negative_prompt": "low quality, blurry",
        "width": 480,
        "height": 832,
        "length": 16,
        "steps": 6,
        "cfg": 1.0,
        "seed": 12345,
        "frame_rate": 32
    }
    
    try:
        print("Sending request to Flask server...")
        start_time = time.time()
        
        response = requests.post(
            f"{FLASK_URL}/image-to-video",
            json=payload,
            timeout=1200  # 20 minutes
        )
        
        end_time = time.time()
        print(f"Request completed in {end_time - start_time:.2f} seconds")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Success: {data.get('success', False)}")
            print(f"Videos count: {len(data.get('videos', []))}")
            print(f"Frames count: {len(data.get('frames', []))}")
            
            if data.get('videos'):
                print(f"First video format: {data['videos'][0].get('format')}")
                print(f"First video data length: {len(data['videos'][0].get('video', ''))}")
            
            if data.get('frames'):
                print(f"First frame format: {data['frames'][0].get('format')}")
                print(f"First frame data length: {len(data['frames'][0].get('image', ''))}")
                
            return True
        else:
            print(f"Error: {response.text}")
            return False
            
    except requests.exceptions.Timeout:
        print("Request timed out after 20 minutes")
        return False
    except Exception as e:
        print(f"Error: {str(e)}")
        return False

def test_nextjs_endpoint(prompt="", test_name="Next.js Test"):
    """Test the Next.js /api/animate/image endpoint"""
    print(f"\n=== {test_name} ===")
    print(f"Testing Next.js API endpoint with prompt: '{prompt}'")
    
    test_image = create_test_image()
    
    payload = {
        "image": test_image,
        "prompt": prompt,
        "negative_prompt": "low quality, blurry",
        "width": 480,
        "height": 832,
        "length": 81,
        "steps": 6,
        "cfg": 1.0,
        "seed": 12345,
        "frame_rate": 32
    }
    
    try:
        print("Sending request to Next.js API...")
        start_time = time.time()
        
        response = requests.post(
            f"{NEXTJS_URL}/api/animate/image",
            json=payload,
            timeout=1200  # 20 minutes
        )
        
        end_time = time.time()
        print(f"Request completed in {end_time - start_time:.2f} seconds")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            # Next.js endpoint returns the video file directly
            content_type = response.headers.get('content-type', '')
            content_length = len(response.content)
            print(f"Content-Type: {content_type}")
            print(f"Content-Length: {content_length} bytes")
            
            if content_length > 0:
                print("✅ Video data received successfully")
                return True
            else:
                print("❌ No video data received")
                return False
        else:
            print(f"Error: {response.text}")
            return False
            
    except requests.exceptions.Timeout:
        print("Request timed out after 20 minutes")
        return False
    except Exception as e:
        print(f"Error: {str(e)}")
        return False

def main():
    """Run all tests"""
    print("🚀 Starting Animation Endpoint Tests")
    print("=====================================")
    
    # Test Flask endpoint with empty prompt
    flask_empty = test_flask_endpoint("", "Flask - Empty Prompt")
    
    # Test Flask endpoint with prompt
    flask_prompt = test_flask_endpoint("a beautiful sunset", "Flask - With Prompt")
    
    # Test Next.js endpoint with empty prompt
    nextjs_empty = test_nextjs_endpoint("", "Next.js - Empty Prompt")
    
    # Test Next.js endpoint with prompt
    nextjs_prompt = test_nextjs_endpoint("a beautiful sunset", "Next.js - With Prompt")
    
    # Summary
    print("\n📊 Test Results Summary")
    print("=======================")
    print(f"Flask - Empty Prompt: {'✅ PASS' if flask_empty else '❌ FAIL'}")
    print(f"Flask - With Prompt:  {'✅ PASS' if flask_prompt else '❌ FAIL'}")
    print(f"Next.js - Empty Prompt: {'✅ PASS' if nextjs_empty else '❌ FAIL'}")
    print(f"Next.js - With Prompt:  {'✅ PASS' if nextjs_prompt else '❌ FAIL'}")
    
    total_passed = sum([flask_empty, flask_prompt, nextjs_empty, nextjs_prompt])
    print(f"\nOverall: {total_passed}/4 tests passed")
    
    if total_passed == 4:
        print("🎉 All tests passed!")
    else:
        print("⚠️  Some tests failed. Check the logs above for details.")

if __name__ == "__main__":
    main()