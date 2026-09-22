import type { JsonObject, JsonValue } from '@onivoro/isomorphic-agentic';

/**
 * How conversation metadata is allowed to fill in tool arguments.
 *
 * A conversation anchored to a record carries that record's identifiers in its
 * metadata. When a tool's input schema declares a property the conversation
 * already knows, filling it in means the model does not have to restate an id
 * it was never shown -- and cannot get it wrong.
 *
 * Every key is configuration. With no `contextKeys` the normalizer is a
 * pass-through, which is the right default for a host that has not opted in.
 */
export interface AgenticToolInputContextConfig {
  /**
   * Metadata keys eligible to be lifted, read from conversation metadata and
   * from a nested `identifiers` object.
   */
  contextKeys?: string[];

  /**
   * Alternate names the same value may travel under, canonical key first:
   * `{ customerId: ['accountId'] }` fills `customerId` from an `accountId`
   * already present in the input or the context.
   */
  aliases?: Record<string, string[]>;

  /**
   * Schema property that receives a nested bag of context rather than a single
   * value -- typically a search tool's `filters` object.
   */
  filtersKey?: string;

  /** Context keys never copied into the filters bag. */
  filtersExclude?: string[];
}

export const DEFAULT_AGENTIC_TOOL_INPUT_CONTEXT_CONFIG: Required<AgenticToolInputContextConfig> =
  {
    contextKeys: [],
    aliases: {},
    filtersKey: '',
    filtersExclude: [],
  };

export function normalizeAgenticToolInputFromContext(
  input: unknown,
  metadata: JsonObject | undefined,
  inputSchema?: Record<string, unknown>,
  config: AgenticToolInputContextConfig = {},
): Record<string, unknown> {
  const contextKeys = config.contextKeys ?? [];
  const aliases = config.aliases ?? {};
  const result = normalizeToolInput(input);

  if (!contextKeys.length) return result;

  const context = flattenContext(metadata, contextKeys, aliases);
  const schemaKeys = schemaPropertyKeys(inputSchema);

  for (const key of schemaKeys) {
    if (result[key] !== undefined) continue;
    const value = contextValue(key, result, context, schemaKeys, aliases);
    if (value !== undefined) result[key] = value;
  }

  if (config.filtersKey && schemaKeys.includes(config.filtersKey)) {
    result[config.filtersKey] = normalizeFilters(
      result[config.filtersKey],
      context,
      contextKeys,
      config.filtersExclude ?? [],
    );
  }

  removeSchemaExcludedAliases(result, schemaKeys, aliases);

  return result;
}

function normalizeToolInput(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' && !Array.isArray(input)
    ? { ...(input as Record<string, unknown>) }
    : {};
}

function flattenContext(
  metadata: JsonObject | undefined,
  contextKeys: string[],
  aliases: Record<string, string[]>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const identifiers = asJsonObject(metadata?.identifiers);

  for (const key of contextKeys) {
    const value = metadata?.[key] ?? identifiers?.[key];
    if (value !== undefined) result[key] = value;
  }

  // A canonical key still absent can be satisfied by one of its aliases
  // appearing in the metadata instead.
  for (const [key, alternates] of Object.entries(aliases)) {
    if (result[key] !== undefined) continue;
    for (const alias of alternates) {
      const value = metadata?.[alias] ?? identifiers?.[alias];
      if (value !== undefined) {
        result[key] = value;
        break;
      }
    }
  }

  return result;
}

function contextValue(
  key: string,
  input: Record<string, unknown>,
  context: Record<string, unknown>,
  schemaKeys: string[],
  aliases: Record<string, string[]>,
): unknown {
  if (context[key] !== undefined) return context[key];

  // Do not fill an alias when the tool also declares the canonical key: the
  // canonical one is the argument the tool actually reads, and populating both
  // invites the model to disagree with itself.
  if (canonicalFor(key, aliases).some((canon) => schemaKeys.includes(canon))) {
    return undefined;
  }

  for (const alias of aliases[key] ?? []) {
    if (input[alias] !== undefined) return input[alias];
    if (context[alias] !== undefined) return context[alias];
  }

  return undefined;
}

/** The canonical keys that list `key` as one of their aliases. */
function canonicalFor(
  key: string,
  aliases: Record<string, string[]>,
): string[] {
  return Object.entries(aliases)
    .filter(([canon, alternates]) => canon !== key && alternates.includes(key))
    .map(([canon]) => canon);
}

function schemaPropertyKeys(
  inputSchema: Record<string, unknown> | undefined,
): string[] {
  const properties = asRecord(inputSchema?.properties);
  return properties ? Object.keys(properties) : [];
}

/**
 * Drops an alias the tool does not declare when it declares the canonical key,
 * so the call carries exactly the argument the schema asked for.
 */
function removeSchemaExcludedAliases(
  input: Record<string, unknown>,
  schemaKeys: string[],
  aliases: Record<string, string[]>,
): void {
  for (const [canonical, alternates] of Object.entries(aliases)) {
    if (!schemaKeys.includes(canonical)) continue;
    for (const alias of alternates) {
      if (!schemaKeys.includes(alias)) delete input[alias];
    }
  }
}

function normalizeFilters(
  filters: unknown,
  context: Record<string, unknown>,
  contextKeys: string[],
  exclude: string[],
): Record<string, unknown> | undefined {
  const result = normalizeToolInput(filters);

  for (const key of contextKeys) {
    if (exclude.includes(key)) continue;
    if (result[key] === undefined && context[key] !== undefined) {
      result[key] = context[key];
    }
  }

  return Object.keys(result).length ? result : undefined;
}

function asJsonObject(value: JsonValue | undefined): JsonObject | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
