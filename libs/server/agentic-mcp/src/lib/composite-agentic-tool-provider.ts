import {
  AgenticToolCall,
  AgenticToolDefinition,
  AgenticToolExecutionContext,
  AgenticToolExecutionResult,
  AgenticToolProvider,
} from '@onivoro/isomorphic-agentic';

export class CompositeAgenticToolProvider implements AgenticToolProvider {
  constructor(private readonly providers: AgenticToolProvider[]) {}

  async listTools(
    context: AgenticToolExecutionContext,
  ): Promise<AgenticToolDefinition[]> {
    const results = await Promise.all(
      this.providers.map((provider) => provider.listTools(context)),
    );
    return results.flat();
  }

  async executeTool(
    call: AgenticToolCall,
    context: AgenticToolExecutionContext,
  ): Promise<AgenticToolExecutionResult> {
    for (const provider of this.providers) {
      const tools = await provider.listTools(context);
      if (tools.some((tool) => tool.name === call.name)) {
        return provider.executeTool(call, context);
      }
    }

    return {
      toolCallId: call.id,
      name: call.name,
      result: `No tool provider found for ${call.name}`,
      isError: true,
    };
  }
}
