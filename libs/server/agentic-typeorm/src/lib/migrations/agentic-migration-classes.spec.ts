import type { QueryRunner } from 'typeorm';
import { CreateAgenticChatTables1782300000100 } from './1782300000100-create-agentic-chat-tables';
import { CreateAgenticPromptTables1782300000200 } from './1782300000200-create-agentic-prompt-tables';

function fakeQueryRunner() {
  const queries: string[] = [];
  const runner = {
    query: async (sql: string) => {
      queries.push(sql.replace(/\s+/g, ' ').trim());
    },
  } as unknown as QueryRunner;
  return { runner, queries };
}

describe('CreateAgenticChatTables1782300000100', () => {
  it('is named after its timestamp', () => {
    expect(new CreateAgenticChatTables1782300000100().name).toBe(
      'CreateAgenticChatTables1782300000100',
    );
  });

  it('creates and drops the chat tables', async () => {
    const migration = new CreateAgenticChatTables1782300000100();
    const up = fakeQueryRunner();
    await migration.up(up.runner);
    expect(up.queries.filter((q) => q.startsWith('CREATE TABLE'))).toHaveLength(
      4,
    );
    expect(up.queries.join('\n')).not.toContain('agentic_prompts');

    const down = fakeQueryRunner();
    await migration.down(down.runner);
    expect(
      down.queries.filter((q) => q.startsWith('DROP TABLE')).length,
    ).toBeGreaterThan(0);
  });
});

describe('CreateAgenticPromptTables1782300000200', () => {
  it('creates and drops only the prompt table', async () => {
    const migration = new CreateAgenticPromptTables1782300000200();
    expect(migration.name).toBe('CreateAgenticPromptTables1782300000200');

    const up = fakeQueryRunner();
    await migration.up(up.runner);
    const creates = up.queries.filter((q) => q.startsWith('CREATE TABLE'));
    expect(creates).toHaveLength(1);
    expect(creates[0]).toContain('"agentic_prompts"');

    const down = fakeQueryRunner();
    await migration.down(down.runner);
    expect(down.queries.join('\n')).toContain('agentic_prompts');
    expect(down.queries.join('\n')).not.toContain('agentic_messages');
  });
});
