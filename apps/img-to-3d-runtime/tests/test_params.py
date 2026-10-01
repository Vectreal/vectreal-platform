import pytest
from pydantic import ValidationError

from img_to_3d_runtime.params import (
    MAX_DECIMATION_TARGET,
    MAX_SEED,
    MIN_DECIMATION_TARGET,
    GenerationParams,
)

VALID = {"seed": 7, "resolution": 1024, "textureSize": 4096, "decimationTarget": 500_000}


def test_accepts_the_wire_names_and_maps_resolution_to_pipeline_type():
    params = GenerationParams.model_validate(VALID)
    assert params.pipeline_type == "1024_cascade"
    assert GenerationParams.model_validate({**VALID, "resolution": 512}).pipeline_type == "512"
    assert GenerationParams.model_validate({**VALID, "resolution": 1536}).pipeline_type == "1536_cascade"


@pytest.mark.parametrize(
    "field,value",
    [
        ("seed", 0),
        ("seed", MAX_SEED),
        ("decimationTarget", MIN_DECIMATION_TARGET),
        ("decimationTarget", MAX_DECIMATION_TARGET),
        ("textureSize", 1024),
        ("textureSize", 2048),
    ],
)
def test_accepts_the_bounds(field, value):
    GenerationParams.model_validate({**VALID, field: value})


@pytest.mark.parametrize(
    "field,value",
    [
        ("seed", -1),
        ("seed", MAX_SEED + 1),
        ("resolution", 768),
        ("textureSize", 8192),
        ("decimationTarget", MIN_DECIMATION_TARGET - 1),
        ("decimationTarget", MAX_DECIMATION_TARGET + 1),
    ],
)
def test_rejects_values_outside_the_contract(field, value):
    with pytest.raises(ValidationError):
        GenerationParams.model_validate({**VALID, field: value})


def test_rejects_unknown_fields():
    with pytest.raises(ValidationError):
        GenerationParams.model_validate({**VALID, "steps": 50})


def test_round_trips_to_the_wire_names_the_gpu_function_reads():
    params = GenerationParams.model_validate(VALID)
    assert GenerationParams.model_validate(params.model_dump(by_alias=True)) == params
