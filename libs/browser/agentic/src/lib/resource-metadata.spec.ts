import { buildAgenticConversationPath } from './agentic-conversation-path';
import {
  agenticResourceConversationId,
  resourceContextMetadata,
  scopedAgenticResourceConversationId,
} from './resource-metadata';

describe(resourceContextMetadata.name, () => {
  it('returns undefined without a resource context', () => {
    expect(resourceContextMetadata(undefined)).toBeUndefined();
  });

  it('flattens identifiers, drops undefined values and lets resource fields win', () => {
    expect(
      resourceContextMetadata({
        resourceType: 'patient',
        resourceId: 42,
        label: 'Jane',
        identifiers: { mrn: 'M1', ssn: undefined, active: true, none: null },
        metadata: {
          resourceType: 'overridden',
          extra: 'x',
          nested: {
            keep: 1,
            drop: undefined as never,
            list: [1, undefined as never],
          },
        },
      }),
    ).toEqual({
      extra: 'x',
      nested: { keep: 1, list: [1, null] },
      mrn: 'M1',
      active: true,
      none: null,
      identifiers: { mrn: 'M1', active: true, none: null },
      resourceId: 42,
      resourceLabel: 'Jane',
      resourceType: 'patient',
    });
  });

  it('omits the label when absent and tolerates no identifiers', () => {
    expect(
      resourceContextMetadata({ resourceType: 'order', resourceId: 'o1' }),
    ).toEqual({ identifiers: {}, resourceId: 'o1', resourceType: 'order' });
  });
});

describe('conversation ids', () => {
  it('joins sanitised parts with colons', () => {
    expect(agenticResourceConversationId('my app', 'pa:tient', 12)).toBe(
      'my_app:pa_tient:12',
    );
    expect(agenticResourceConversationId('a.b-c_d', 'x', 'y/z')).toBe(
      'a.b-c_d:x:y_z',
    );
  });

  it('appends a sanitised scope', () => {
    expect(
      scopedAgenticResourceConversationId('app', 'order', 'o1', 'user@x'),
    ).toBe('app:order:o1:user_x');
  });
});

describe(buildAgenticConversationPath.name, () => {
  it('encodes the conversation id', () => {
    expect(buildAgenticConversationPath('/chat', 'a:b/c')).toBe(
      '/chat/a%3Ab%2Fc',
    );
    expect(buildAgenticConversationPath('chat', 'c1')).toBe('chat/c1');
  });
});
