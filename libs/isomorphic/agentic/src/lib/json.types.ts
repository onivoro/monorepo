export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue | undefined };

export type JsonObject = { [key: string]: JsonValue | undefined };

export type JsonSchemaObject = Record<string, unknown>;

export type AgenticProviderMetadata = Record<string, unknown>;
