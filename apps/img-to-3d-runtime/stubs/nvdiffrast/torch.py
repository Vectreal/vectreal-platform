"""See `__init__.py`: importing works, using anything raises."""


def __getattr__(name: str):
    raise RuntimeError(
        f"nvdiffrast.torch.{name} was called, but nvdiffrast is deliberately not "
        "installed (research-only license). Route the call through "
        "img_to_3d_runtime/export.py instead."
    )
