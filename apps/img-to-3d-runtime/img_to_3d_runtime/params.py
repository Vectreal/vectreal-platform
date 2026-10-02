"""
The generation parameters the runtime accepts, and the one place they are
validated.

The platform's `img-to-3d-params.ts` states the same contract on its side of
the wire. Field names are camelCase on the wire to match it.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

Resolution = Literal[512, 1024, 1536]
TextureSize = Literal[1024, 2048, 4096]

# TRELLIS.2's own names for each resolution. 1024 and 1536 use the cascade,
# which is upstream's default at 1024 and its only 1536 variant.
PIPELINE_TYPE_BY_RESOLUTION: dict[int, str] = {
    512: "512",
    1024: "1024_cascade",
    1536: "1536_cascade",
}

MIN_DECIMATION_TARGET = 10_000
MAX_DECIMATION_TARGET = 1_000_000
MAX_SEED = 2**31 - 1


class GenerationParams(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
        frozen=True,
    )

    seed: int = Field(ge=0, le=MAX_SEED)
    resolution: Resolution
    texture_size: TextureSize
    decimation_target: int = Field(ge=MIN_DECIMATION_TARGET, le=MAX_DECIMATION_TARGET)

    @property
    def pipeline_type(self) -> str:
        return PIPELINE_TYPE_BY_RESOLUTION[self.resolution]
