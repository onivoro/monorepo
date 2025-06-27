export function formatUsd(rawAmount?: number | string) {
    const amount = Number(rawAmount) || 0;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }