import type { McpRegistrationChangeType } from './mcp-registration-change-type';

export type McpRegistrationChangeListener = (type: McpRegistrationChangeType, name: string) => void;
