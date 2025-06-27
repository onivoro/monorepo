export interface McpServerConfig {
  name: string;
  version: string;
  description?: string;
  author?: string;
  homepage?: string;
  authentication?: {
    type: string;
    description: string;
    required: boolean;
  };
  requiredHeaders?: string;
}

export interface McpToolInfo {
  name: string;
  description: string;
  parameters: Record<string, string>;
}

export interface McpContent {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: string;
  mimeType?: string;
}

export interface McpResponse {
  content: McpContent[];
}

export interface McpAuthConfig {
  type: 'api-key' | 'bearer' | 'none';
  description?: string;
  required?: boolean;
}