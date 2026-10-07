import { embed, embedMany, type EmbeddingModel } from "ai";
import { google, type GoogleEmbeddingModelOptions } from "@ai-sdk/google";
import { EMBEDDING_DIMENSIONS } from "./store/schema.ts";

export type Embedder = {
  documents(texts: string[]): Promise<number[][]>;
  query(text: string): Promise<number[]>;
};

function options(taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY") {
  return { google: { outputDimensionality: EMBEDDING_DIMENSIONS, taskType } satisfies GoogleEmbeddingModelOptions };
}

/**
 * gemini-embedding-001 at 768 dimensions.
 * Reads GOOGLE_GENERATIVE_AI_API_KEY at call time, not at import.
 */
export function createEmbedder(model: EmbeddingModel = google.embedding("gemini-embedding-001")): Embedder {
  return {
    async documents(texts) {
      if (texts.length === 0) return [];
      const { embeddings } = await embedMany({
        model,
        values: texts,
        providerOptions: options("RETRIEVAL_DOCUMENT"),
        maxRetries: 2,
      });
      return embeddings;
    },
    async query(text) {
      const { embedding } = await embed({
        model,
        value: text,
        providerOptions: options("RETRIEVAL_QUERY"),
        maxRetries: 1,
      });
      return embedding;
    },
  };
}
