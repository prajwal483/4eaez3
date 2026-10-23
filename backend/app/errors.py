"""One error shape for every failure, so clients only ever parse {"error": {...}}."""

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

_DEFAULT_CODES = {400: "bad_request", 404: "not_found", 405: "method_not_allowed", 422: "invalid_request"}


class ApiError(HTTPException):
    """An expected client error with a stable, machine-readable code."""

    def __init__(self, status_code: int, code: str, message: str):
        super().__init__(status_code=status_code, detail=message)
        self.code = code


def error_response(
    status: int, code: str, message: str, request: Request, details: list[dict[str, str]] | None = None
) -> JSONResponse:
    body: dict[str, object] = {"code": code, "message": message}
    request_id = getattr(request.state, "request_id", None)
    if request_id:
        body["request_id"] = request_id
    if details:
        body["details"] = details
    return JSONResponse(status_code=status, content={"error": body})


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(StarletteHTTPException)
    async def http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = getattr(exc, "code", None) or _DEFAULT_CODES.get(exc.status_code, "error")
        return error_response(exc.status_code, code, str(exc.detail), request)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        details = [{"field": ".".join(str(p) for p in e["loc"][1:]), "message": e["msg"]} for e in exc.errors()]
        return error_response(422, "invalid_request", "One or more parameters are invalid.", request, details)
