"""Write the API's OpenAPI document to frontend/openapi.json; the frontend generates its types from it."""

import json
from pathlib import Path

from app.main import create_app

OUT = Path(__file__).resolve().parents[2] / "frontend" / "openapi.json"


def main() -> None:
    spec = create_app(static_dir=None).openapi()
    OUT.write_text(json.dumps(spec, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
