#!/usr/bin/env python3
"""
Setup script to copy required files from ComfyUI installation
"""

import os
import shutil
import sys
from pathlib import Path

def copy_comfy_files(comfyui_path: str):
    """Copy required ComfyUI files to the minimal project"""

    comfyui_path = Path(comfyui_path)
    project_path = Path(__file__).parent

    if not comfyui_path.exists():
        print(f"Error: ComfyUI path does not exist: {comfyui_path}")
        return False

    print("Copying ComfyUI files...")

    # Copy core comfy modules
    comfy_src = comfyui_path / "comfy"
    comfy_dst = project_path / "comfy"

    if comfy_src.exists():
        if comfy_dst.exists():
            shutil.rmtree(comfy_dst)
        shutil.copytree(comfy_src, comfy_dst)
        print(f"✓ Copied comfy/ directory")
    else:
        print(f"✗ ComfyUI comfy/ directory not found at {comfy_src}")
        return False

    # Copy GGUF nodes
    gguf_src = comfyui_path / "custom_nodes" / "ComfyUI-GGUF"
    gguf_dst = project_path / "gguf_nodes"

    if gguf_src.exists():
        # Copy specific files
        files_to_copy = ["nodes.py", "loader.py", "ops.py", "dequant.py", "__init__.py"]
        for file_name in files_to_copy:
            src_file = gguf_src / file_name
            dst_file = gguf_dst / file_name
            if src_file.exists():
                shutil.copy2(src_file, dst_file)
                print(f"✓ Copied {file_name}")
            else:
                print(f"✗ GGUF file not found: {src_file}")
    else:
        print(f"✗ ComfyUI-GGUF not found at {gguf_src}")
        return False

    # Copy Hunyuan nodes
    hunyuan_src = comfyui_path / "comfy_extras" / "nodes_hunyuan.py"
    hunyuan_dst = project_path / "comfy_extras" / "nodes_hunyuan.py"

    if hunyuan_src.exists():
        hunyuan_dst.parent.mkdir(exist_ok=True)
        shutil.copy2(hunyuan_src, hunyuan_dst)
        print(f"✓ Copied nodes_hunyuan.py")
    else:
        print(f"✗ Hunyuan nodes not found at {hunyuan_src}")
        return False

    # Create __init__.py files
    init_files = [
        project_path / "comfy_extras" / "__init__.py",
        project_path / "gguf_nodes" / "__init__.py"
    ]

    for init_file in init_files:
        if not init_file.exists():
            init_file.touch()
            print(f"✓ Created {init_file.name}")

    print("\n✓ All files copied successfully!")
    print("\nNext steps:")
    print("1. Install dependencies: pip install -r requirements.txt")
    print("2. Add your models to the models/ directory")
    print("3. Run the server: python app.py")

    return True

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python setup.py <path_to_comfyui>")
        print("Example: python setup.py ../ComfyUI")
        sys.exit(1)

    comfyui_path = sys.argv[1]
    success = copy_comfy_files(comfyui_path)

    if not success:
        sys.exit(1)