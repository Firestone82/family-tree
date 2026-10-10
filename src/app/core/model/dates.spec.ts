import { ageBetween, dateSortKey, formatDateLong, formatDateShort, isValidDateValue, lifespanLabel, parseDateInput } from './dates';

describe('dates', () => {
  it('validates partial ISO dates', () => {
    expect(isValidDateValue('1923')).toBe(true);
    expect(isValidDateValue('1923-05')).toBe(true);
    expect(isValidDateValue('1924-02-29')).toBe(true);
    expect(isValidDateValue('1923-02-29')).toBe(false);
    expect(isValidDateValue('1923-13')).toBe(false);
    expect(isValidDateValue('23-05-1923')).toBe(false);
  });

  it('reads the ways people type dates', () => {
    expect(parseDateInput('1923')).toEqual({ value: '1923' });
    expect(parseDateInput('17.5.1923')).toEqual({ value: '1923-05-17' });
    expect(parseDateInput('17/05/1923')).toEqual({ value: '1923-05-17' });
    expect(parseDateInput('5/17/1923')).toEqual({ value: '1923-05-17' });
    expect(parseDateInput('17 May 1923')).toEqual({ value: '1923-05-17' });
    expect(parseDateInput('17th May 1923')).toEqual({ value: '1923-05-17' });
    expect(parseDateInput('May 17, 1923')).toEqual({ value: '1923-05-17' });
    expect(parseDateInput('Sept 1923')).toEqual({ value: '1923-09' });
    expect(parseDateInput('1923-05-17')).toEqual({ value: '1923-05-17' });
  });

  it('reads Czech month names and qualifiers', () => {
    expect(parseDateInput('17. května 1923')).toEqual({ value: '1923-05-17' });
    expect(parseDateInput('17. kvetna 1923')).toEqual({ value: '1923-05-17' });
    expect(parseDateInput('květen 1923')).toEqual({ value: '1923-05' });
    expect(parseDateInput('Prosinec 1923')).toEqual({ value: '1923-12' });
    expect(parseDateInput('17. 5. 1923')).toEqual({ value: '1923-05-17' });
    expect(parseDateInput('5. 1923')).toEqual({ value: '1923-05' });
    expect(parseDateInput('asi 1900')).toEqual({ value: '1900', qualifier: 'about' });
    expect(parseDateInput('před 1850')).toEqual({ value: '1850', qualifier: 'before' });
    expect(parseDateInput('po 1850')).toEqual({ value: '1850', qualifier: 'after' });
    expect(parseDateInput('approximately 1900')).toEqual({ value: '1900', qualifier: 'about' });
    expect(parseDateInput('>1900')).toEqual({ value: '1900', qualifier: 'after' });
    expect(parseDateInput('05.1923')).toEqual({ value: '1923-05' });
  });

  it('reads qualifiers', () => {
    expect(parseDateInput('abt 1900')).toEqual({ value: '1900', qualifier: 'about' });
    expect(parseDateInput('c. 1900')).toEqual({ value: '1900', qualifier: 'about' });
    expect(parseDateInput('before 3 March 1850')).toEqual({ value: '1850-03-03', qualifier: 'before' });
    expect(parseDateInput('aft. 1850')).toEqual({ value: '1850', qualifier: 'after' });
    expect(parseDateInput('est 1880')).toEqual({ value: '1880', qualifier: 'estimated' });
  });

  it('keeps unrecognised wording as text', () => {
    expect(parseDateInput('Easter 1902')).toEqual({ value: '', text: 'Easter 1902' });
    expect(parseDateInput('  ')).toBeUndefined();
    expect(parseDateInput('31.2.1900')).toEqual({ value: '', text: '31.2.1900' });
  });

  it('formats dates', () => {
    expect(formatDateLong({ value: '1923-05-17' })).toBe('17 May 1923');
    expect(formatDateLong({ value: '1923-05', qualifier: 'about' })).toBe('about May 1923');
    expect(formatDateShort({ value: '1923-05-17', qualifier: 'before' })).toBe('bef. 1923');
    expect(formatDateShort({ value: '', text: 'Easter 1902' })).toBe('Easter 1902');
  });

  it('builds lifespan labels', () => {
    expect(lifespanLabel({ birth: { date: { value: '1898' } }, death: { date: { value: '1971-11-02' } } })).toBe('1898 – 1971');
    expect(lifespanLabel({ birth: { date: { value: '1993' } } })).toBe('b. 1993');
    expect(lifespanLabel({ death: { date: { value: '1971' } } })).toBe('† 1971');
    expect(lifespanLabel({ birth: { date: { value: '1898' } }, death: {} })).toBe('1898 – †');
    expect(lifespanLabel({ death: {} })).toBe('†');
    expect(lifespanLabel({})).toBe('');
  });

  it('sorts partial dates between their neighbours', () => {
    const jan = dateSortKey({ value: '1923-01-01' })!;
    const year = dateSortKey({ value: '1923' })!;
    const dec = dateSortKey({ value: '1923-12-31' })!;
    expect(jan).toBeLessThan(year);
    expect(year).toBeLessThan(dec);
  });

  it('computes ages', () => {
    expect(ageBetween({ value: '1898-03-14' }, { value: '1971-11-02' })).toEqual({ years: 73, approximate: false });
    expect(ageBetween({ value: '1898-12-14' }, { value: '1971-11-02' })).toEqual({ years: 72, approximate: false });
    expect(ageBetween({ value: '1898' }, { value: '1971' })).toEqual({ years: 73, approximate: true });
  });
});
