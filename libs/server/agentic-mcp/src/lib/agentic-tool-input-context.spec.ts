import { normalizeAgenticToolInputFromContext } from './agentic-tool-input-context';

const schema = (...keys: string[]) => ({
  type: 'object',
  properties: Object.fromEntries(keys.map((key) => [key, { type: 'string' }])),
});

describe('normalizeAgenticToolInputFromContext', () => {
  it('is a pass-through when no context keys are configured', () => {
    expect(
      normalizeAgenticToolInputFromContext(
        { a: 1 },
        { invoiceId: 4471 },
        schema('invoiceId'),
      ),
    ).toEqual({ a: 1 });
  });

  it('fills a declared property from conversation metadata', () => {
    expect(
      normalizeAgenticToolInputFromContext(
        {},
        { invoiceId: 4471 },
        schema('invoiceId'),
        { contextKeys: ['invoiceId'] },
      ),
    ).toEqual({ invoiceId: 4471 });
  });

  it('reads metadata.identifiers as well as metadata itself', () => {
    expect(
      normalizeAgenticToolInputFromContext(
        {},
        { identifiers: { invoiceId: 4471 } },
        schema('invoiceId'),
        { contextKeys: ['invoiceId'] },
      ),
    ).toEqual({ invoiceId: 4471 });
  });

  // the model's own argument is the one it reasoned about; context only fills gaps
  it('never overwrites a value the model supplied', () => {
    expect(
      normalizeAgenticToolInputFromContext(
        { invoiceId: 'explicit' },
        { invoiceId: 4471 },
        schema('invoiceId'),
        { contextKeys: ['invoiceId'] },
      ),
    ).toEqual({ invoiceId: 'explicit' });
  });

  it('does not invent properties the tool did not declare', () => {
    expect(
      normalizeAgenticToolInputFromContext(
        {},
        { invoiceId: 4471, customerId: 9 },
        schema('invoiceId'),
        { contextKeys: ['invoiceId', 'customerId'] },
      ),
    ).toEqual({ invoiceId: 4471 });
  });

  it('resolves a canonical key from an aliased metadata key', () => {
    expect(
      normalizeAgenticToolInputFromContext(
        {},
        { accountId: 77 },
        schema('customerId'),
        {
          contextKeys: ['customerId'],
          aliases: { customerId: ['accountId'] },
        },
      ),
    ).toEqual({ customerId: 77 });
  });

  // populating both invites the model to disagree with itself about which id
  // the call is actually for
  it('drops an alias the tool does not declare alongside the canonical key', () => {
    expect(
      normalizeAgenticToolInputFromContext(
        { accountId: 77 },
        {},
        schema('customerId'),
        {
          contextKeys: ['customerId'],
          aliases: { customerId: ['accountId'] },
        },
      ),
    ).toEqual({ customerId: 77 });
  });

  it('keeps both when the tool declares both', () => {
    const result = normalizeAgenticToolInputFromContext(
      { accountId: 77 },
      {},
      schema('customerId', 'accountId'),
      { contextKeys: ['customerId'], aliases: { customerId: ['accountId'] } },
    );

    expect(result).toEqual({ accountId: 77, customerId: 77 });
  });

  it('fills a nested filters bag when the tool declares one', () => {
    expect(
      normalizeAgenticToolInputFromContext(
        {},
        { customerId: 9, regionId: 3 },
        schema('filters'),
        {
          contextKeys: ['customerId', 'regionId'],
          filtersKey: 'filters',
        },
      ),
    ).toEqual({ filters: { customerId: 9, regionId: 3 } });
  });

  it('honours filtersExclude', () => {
    expect(
      normalizeAgenticToolInputFromContext(
        {},
        { customerId: 9, resourceId: 'r1' },
        schema('filters'),
        {
          contextKeys: ['customerId', 'resourceId'],
          filtersKey: 'filters',
          filtersExclude: ['resourceId'],
        },
      ),
    ).toEqual({ filters: { customerId: 9 } });
  });

  it('coerces a non-object input to an empty object', () => {
    expect(
      normalizeAgenticToolInputFromContext('nonsense', {}, schema('a'), {
        contextKeys: ['a'],
      }),
    ).toEqual({});
  });
});
