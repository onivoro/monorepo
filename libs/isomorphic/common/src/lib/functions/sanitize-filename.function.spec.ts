import { sanitizeFilename } from './sanitize-filename.function';

describe('sanitizeFilename', () => {
  it('leaves safe filenames alone', () => {
    expect(sanitizeFilename('report-2024.final.pdf')).toBe(
      'report-2024.final.pdf',
    );
  });

  it('replaces reserved ascii characters with underscores', () => {
    expect(
      sanitizeFilename('a/b?c:d\\e{f^g\'h}i%j`k]l>m[n~o<p#q|r"s!t*u'),
    ).toBe('a_b_c_d_e_f_g_h_i_j_k_l_m_n_o_p_q_r_s_t_u');
  });

  it('replaces non-ascii characters with underscores', () => {
    expect(sanitizeFilename('résumé.pdf')).toBe('r_sum_.pdf');
  });

  it('collapses runs of underscores', () => {
    expect(sanitizeFilename('a///b__c')).toBe('a_b_c');
  });

  it('trims surrounding whitespace', () => {
    expect(sanitizeFilename('  name.txt  ')).toBe('name.txt');
  });
});
