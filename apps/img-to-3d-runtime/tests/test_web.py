import uuid

import pytest
from fastapi.testclient import TestClient

from img_to_3d_runtime.web import create_web_app

MAX_IMAGE_BYTES = 1024
PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 16


class Runtime:
    """In-memory stand-ins for the Modal Dicts and the GPU spawner."""

    def __init__(self, spawn_error=None):
        self.jobs = {}
        self.artifacts = {}
        self.spawned = []
        self.spawn_error = spawn_error

    async def read_job(self, job_id):
        return self.jobs.get(job_id)

    async def create_job(self, job_id, state):
        # Modal's `put(..., skip_if_exists=True)`: write only if new.
        if job_id in self.jobs:
            return False
        self.jobs[job_id] = state
        return True

    async def delete_job(self, job_id):
        self.jobs.pop(job_id, None)

    async def read_artifact(self, job_id):
        return self.artifacts.get(job_id)

    async def spawn_generation(self, image_bytes, job_id, params):
        if self.spawn_error:
            raise self.spawn_error
        self.spawned.append((image_bytes, job_id, params))


def client_for(runtime):
    return TestClient(
        create_web_app(
            read_job=runtime.read_job,
            create_job=runtime.create_job,
            delete_job=runtime.delete_job,
            read_artifact=runtime.read_artifact,
            spawn_generation=runtime.spawn_generation,
            max_image_bytes=MAX_IMAGE_BYTES,
            poll_ms=4000,
        )
    )


def form(**overrides):
    fields = {
        "jobId": str(uuid.uuid4()),
        "seed": "3",
        "resolution": "1536",
        "textureSize": "2048",
        "decimationTarget": "200000",
    }
    fields.update(overrides)
    return fields


def submit(client, fields=None, image=PNG, content_type="image/png"):
    return client.post(
        "/generations",
        data=fields or form(),
        files={"image": ("product.png", image, content_type)},
    )


def test_submit_queues_the_job_and_spawns_with_exactly_the_validated_params():
    runtime = Runtime()
    fields = form()

    response = submit(client_for(runtime), fields)

    assert response.status_code == 202
    assert response.json()["data"] == {"jobId": fields["jobId"], "status": "queued", "pollAfterMs": 4000}
    assert runtime.jobs[fields["jobId"]]["status"] == "queued"
    assert runtime.spawned == [
        (
            PNG,
            fields["jobId"],
            {"seed": 3, "resolution": 1536, "textureSize": 2048, "decimationTarget": 200000},
        )
    ]


@pytest.mark.parametrize(
    "overrides",
    [
        {"jobId": "not-a-uuid"},
        {"resolution": "768"},
        {"textureSize": "8192"},
        {"decimationTarget": "9999"},
        {"seed": "-1"},
    ],
)
def test_submit_rejects_invalid_input_without_spawning(overrides):
    runtime = Runtime()

    response = submit(client_for(runtime), form(**overrides))

    assert response.status_code == 422
    assert runtime.spawned == []
    assert runtime.jobs == {}


@pytest.mark.parametrize(
    "image,content_type,status",
    [
        (PNG, "image/gif", 415),
        (b"", "image/png", 422),
        (b"0" * (MAX_IMAGE_BYTES + 1), "image/png", 413),
    ],
)
def test_submit_rejects_unusable_images_without_spawning(image, content_type, status):
    runtime = Runtime()

    response = submit(client_for(runtime), image=image, content_type=content_type)

    assert response.status_code == status
    assert runtime.spawned == []


def test_a_reused_job_id_is_refused_rather_than_overwriting_a_running_job():
    runtime = Runtime()
    fields = form()
    runtime.jobs[fields["jobId"]] = {"status": "processing", "progress": 40, "message": None}

    response = submit(client_for(runtime), fields)

    assert response.status_code == 409
    assert runtime.spawned == []
    assert runtime.jobs[fields["jobId"]]["status"] == "processing"


def test_a_failed_spawn_releases_the_id_so_the_same_job_can_be_retried():
    runtime = Runtime(spawn_error=RuntimeError("no GPU"))
    fields = form()
    client = client_for(runtime)

    failed = submit(client, fields)

    assert failed.status_code == 502
    assert "no GPU" in failed.json()["error"]
    assert fields["jobId"] not in runtime.jobs

    runtime.spawn_error = None
    retried = submit(client, fields)

    assert retried.status_code == 202
    assert [job_id for _, job_id, _ in runtime.spawned] == [fields["jobId"]]


def test_status_reports_the_stored_state_and_stops_polling_when_terminal():
    runtime = Runtime()
    runtime.jobs["a"] = {"status": "processing", "progress": 40, "message": "Baking"}
    runtime.jobs["b"] = {"status": "succeeded", "progress": 100, "message": None}
    client = client_for(runtime)

    running = client.get("/generations/a").json()["data"]
    done = client.get("/generations/b").json()["data"]

    assert running == {
        "jobId": "a",
        "status": "processing",
        "progress": 40,
        "message": "Baking",
        "artifactReady": False,
        "pollAfterMs": 4000,
    }
    assert done["artifactReady"] is True
    assert done["pollAfterMs"] == 0
    assert client.get("/generations/missing").status_code == 404


def test_artifact_is_served_as_glb_only_once_it_exists():
    runtime = Runtime()
    client = client_for(runtime)
    assert client.get("/generations/a/artifact").status_code == 404

    runtime.artifacts["a"] = b"glTF"
    response = client.get("/generations/a/artifact")

    assert response.status_code == 200
    assert response.content == b"glTF"
    assert response.headers["content-type"] == "model/gltf-binary"
