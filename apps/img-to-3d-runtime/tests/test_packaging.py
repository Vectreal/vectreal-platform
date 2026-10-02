import tomllib
from pathlib import Path

from img_to_3d_runtime.config import WEB_PACKAGES

ROOT = Path(__file__).resolve().parent.parent


def test_the_tests_run_against_the_web_packages_that_deploy():
    pyproject = tomllib.loads((ROOT / "pyproject.toml").read_text())
    assert tuple(pyproject["project"]["optional-dependencies"]["web"]) == WEB_PACKAGES
