// Generated from the backend's OpenAPI schema. Edit backend/app/schemas.py, then run
// `python -m scripts.export_openapi` (backend/) and `npm run gen:api` (frontend/). Never edit schema.d.ts by hand.
import type { components } from "./schema";

type Schemas = components["schemas"];

export type Metrics = Schemas["Metrics"];
export type DecisionPoint = Schemas["DecisionPoint"];
export type DecisionResponse = Schemas["DecisionResponse"];
export type AccuracyPoint = Schemas["AccuracyPoint"];
export type HistogramBin = Schemas["HistogramBin"];
export type AccuracyResponse = Schemas["AccuracyResponse"];
export type HorizonRow = Schemas["HorizonRow"];
export type Meta = Schemas["Meta"];
export type Health = Schemas["Health"];
export type ErrorResponse = Schemas["ErrorResponse"];
