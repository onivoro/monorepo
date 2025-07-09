export const filenameSanitizationMap: {
  replace: RegExp;
  replacement: string;
}[] = [
  { replace: /!/g, replacement: '-' },
  { replace: /:/g, replacement: '_' },
];
