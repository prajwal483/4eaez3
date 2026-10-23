import json
from pathlib import Path

from app.main import create_app

OPENAPI = Path(__file__).resolve().parents[2] / "frontend" / "openapi.json"


def test_committed_openapi_matches_the_app():
    committed = json.loads(OPENAPI.read_text(encoding="utf-8"))
    assert (
        committed == create_app(static_dir=None).openapi()
    ), "API schema changed: run `python -m scripts.export_openapi` in backend/ and `npm run gen:api` in frontend/"
