import { mergeAgenticUsage } from './agentic-usage.types';

describe(mergeAgenticUsage.name, () => {
  it('returns the other side when one is missing', () => {
    const usage = { inputTokens: 1 };
    expect(mergeAgenticUsage(undefined, usage)).toBe(usage);
    expect(mergeAgenticUsage(usage, undefined)).toBe(usage);
    expect(mergeAgenticUsage(undefined, undefined)).toBeUndefined();
  });

  it('sums every counter and merges provider metadata', () => {
    expect(
      mergeAgenticUsage(
        {
          inputTokens: 1,
          outputTokens: 2,
          nonCachedInputTokens: 3,
          cacheReadInputTokens: 4,
          cacheWriteInputTokens: 5,
          reasoningTokens: 6,
          totalTokens: 7,
          providerMetadata: { a: { x: 1 }, b: { y: 1 } },
        },
        {
          inputTokens: 10,
          outputTokens: 20,
          nonCachedInputTokens: 30,
          cacheReadInputTokens: 40,
          cacheWriteInputTokens: 50,
          reasoningTokens: 60,
          totalTokens: 70,
          providerMetadata: { b: { y: 2 } },
        },
      ),
    ).toEqual({
      inputTokens: 11,
      outputTokens: 22,
      nonCachedInputTokens: 33,
      cacheReadInputTokens: 44,
      cacheWriteInputTokens: 55,
      reasoningTokens: 66,
      totalTokens: 77,
      providerMetadata: { a: { x: 1 }, b: { y: 2 } },
    });
  });

  it('keeps a counter present on only one side and leaves absent ones undefined', () => {
    const merged = mergeAgenticUsage({ inputTokens: 5 }, { outputTokens: 3 });
    expect(merged).toEqual({
      inputTokens: 5,
      outputTokens: 3,
      providerMetadata: {},
    });
    expect(merged?.totalTokens).toBeUndefined();
  });
});
