/**
 * Injectable provider for listing resources that match a resource template.
 * Implement as an `@Injectable()` NestJS service with full DI access.
 *
 * Used with `McpResource({ listProvider: MyListProvider })` on template resources.
 */
export interface McpResourceListProvider {
  list(): any | Promise<any>;
}
