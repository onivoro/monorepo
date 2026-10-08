import { sanitizeFilename } from './sanitize-filename.function';

describe(sanitizeFilename.name, () => {
  it.each([
    ['plain-name_1.txt', 'plain-name_1.txt'],
    ['résumé 2024.pdf', 'r_sum_ 2024.pdf'],
    ['日本.txt', '_.txt'],
    ['a/b?c:d.txt', 'a_b_c_d.txt'],
    ['back\\slash.txt', 'back_slash.txt'],
    ['q"w#e%r.txt', 'q_w_e_r.txt'],
    ["{a}^b'c`d.txt", '_a_b_c_d.txt'],
    ['[a]<b>~c|d.txt', '_a_b_c_d.txt'],
    ['x!!y*z.png', 'x_y_z.png'],
    ['a__b', 'a_b'],
    ['  spaced name.txt  ', 'spaced name.txt'],
  ])('sanitizes %j to %j', (input, expected) => {
    expect(sanitizeFilename(input)).toBe(expected);
  });
});
