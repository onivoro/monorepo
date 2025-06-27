/* eslint-disable no-control-regex */

const _ = '_';
const asciiReplacementRegX = /\/|\?|:|\\|{|\^|'|\}|%|`|]|>|\[|~|<|#|\||"|!|\*/g;
const unicodeReplacementRegX = /[^\u0000-\u007F]/g;

export function sanitizeFilename(filename: string) {
  return filename.replace(unicodeReplacementRegX, _).replace(asciiReplacementRegX, _).replace(/_+/g, _).trim();
}