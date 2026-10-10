import { unionMark } from './union-marks';

describe('union markers', () => {
  it('draws interlocked rings for a marriage and pulls them apart when it ended', () => {
    const married = unionMark('marriage', 'married', 4.6);
    const [a, b] = married.rings;
    expect(married.apart).toBe(false);
    expect(married.slash).toBeUndefined();
    // The rings overlap…
    expect(b.cx - a.cx).toBeLessThan(a.r + b.r);

    const divorced = unionMark('marriage', 'divorced', 4.6);
    const [c, d] = divorced.rings;
    expect(divorced.apart).toBe(true);
    // …and no longer touch after a divorce, with a slash between them that reaches past the plate.
    expect(d.cx - c.cx).toBeGreaterThan(c.r + d.r);
    expect(divorced.slash).toMatch(/^M[\d.]+,-[\d.]+L-[\d.]+,[\d.]+$/);
    const top = Number(divorced.slash!.split(',')[1].split('L')[0]);
    expect(top).toBeLessThan(divorced.plate.y);
    // The plate is wide enough for both rings.
    expect(divorced.plate.x).toBeLessThan(c.cx - c.r);
    expect(divorced.plate.x + divorced.plate.w).toBeGreaterThan(d.cx + d.r);
  });

  it('keeps separated couples apart without the slash, and marks other kinds of union', () => {
    expect(unionMark('marriage', 'separated', 4).slash).toBeUndefined();
    expect(unionMark('marriage', 'separated', 4).apart).toBe(true);
    expect(unionMark('marriage', 'annulled', 4).slash).toBeDefined();
    expect(unionMark('marriage', 'widowed', 4).apart).toBe(false);
    expect(unionMark('partnership', 'ended', 4).slash).toBeDefined();
    expect(unionMark('partnership', 'partners', 4).rings).toHaveLength(1);
    expect(unionMark('partnership', 'engaged', 4).stone).toBeDefined();
    expect(unionMark('unknown', 'unknown', 4).dot).toBeGreaterThan(0);
  });
});
