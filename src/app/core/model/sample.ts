import { ChildRelation, Family, LifeEvent, NEW_TREE_VIEW, Person, Sex, TreeDocument } from './types';

function ev(value?: string, place?: string, qualifier?: 'about'): LifeEvent | undefined {
  if (!value && !place) return undefined;
  const e: LifeEvent = {};
  if (value) e.date = qualifier ? { value, qualifier } : { value };
  if (place) e.place = place;
  return e;
}

interface P {
  id: string;
  sex: Sex;
  given: string;
  surname: string;
  birthSurname?: string;
  nickname?: string;
  born?: [string?, string?];
  died?: [string?, string?] | true;
  occupation?: string;
  notes?: string;
}

function person(p: P): Person {
  const out: Person = { id: p.id, sex: p.sex, name: { given: p.given, surname: p.surname } };
  if (p.birthSurname) out.name.birthSurname = p.birthSurname;
  if (p.nickname) out.name.nickname = p.nickname;
  const birth = p.born ? ev(p.born[0], p.born[1]) : undefined;
  if (birth) out.birth = birth;
  if (p.died === true) out.death = {};
  else if (p.died) out.death = ev(p.died[0], p.died[1]) ?? {};
  if (p.occupation) out.occupation = p.occupation;
  if (p.notes) out.notes = p.notes;
  return out;
}

function family(id: string, partners: string[], children: (string | [string, ChildRelation])[], extra: Partial<Family> = {}): Family {
  return {
    id,
    kind: 'marriage',
    partners,
    children: children.map((c) => (typeof c === 'string' ? { personId: c, relation: 'biological' } : { personId: c[0], relation: c[1] })),
    ...extra,
  };
}

/** A fictional five-generation family used to show what the chart can do. */
export function sampleDocument(now = new Date()): TreeDocument {
  const people: Person[] = [
    person({
      id: 'I1',
      sex: 'male',
      given: 'Thomas',
      surname: 'Ashworth',
      born: ['1898-03-14', 'Leeds, England'],
      died: ['1971-11-02', 'Leeds, England'],
      occupation: 'Bookbinder',
      notes: 'Ran a small bindery on Kirkgate for forty years.',
    }),
    person({
      id: 'I2',
      sex: 'female',
      given: 'Edith',
      surname: 'Ashworth',
      birthSurname: 'Barlow',
      born: ['1901-07-22', 'York, England'],
      died: ['1988', 'Leeds, England'],
    }),
    person({
      id: 'I3',
      sex: 'female',
      given: 'Florence',
      surname: 'Barlow',
      born: ['1904', 'York, England'],
      died: ['1990', 'Scarborough, England'],
      occupation: 'Milliner',
    }),
    person({
      id: 'I4',
      sex: 'male',
      given: 'Lucien',
      surname: 'Moreau',
      born: ['1903-01-09', 'Lyon, France'],
      died: ['1965', 'Lyon, France'],
      occupation: 'Silk weaver',
    }),
    person({
      id: 'I5',
      sex: 'female',
      given: 'Camille',
      surname: 'Moreau',
      birthSurname: 'Duval',
      born: ['1906', 'Lyon, France'],
      died: ['1994-02', 'Annecy, France'],
    }),

    person({
      id: 'I6',
      sex: 'male',
      given: 'Arthur',
      surname: 'Ashworth',
      born: ['1924-05-30', 'Leeds, England'],
      died: ['2003-08-17', 'Manchester, England'],
      occupation: 'Civil engineer',
    }),
    person({
      id: 'I7',
      sex: 'female',
      given: 'Margaret',
      surname: 'Ashworth',
      nickname: 'Peggy',
      born: ['1927-12-03', 'Leeds, England'],
      died: ['2019-04-09', 'Harrogate, England'],
      occupation: 'Schoolteacher',
    }),
    person({ id: 'I8', sex: 'male', given: 'Harold', surname: 'Ashworth', born: ['1931', 'Leeds, England'], died: ['2010', 'Leeds, England'] }),
    person({
      id: 'I9',
      sex: 'female',
      given: 'Hélène',
      surname: 'Ashworth',
      birthSurname: 'Moreau',
      born: ['1930-09-12', 'Lyon, France'],
      died: ['2016-01-25', 'Manchester, England'],
    }),
    person({ id: 'I10', sex: 'male', given: 'Jules', surname: 'Moreau', born: ['1934', 'Lyon, France'], died: ['2008', 'Grenoble, France'] }),

    person({ id: 'I11', sex: 'male', given: 'Simon', surname: 'Ashworth', born: ['1954-02-11', 'Manchester, England'], occupation: 'Architect' }),
    person({ id: 'I12', sex: 'female', given: 'Claire', surname: 'Ferri', birthSurname: 'Ashworth', born: ['1957-06-04', 'Manchester, England'] }),
    person({
      id: 'I13',
      sex: 'male',
      given: 'Daniel',
      surname: 'Ashworth',
      born: ['1961', 'Salford, England'],
      notes: 'Adopted by Arthur and Hélène in 1963.',
    }),
    person({ id: 'I14', sex: 'female', given: 'Ruth', surname: 'Kelly', born: ['1955', 'Dublin, Ireland'] }),
    person({ id: 'I15', sex: 'female', given: 'Šárka', surname: 'Ashworth', birthSurname: 'Nováková', born: ['1964-03-08', 'Brno, Czechia'] }),
    person({
      id: 'I16',
      sex: 'male',
      given: 'Jiří',
      surname: 'Novák',
      born: ['1938', 'Brno, Czechia'],
      died: ['2015-10', 'Brno, Czechia'],
      occupation: 'Machinist',
    }),
    person({ id: 'I17', sex: 'female', given: 'Věra', surname: 'Nováková', birthSurname: 'Dvořáková', born: ['1941-11-27', 'Olomouc, Czechia'] }),
    person({ id: 'I18', sex: 'male', given: 'Marco', surname: 'Ferri', born: ['1955', 'Turin, Italy'] }),
    person({ id: 'I19', sex: 'female', given: 'Sophie', surname: 'Moreau', born: ['1960', 'Grenoble, France'] }),

    person({ id: 'I20', sex: 'female', given: 'Emily', surname: 'Grant', birthSurname: 'Ashworth', born: ['1981-09-14', 'Manchester, England'] }),
    person({ id: 'I21', sex: 'male', given: 'Jack', surname: 'Ashworth', born: ['1984', 'Manchester, England'] }),
    person({ id: 'I22', sex: 'male', given: 'Tomáš', surname: 'Ashworth', born: ['1993-01-30', 'Manchester, England'] }),
    person({ id: 'I23', sex: 'male', given: 'Luca', surname: 'Ferri', born: ['1985', 'Turin, Italy'] }),
    person({ id: 'I24', sex: 'female', given: 'Giulia', surname: 'Ferri', born: ['1988', 'Turin, Italy'] }),
    person({ id: 'I25', sex: 'male', given: 'Oliver', surname: 'Grant', born: ['1980', 'Bristol, England'] }),
    person({ id: 'I26', sex: 'female', given: 'Mia', surname: 'Chen', born: ['1994', 'Vancouver, Canada'] }),

    person({ id: 'I27', sex: 'female', given: 'Isla', surname: 'Grant', born: ['2012-04-02', 'Bristol, England'] }),
    person({ id: 'I28', sex: 'male', given: 'Noah', surname: 'Grant', born: ['2015', 'Bristol, England'] }),
    person({ id: 'I29', sex: 'male', given: 'Leo', surname: 'Ashworth', born: ['2022-08-19', 'Manchester, England'] }),
  ];

  const families: Family[] = [
    family('F1', ['I1', 'I2'], ['I6', 'I7', 'I8'], { start: ev('1922-06-10', 'York, England') }),
    family('F2', [], ['I2', 'I3'], { kind: 'unknown' }),
    family('F3', ['I4', 'I5'], ['I9', 'I10'], { start: ev('1929', 'Lyon, France') }),
    family('F4', ['I6', 'I9'], ['I11', 'I12', ['I13', 'adopted']], { start: ev('1952-07-19', 'Lyon, France') }),
    family('F5', ['I11', 'I14'], ['I20', 'I21'], { start: ev('1979', 'Manchester, England'), end: { reason: 'divorce', date: { value: '1988' } } }),
    family('F6', ['I11', 'I15'], ['I22'], { start: ev('1991-05-18', 'Brno, Czechia') }),
    family('F7', ['I16', 'I17'], ['I15'], { start: ev('1962', 'Brno, Czechia') }),
    family('F8', ['I18', 'I12'], ['I23', 'I24'], { start: ev('1983', 'Turin, Italy') }),
    family('F9', ['I10'], ['I19']),
    family('F10', ['I25', 'I20'], ['I27', 'I28'], { start: ev('2010', 'Bristol, England') }),
    family('F11', ['I22', 'I26'], ['I29'], { kind: 'partnership', start: ev('2019'), engagement: ev('2024-12-24', 'Prague, Czechia') }),
  ];

  const stamp = now.toISOString();
  return {
    meta: {
      title: 'The Ashworth family',
      description: 'An example tree. Five generations across England, France, Czechia and Italy.',
      created: stamp,
      modified: stamp,
      homePersonId: 'I11',
    },
    view: { ...NEW_TREE_VIEW },
    people,
    families,
  };
}
