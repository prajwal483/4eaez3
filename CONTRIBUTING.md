# Working on GridBrick

## Setup

```bash
cd backend && python -m venv .venv && source .venv/Scripts/activate  # .venv/bin/activate on macOS/Linux
pip install -r requirements-dev.txt
cd ../frontend && npm install
```

## Workflow

1. Branch from `main` (`improve/…`, `fix/…`).
2. Keep commits small and use conventional messages (`feat(api): …`, `fix(ui): …`, `docs: …`).
3. Open a pull request. CI must pass: lint, type-check, tests with a 95% backend coverage gate, the API-contract check and a Docker smoke test.
4. Merge with a merge commit so the history shows each change.

## Before you push

```bash
cd backend && ruff check . ../api && ruff format --check . ../api && pytest --cov=app
cd frontend && npm run lint && npm run typecheck && npm test
```

## Changing the API

1. Edit `backend/app/schemas.py` and `backend/app/routes.py`. New fields are fine in v1; removing or renaming one needs `/api/v2`.
2. Regenerate the contract: `python -m scripts.export_openapi` (in `backend/`), then `npm run gen:api` (in `frontend/`).
3. Commit `frontend/openapi.json` and `frontend/src/schema.d.ts` with your change.

## Refreshing the data

`python -m scripts.snapshot` (in `backend/`) re-downloads the window from Elexon. `python -m scripts.calibration` re-checks the likely range.

## Reviewing

- Does the change keep "only information available at gate closure" true?
- Are edge cases tested: empty days, window boundaries, missing actuals?
- Is a decision worth a record in `docs/decisions/`?
