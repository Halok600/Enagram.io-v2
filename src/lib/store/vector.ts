import { EMBEDDING_DIMENSIONS } from "./schema.ts";

/** True only for a finite-number vector of exactly the stored embedding width. */
export function isUsableVector(vector: unknown): vector is number[] {
  return Array.isArray(vector) && vector.length === EMBEDDING_DIMENSIONS && vector.every(Number.isFinite);
}
