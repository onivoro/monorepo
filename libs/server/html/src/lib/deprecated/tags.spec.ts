import {
  _div as div, _img as img
} from './tags';

const logoUrl = 'https://blah.blah.com/blah.jpg';

describe('tags', () => {
  it.each([
    [div(['content goes here'], 'css-class-goes-here', { 'data-blah': 'blahblah' }, { width: '100%', height: '30px' })],
    [img(undefined, { height: "64", width: "auto", src: logoUrl })]
  ])('renders an HTML string', (rendering) => {
    expect(rendering).toMatchSnapshot();
  });
});
