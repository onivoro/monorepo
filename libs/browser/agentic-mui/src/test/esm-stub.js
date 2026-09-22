/* eslint-disable */

/**
 * Stands in for the ESM-only markdown dependencies.
 *
 * react-markdown and remark-gfm ship ESM, which jest will not parse under this
 * preset, and they are reached transitively -- the drawer imports the chat
 * surface, which renders markdown. Nothing under test here renders a message, so
 * a stub is honest rather than a workaround: if a spec ever needs real markdown
 * rendering it should say so by dropping this mapping for itself.
 */
module.exports = function EsmStub({ children }) {
  return children ?? null;
};
module.exports.default = module.exports;
