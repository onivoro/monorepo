import { TKeysOf } from "@onivoro/isomorphic-common";
import { IEntityProvider, TTableMeta } from "@onivoro/server-typeorm-postgres";
import { FindManyOptions, FindOneOptions, FindOptionsWhere,  } from "typeorm";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import { SQL } from 'bun';

export class LeeRepo<TEntity> implements
IEntityProvider<TEntity, FindOneOptions<TEntity>, FindManyOptions<TEntity>, FindOptionsWhere<TEntity>, QueryDeepPartialEntity<TEntity>> {
  private sql: SQL;
  private table: string;
  private schema: string;
  private columns: TKeysOf<TEntity, TTableMeta>;

  constructor(sql: SQL, config: { schema: string; table: string; columns: TKeysOf<TEntity, TTableMeta> }) {
    this.sql = sql;
    this.schema = config.schema;
    this.table = config.table;
    this.columns = config.columns;
  }

  private getTableExpression(): string {
    return this.schema ? `"${this.schema}"."${this.table}"` : `"${this.table}"`;
  }

  private buildWhereClause(where: FindOptionsWhere<TEntity>): { clause: string; values: any[] } {
    const entries = Object.entries(where || {});
    if (entries.length === 0) {
      return { clause: '', values: [] };
    }
    const values: any[] = [];
    const conditions = entries.map(([propertyPath, value], index) => {
      const col = (this.columns as any)[propertyPath];
      const dbCol = col?.databasePath || propertyPath;
      values.push(value);
      return `"${dbCol}" = $${index + 1}`;
    });
    return { clause: ` WHERE ${conditions.join(' AND ')}`, values };
  }

  private mapRow(raw: any): TEntity {
    const mapped: any = {};
    for (const [propertyPath, meta] of Object.entries(this.columns as Record<string, TTableMeta>)) {
      mapped[propertyPath] = raw[meta.databasePath];
    }
    return mapped as TEntity;
  }

  async getOne(options: FindOneOptions<TEntity>): Promise<TEntity> {
    const { clause, values } = this.buildWhereClause(options.where as FindOptionsWhere<TEntity>);
    const query = `SELECT * FROM ${this.getTableExpression()}${clause} LIMIT 1`;
    const rows = await this.sql.unsafe(query, values);
    if (rows.length > 1) {
      throw new Error(`getOne expects only 1 result but found ${rows.length}`);
    }
    return rows[0] ? this.mapRow(rows[0]) : undefined as any;
  }

  async getMany(options: FindManyOptions<TEntity>): Promise<TEntity[]> {
    const { clause, values } = this.buildWhereClause(options.where as FindOptionsWhere<TEntity>);
    const query = `SELECT * FROM ${this.getTableExpression()}${clause}`;
    const rows = await this.sql.unsafe(query, values);
    return rows.map((row: any) => this.mapRow(row));
  }

  async postOne(body: Partial<TEntity>): Promise<TEntity> {
    const results = await this.postMany([body]);
    return results[0];
  }

  async postMany(bodies: Partial<TEntity>[]): Promise<TEntity[]> {
    if (bodies.length === 0) return [];
    const keySet = new Set<string>();
    bodies.forEach(body => Object.keys(body).forEach(k => keySet.add(k)));
    const keys = Array.from(keySet);
    const columnNames = keys.map(k => {
      const col = (this.columns as any)[k];
      return `"${col?.databasePath || k}"`;
    }).join(', ');
    const allValues: any[] = [];
    const valuePlaceholders = bodies.map(body => {
      const placeholders = keys.map(k => {
        allValues.push((body as any)[k] ?? (this.columns as any)[k]?.default ?? null);
        return `$${allValues.length}`;
      });
      return `(${placeholders.join(', ')})`;
    });
    const query = `INSERT INTO ${this.getTableExpression()} (${columnNames}) VALUES ${valuePlaceholders.join(', ')} RETURNING *`;
    const rows = await this.sql.unsafe(query, allValues);
    return rows.map((row: any) => this.mapRow(row));
  }

  async delete(options: FindOptionsWhere<TEntity>): Promise<void> {
    const { clause, values } = this.buildWhereClause(options);
    const query = `DELETE FROM ${this.getTableExpression()}${clause}`;
    await this.sql.unsafe(query, values);
  }

  async put(body: QueryDeepPartialEntity<TEntity>): Promise<void> {
    const entries = Object.entries(body as any);
    if (entries.length === 0) return;
    const columnNames = entries.map(([k]) => {
      const col = (this.columns as any)[k];
      return `"${col?.databasePath || k}"`;
    }).join(', ');
    const values = entries.map(([, v]) => v);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const onConflict = Object.entries(this.columns as Record<string, TTableMeta>)
      .filter(([, meta]) => meta.isPrimary)
      .map(([, meta]) => `"${meta.databasePath}"`)
      .join(', ');
    const updateSet = entries
      .filter(([k]) => !(this.columns as any)[k]?.isPrimary)
      .map(([k]) => {
        const col = (this.columns as any)[k];
        return `"${col?.databasePath || k}" = EXCLUDED."${col?.databasePath || k}"`;
      })
      .join(', ');
    const query = `INSERT INTO ${this.getTableExpression()} (${columnNames}) VALUES (${placeholders}) ON CONFLICT (${onConflict}) DO UPDATE SET ${updateSet}`;
    await this.sql.unsafe(query, values);
  }

  async patch(options: FindOptionsWhere<TEntity>, body: QueryDeepPartialEntity<TEntity>): Promise<void> {
    const bodyEntries = Object.entries(body as any);
    if (bodyEntries.length === 0) return;
    const values: any[] = [];
    const setClauses = bodyEntries.map(([k, v]) => {
      values.push(v);
      const col = (this.columns as any)[k];
      return `"${col?.databasePath || k}" = $${values.length}`;
    });
    const whereEntries = Object.entries(options || {});
    const whereClauses = whereEntries.map(([k, v]) => {
      values.push(v);
      const col = (this.columns as any)[k];
      return `"${col?.databasePath || k}" = $${values.length}`;
    });
    const whereStr = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : '';
    const query = `UPDATE ${this.getTableExpression()} SET ${setClauses.join(', ')}${whereStr}`;
    await this.sql.unsafe(query, values);
  }
}