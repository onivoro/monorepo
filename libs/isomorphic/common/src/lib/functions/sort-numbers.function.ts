export const sortNumbers = (a: number, b: number) => {
  if (Number(a) === Number(b)) {
    return 0;
  }

  return Number(a) < Number(b) ? -1 : 1;
};
