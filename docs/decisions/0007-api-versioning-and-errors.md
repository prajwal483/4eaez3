# 7. Version the API and use one error shape

## Context
The first API used unversioned paths and two error formats: FastAPI's default `{"detail": ...}` for my own errors and a list of validation errors for bad parameters. Clients had to handle both, and any change would break them.

## Decision
- Serve everything under `/api/v1`. Keep `/api/*` as a hidden, deprecated alias so old links keep working.
- Every error is `{"error": {"code", "message", "request_id", "details"}}`, with stable codes such as `out_of_window` and `invalid_request`.
- Successful reads are cacheable (`public, max-age=300, s-maxage=86400`) because the data is a fixed snapshot.
- Every response has an `X-Request-ID`, which also appears in error bodies, the UI's error message and the logs.

## Consequences
Breaking changes can go into `/api/v2` without breaking v1 clients. The frontend types are generated from the OpenAPI schema, and CI fails if they drift.
