# 6. Deploy on Vercel; keep Docker for local runs

## Context
The brief asks for Docker and a Vercel or Heroku deployment. Heroku no longer has a free tier.

## Decision
Vercel serves the React build from its CDN and runs the same FastAPI app as a Python function (`api/index.py`). The Dockerfile builds one image with both, used for local runs and smoke-tested in CI.

## Consequences
Free hosting and fast static delivery. Two deployment shapes have to stay in sync, so CI builds the Docker image and hits it on every change.
