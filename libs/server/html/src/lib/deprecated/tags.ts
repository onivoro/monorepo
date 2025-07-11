import { THtmlElementRenderer } from "./html-element-renderer.type";
import { TSelfClosingHtmlElementRenderer } from "./self-closing-html-element-renderer.type";
import { selfClosingTag } from "./self-closing-tag.function";
import { tag } from "./tag.function";

export const _body: THtmlElementRenderer = tag.bind(null, 'body');
export const _div: THtmlElementRenderer = tag.bind(null, 'div');
export const _h1: THtmlElementRenderer = tag.bind(null, 'h1');
export const _h2: THtmlElementRenderer = tag.bind(null, 'h2');
export const _h3: THtmlElementRenderer = tag.bind(null, 'h3');
export const _h4: THtmlElementRenderer = tag.bind(null, 'h4');
export const _h5: THtmlElementRenderer = tag.bind(null, 'h5');
export const _h6: THtmlElementRenderer = tag.bind(null, 'h6');
export const _head: THtmlElementRenderer = tag.bind(null, 'head');
export const _header: THtmlElementRenderer = tag.bind(null, 'header');
export const _htm: THtmlElementRenderer = tag.bind(null, 'html');
export const _img: TSelfClosingHtmlElementRenderer = selfClosingTag.bind(null, 'img');
export const _main: THtmlElementRenderer = tag.bind(null, 'main');
export const _p: THtmlElementRenderer = tag.bind(null, 'p');
export const _pre: THtmlElementRenderer = tag.bind(null, 'pre');
export const _tab: THtmlElementRenderer = tag.bind(null, 'table');
export const _tbody: THtmlElementRenderer = tag.bind(null, 'tbody');
export const _td: THtmlElementRenderer = tag.bind(null, 'td');
export const _th: THtmlElementRenderer = tag.bind(null, 'th');
export const _thead: THtmlElementRenderer = tag.bind(null, 'thead');
export const _tr: THtmlElementRenderer = tag.bind(null, 'tr');

export const _style = tag.bind(null, 'style');
