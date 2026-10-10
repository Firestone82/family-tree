import { displayName, initials, surnameKey, surnameLine } from './names';
import { Person } from './types';

const p = (given: string, surname: string, birthSurname?: string): Person => ({
  id: 'I1',
  sex: 'unknown',
  name: birthSurname ? { given, surname, birthSurname } : { given, surname },
});

describe('names', () => {
  it('groups feminine and masculine forms of a family name', () => {
    expect(surnameKey('Novák')).toBe(surnameKey('Nováková'));
    expect(surnameKey('Svoboda')).toBe(surnameKey('Svobodová'));
    expect(surnameKey('Černý')).toBe(surnameKey('Černá'));
    expect(surnameKey('Nový')).toBe(surnameKey('Nová'));
    expect(surnameKey('Kowalski')).toBe(surnameKey('Kowalska'));
    expect(surnameKey('Ivanov')).toBe(surnameKey('Ivanova'));
    expect(surnameKey('NOVAK')).toBe(surnameKey('Novák'));
  });

  it('keeps different families apart', () => {
    expect(surnameKey('Ashworth')).not.toBe(surnameKey('Moreau'));
    expect(surnameKey('Novák')).not.toBe(surnameKey('Nový'));
    expect(surnameKey('')).toBe('');
  });

  it('formats names', () => {
    expect(displayName(p('Anna Marie', 'Hartmann'))).toBe('Anna Marie Hartmann');
    expect(displayName(p('', ''))).toBe('Unnamed person');
    expect(surnameLine(p('Hélène', 'Ashworth', 'Moreau'))).toBe('Ashworth née Moreau');
    expect(surnameLine(p('Hélène', 'Ashworth', 'Ashworth'))).toBe('Ashworth');
  });

  it('takes whole characters for initials', () => {
    expect(initials(p('Šárka', 'Ashworth'))).toBe('ŠA');
    expect(initials(p('Šárka', 'novák'))).toBe('ŠN');
    expect(initials(p('', ''))).toBe('?');
  });
});
