import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The batteries-included migration: no tenant scoping, with this package's own
 * keys and indexes. Consumers needing more -- a tenant column, row-level
 * security, composite keys -- do not use this class. They write their own thin
 * migration calling the same factory with options:
 *
 *   export class AddAgenticChat1787000000280 implements MigrationInterface {
 *     name = 'AddAgenticChat1787000000280';
 *     up = (qr: QueryRunner) => createAgenticChatTables(qr, myOptions);
 *     down = (qr: QueryRunner) => dropAgenticChatTables(qr, myOptions);
 *   }
 */
import {
  createAgenticChatTables,
  dropAgenticChatTables,
} from './agentic-chat-tables.migration';

export class CreateAgenticChatTables1782300000100
  implements MigrationInterface
{
  name = 'CreateAgenticChatTables1782300000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await createAgenticChatTables(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await dropAgenticChatTables(queryRunner);
  }
}
