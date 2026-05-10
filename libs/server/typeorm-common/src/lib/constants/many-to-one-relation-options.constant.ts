import { RelationOptions } from "typeorm";

export const manyToOneRelationOptions: RelationOptions = { cascade: true, onDelete: 'CASCADE', orphanedRowAction: 'delete', onUpdate: 'CASCADE' };
