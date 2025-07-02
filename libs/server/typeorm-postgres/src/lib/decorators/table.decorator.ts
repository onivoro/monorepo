import { applyDecorators } from "@nestjs/common";
import { Entity } from "typeorm";
import { snakeCase } from '@onivoro/isomorphic-common';

export const Table = (EntityClass: { name: string }) => {
    const tableName = snakeCase(EntityClass.name);
    return applyDecorators(Entity(tableName));
};
