"""
The one edit made to TRELLIS.2's pipeline.json, kept pure so a test can hold it.
"""

from __future__ import annotations

import copy
from typing import Any


def use_birefnet(config: dict[str, Any], birefnet_dir: str) -> dict[str, Any]:
    """
    Return `config` with background removal pointed at a local BiRefNet (MIT)
    snapshot instead of briaai/RMBG-2.0 (CC BY-NC), which upstream names.

    Only `rembg_model.args.model_name` changes. Upstream already uses its
    `rembg.BiRefNet` wrapper for RMBG-2.0, because RMBG-2.0 is a BiRefNet
    fine-tune, so the same wrapper loads the original unchanged.
    """
    rembg = config["args"]["rembg_model"]
    if rembg["name"] != "BiRefNet":
        raise ValueError(f"Unexpected background remover in pipeline.json: {rembg['name']}")

    rewritten = copy.deepcopy(config)
    rewritten["args"]["rembg_model"]["args"]["model_name"] = birefnet_dir
    return rewritten
