"""
Node helpers for minimal ComfyUI project
"""

import torch
import numpy as np
from PIL import Image
from typing import Any, Dict, List, Tuple

def pillow_to_tensor(image: Image.Image) -> torch.Tensor:
    """Convert PIL Image to tensor"""
    image_np = np.array(image).astype(np.float32) / 255.0
    if len(image_np.shape) == 3:
        image_tensor = torch.from_numpy(image_np)[None,]
    else:
        image_tensor = torch.from_numpy(image_np)
    return image_tensor

def tensor_to_pillow(tensor: torch.Tensor) -> Image.Image:
    """Convert tensor to PIL Image"""
    if len(tensor.shape) == 4:
        tensor = tensor.squeeze(0)

    image_np = tensor.cpu().numpy()
    if image_np.shape[0] == 3:  # CHW to HWC
        image_np = np.transpose(image_np, (1, 2, 0))

    image_np = (image_np * 255).astype(np.uint8)
    return Image.fromarray(image_np)

def common_upscale(samples: torch.Tensor, width: int, height: int, upscale_method: str, crop: str = "disabled") -> torch.Tensor:
    """Common upscale function"""
    if upscale_method == "nearest-exact":
        return torch.nn.functional.interpolate(samples, size=(height, width), mode="nearest")
    elif upscale_method == "bilinear":
        return torch.nn.functional.interpolate(samples, size=(height, width), mode="bilinear", align_corners=False)
    elif upscale_method == "area":
        return torch.nn.functional.interpolate(samples, size=(height, width), mode="area")
    else:
        return torch.nn.functional.interpolate(samples, size=(height, width), mode="bilinear", align_corners=False)

def conditioning_set_values(conditioning: List, values: Dict) -> List:
    """Set conditioning values"""
    c = []
    for t in conditioning:
        n = [t[0], t[1].copy()]
        for k in values:
            n[1][k] = values[k]
        c.append(n)
    return c

def conditioning_combine(conditioning_1: List, conditioning_2: List) -> List:
    """Combine two conditionings"""
    return conditioning_1 + conditioning_2