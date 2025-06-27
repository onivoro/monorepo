import { tryJsonStringify } from './try-json-stringify';

const arbitraryNumber: number = 337;

describe('tryJsonStringify', () => {
  describe('GIVEN input is stringifiable', () => {
    describe.each([
      [0, '0'],
      ['0', '"0"'],
      [arbitraryNumber, expect.stringMatching(/\d/)],
      [arbitraryNumber.toString(), expect.stringMatching(/\d/)],
      [false, 'false'],
      ['false', '"false"'],
      [true, 'true'],
      ['true', '"true"'],
      ['', '""'],
      [{ test: arbitraryNumber }, expect.stringMatching(new RegExp(`"test".*${arbitraryNumber}`))],
      [{ test: arbitraryNumber.toString() }, expect.stringMatching(new RegExp(`"test".*"${arbitraryNumber}"`))],
      ['randommmm', expect.any(String)],
      ['so random', expect.any(String)],
    ])('WHEN input is: %j', (input, expectedOutput) => {
      it(`returns ${expectedOutput}`, () => {
        expect(tryJsonStringify(input as any)).toEqual(expectedOutput);
      });
    });
  });

  describe('GIVEN input is not stringifiable', () => {
    let circularObject: any;

    beforeEach(() => {
      circularObject = { children: [] };
      const circularObjectChild = { parent: circularObject };
      circularObject.children.push(circularObjectChild);
    });

    describe('WHEN input is circular', () => {
      it(`returns null`, () => {
        expect(tryJsonStringify(circularObject)).toMatchSnapshot();
        // expect(tryJsonStringify(circularObject)).toEqual(null);
      });
    });
  });
});
