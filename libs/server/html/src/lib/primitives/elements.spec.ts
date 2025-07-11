import {
  element
} from './element.function';
import { TElementRenderer } from '../types/element-renderer.type';

import {
  selfClosingElement
} from './self-closing-element.function';
import { TSelfClosingElementRenderer } from '../types/self-closing-element-renderer.type';

const div: TElementRenderer = element.bind(null, 'div');
const img: TSelfClosingElementRenderer = selfClosingElement.bind(null, 'img');

const logoUrl = 'https://blah.blah.com/blah.jpg';

describe('elements', () => {
  it.each([
    [div(['content goes here'], { cssClass: 'css-class-goes-here', 'data-blah': 'blahblah', style: { width: '100%', height: '30px' } })],
    [img({ height: "64", width: "auto", src: logoUrl })]
  ])('renders an HTML string', (rendering) => {
    expect(rendering).toMatchSnapshot();
  });
});
