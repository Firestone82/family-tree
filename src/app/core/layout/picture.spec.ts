import { pictureBox } from './picture';

describe('placing a picture', () => {
  const area = { x: 0, y: 0, w: 400, h: 200 };

  it('fills the area, sticking out on two sides, or fits the whole picture inside', () => {
    // A square picture in a wide area.
    expect(pictureBox(area, { width: 100, height: 100, fit: 'cover' })).toEqual({ x: 0, y: -100, w: 400, h: 400 });
    expect(pictureBox(area, { width: 100, height: 100, fit: 'contain' })).toEqual({ x: 100, y: 0, w: 200, h: 200 });
    // Same proportions as the area: exactly the area either way.
    expect(pictureBox(area, { width: 800, height: 400, fit: 'cover' })).toEqual(area);
  });
});
