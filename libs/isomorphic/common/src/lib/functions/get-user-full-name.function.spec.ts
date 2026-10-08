import { getUserFullName } from './get-user-full-name.function';

describe('getUserFullName', () => {
  it('joins first and last name with a space', () => {
    expect(getUserFullName({ firstName: 'Ada', lastName: 'Lovelace' })).toBe(
      'Ada Lovelace',
    );
  });
});
