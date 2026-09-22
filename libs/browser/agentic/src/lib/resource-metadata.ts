import type { JsonObject, JsonValue } from '@onivoro/isomorphic-agentic';
import type { AgenticChatResourceContext } from './agentic-chat.types';

export function resourceContextMetadata(
  resourceContext: AgenticChatResourceContext | undefined,
): JsonObject | undefined {
  if (!resourceContext) return undefined;

  const identifiers = compactJsonObject({
    ...resourceContext.identifiers,
  } as JsonObject);

  return compactJsonObject({
    ...resourceContext.metadata,
    ...identifiers,
    identifiers,
    resourceId: resourceContext.resourceId,
    resourceLabel: resourceContext.label,
    resourceType: resourceContext.resourceType,
  });
}

export function agenticResourceConversationId(
  appNamespace: string,
  resourceType: string,
  resourceId: string | number,
): string {
  return [appNamespace, resourceType, String(resourceId)]
    .map(sanitizeConversationIdPart)
    .join(':');
}

export function scopedAgenticResourceConversationId(
  appNamespace: string,
  resourceType: string,
  resourceId: string | number,
  scope: string,
): string {
  return `${agenticResourceConversationId(
    appNamespace,
    resourceType,
    resourceId,
  )}:${sanitizeConversationIdPart(scope)}`;
}

function sanitizeConversationIdPart(value: string): string {
  return value.replace(/[^A-Za-z0-9_.-]/g, '_');
}

function compactJsonObject(value: JsonObject): JsonObject {
  return Object.entries(value).reduce<JsonObject>((result, [key, entry]) => {
    if (entry !== undefined) {
      result[key] = compactJsonValue(entry);
    }

    return result;
  }, {});
}

function compactJsonValue(value: JsonValue | undefined): JsonValue | undefined {
  if (Array.isArray(value)) {
    return value.map((item) => compactJsonValue(item) ?? null);
  }

  if (value && typeof value === 'object') {
    return compactJsonObject(value);
  }

  return value;
}
