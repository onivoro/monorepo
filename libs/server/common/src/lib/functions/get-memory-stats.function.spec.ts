jest.mock('node:os', () => ({
  freemem: jest.fn(() => 250),
  totalmem: jest.fn(() => 1000),
}));

import { getMemoryStats } from './get-memory-stats.function';

describe('getMemoryStats', () => {
  it('reports free and total memory from the OS', () => {
    const stats = getMemoryStats();
    expect(stats.free).toBe(250);
    expect(stats.total).toBe(1000);
  });

  it('reports percentUtilization as the used percentage', () => {
    expect(getMemoryStats().percentUtilization).toBe(75);
  });
});
