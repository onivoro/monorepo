/**
 * Injectable strategy for listing resources that match a resource template.
 * Implement as an `@Injectable()` NestJS service with full DI access.
 *
 * Used with `McpResource({ listStrategy: MyListStrategy })` on template resources.
 */
export interface McpResourceListStrategy {
  list(): any | Promise<any>;
}
