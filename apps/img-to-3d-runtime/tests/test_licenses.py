"""
The runtime makes models for commercial use, so three components that TRELLIS.2
ships with must never come back:

- nvdiffrast and nvdiffrec: NVIDIA Source Code License-NC, research and
  evaluation only.
- briaai/RMBG-2.0: CC BY-NC 4.0.

The image definition is read as code (its string literals, not its comments or
docstrings, which name these components to explain why they are absent), and
the RMBG exclusion is held both in the config rewrite and in the call that
loads the rewritten config.
"""

import ast
import re
from pathlib import Path

import pytest

from img_to_3d_runtime import config
from img_to_3d_runtime.pipeline_config import use_birefnet

ROOT = Path(__file__).resolve().parent.parent
PACKAGE = ROOT / "img_to_3d_runtime"
NON_COMMERCIAL_PACKAGES = ("nvdiffrast", "nvdiffrec")


def _code_strings(path: Path) -> list[str]:
    """Every string literal in a module except docstrings."""
    tree = ast.parse(path.read_text())
    docstrings = {
        id(node.body[0].value)
        for node in ast.walk(tree)
        if isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef))
        and node.body
        and isinstance(node.body[0], ast.Expr)
        and isinstance(node.body[0].value, ast.Constant)
    }
    return [
        node.value
        for node in ast.walk(tree)
        if isinstance(node, ast.Constant) and isinstance(node.value, str) and id(node) not in docstrings
    ]


@pytest.mark.parametrize("package", NON_COMMERCIAL_PACKAGES)
def test_the_gpu_image_never_installs_a_non_commercial_package(package):
    offending = [s for s in _code_strings(PACKAGE / "infra.py") if package in s.lower()]
    assert offending == [], f"infra.py installs {package}, which is licensed for research only"


@pytest.mark.parametrize("package", NON_COMMERCIAL_PACKAGES)
def test_no_manifest_depends_on_a_non_commercial_package(package):
    for manifest in ("pyproject.toml", "uv.lock"):
        text = (ROOT / manifest).read_text()
        assert not re.search(rf'name = "{package}"|"{package}[^"]*"', text), f"{manifest} pulls in {package}"


def test_trellis2_resolves_nvdiffrast_to_our_stub():
    stub = ROOT / "stubs" / "nvdiffrast" / "torch.py"
    assert "raise RuntimeError" in stub.read_text()

    strings = _code_strings(PACKAGE / "infra.py")
    # The stub is added to the image, and ahead of TRELLIS.2 on the path.
    assert "/opt/stubs" in strings
    pythonpath = next(s for s in strings if "/app/trellis2" in s and ":" in s)
    assert pythonpath.split(":")[0] == "/opt/stubs"


def test_background_removal_is_birefnet_never_rmbg():
    assert "rmbg" not in config.REMBG_REPO.lower()

    upstream = {
        "args": {
            "rembg_model": {"name": "BiRefNet", "args": {"model_name": "briaai/RMBG-2.0"}},
            "image_cond_model": {"name": "DinoV3FeatureExtractor", "args": {"model_name": "facebook/dinov3"}},
        }
    }
    rewritten = use_birefnet(upstream, config.REMBG_DIR)

    assert rewritten["args"]["rembg_model"] == {"name": "BiRefNet", "args": {"model_name": config.REMBG_DIR}}
    assert rewritten["args"]["image_cond_model"] == upstream["args"]["image_cond_model"]
    assert upstream["args"]["rembg_model"]["args"]["model_name"] == "briaai/RMBG-2.0", "input was mutated"


def test_an_unexpected_background_remover_stops_the_load():
    with pytest.raises(ValueError):
        use_birefnet({"args": {"rembg_model": {"name": "Other", "args": {}}}}, config.REMBG_DIR)


def test_the_pipeline_loads_the_rewritten_config_not_upstreams():
    """
    The rewrite only helps if it is what loads. Without `config_file`,
    `from_pretrained` reads upstream's pipeline.json and downloads RMBG-2.0.
    """
    tree = ast.parse((PACKAGE / "inference.py").read_text())
    calls = [
        node
        for node in ast.walk(tree)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
    ]

    loads = [c for c in calls if c.func.attr == "from_pretrained"]
    assert len(loads) == 1, "expected exactly one pipeline load"
    config_file = {k.arg: k.value for k in loads[0].keywords}.get("config_file")
    assert isinstance(config_file, ast.Name) and config_file.id == "PIPELINE_CONFIG"

    rewrites = [c for c in calls if c.func.attr == "write_text"]
    assert any(
        isinstance(arg, ast.Name) and arg.id == "PIPELINE_CONFIG"
        for c in rewrites
        for arg in ast.walk(c.func.value)
    ), "the rewritten config is never written to PIPELINE_CONFIG"
    assert any(
        isinstance(node, ast.Call) and getattr(node.func, "id", None) == "use_birefnet"
        for node in ast.walk(tree)
    ), "inference.py never applies use_birefnet"
