import { tryJsonParse } from './try-json-parse';

describe('tryJsonParse', () => {
  describe('GIVEN input is parseable', () => {
    describe.each([
      [0, 0],
      ['0', 0],
      [337, expect.any(Number)],
      [`${337}`, expect.any(Number)],
      [false, false],
      ['false', false],
      [true, true],
      ['true', true],
      [`{ "test":  ${337}  }`, expect.objectContaining({ test: expect.any(Number) })],
      [`{ "test": "${337}" }`, expect.objectContaining({ test: expect.stringMatching(/\d/) })],
    ])('WHEN input is: %j', (input, expectedOutput) => {
      it(`returns ${expectedOutput}`, () => {
        expect(tryJsonParse(input as any)).toEqual(expectedOutput);
      });
    });
  });

  describe('GIVEN input is not parseable', () => {
    describe.each([
      ['', null],
      [null, null],
      [undefined, null],
      [NaN, null],
      ['randomness', null],
      ['totally random', null],
    ])('WHEN input is: %j', (input, expectedOutput) => {
      it(`returns ${expectedOutput}`, () => {
        expect(tryJsonParse(input as any)).toEqual(expectedOutput);
      });
    });
  });
});
