import { BackgroundError, mediaTypeOf, normalizeSvg } from './background-import';

describe('background pictures', () => {
  it('makes an SVG scalable and drops scripts and event handlers', () => {
    const { svg, width, height } = normalizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" onload="x()"><script>alert(1)</script><circle r="5"/></svg>',
    );
    expect(width).toBeCloseTo(793.7, 1);
    expect(height).toBeCloseTo(1122.5, 1);
    expect(svg).toContain('viewBox="0 0 793.7');
    expect(svg).not.toContain('script');
    expect(svg).not.toContain('onload');
    // A viewBox gives the size.
    expect(normalizeSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 30" width="100%"><rect width="40" height="30"/></svg>')).toMatchObject({
      width: 40,
      height: 30,
    });
  });

  it('refuses what is not a picture', () => {
    expect(() => normalizeSvg('<html><body/></html>')).toThrow(BackgroundError);
    expect(() => normalizeSvg('<svg xmlns="http://www.w3.org/2000/svg"></svg>')).toThrow(BackgroundError);
  });

  it('knows a file by its name when the browser does not say', () => {
    expect(mediaTypeOf({ name: 'Oak.SVG', type: '' })).toBe('image/svg+xml');
    expect(mediaTypeOf({ name: 'tree.pdf', type: 'application/octet-stream' })).toBe('application/pdf');
    expect(mediaTypeOf({ name: 'photo', type: 'image/jpeg' })).toBe('image/jpeg');
    expect(mediaTypeOf({ name: 'notes.txt', type: '' })).toBe('');
  });
});
