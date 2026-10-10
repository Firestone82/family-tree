import { sampleDocument } from '../model/sample';
import { DEFAULT_PRINT, DEFAULT_VIEW, TreeDocument } from '../model/types';
import { CURRENT_FORMAT } from './format';
import { XmlMigration } from './migrations';
import { parseTree, XmlFormatError } from './parser';
import { serializeTree } from './serializer';
import { SAVED_BY_1_0 } from './fixtures/saved-by-1-0';

const NS = 'urn:stemma:family-tree';

function roundTrip(doc: TreeDocument): TreeDocument {
  return parseTree(serializeTree(doc)).doc;
}

describe('XML format', () => {
  it('round-trips the sample family without loss', () => {
    const doc = sampleDocument(new Date('2026-01-01T00:00:00Z'));
    const back = roundTrip(doc);
    expect(back).toEqual(doc);
  });

  it('writes the version, namespace and generator', () => {
    const xml = serializeTree(sampleDocument());
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain(`xmlns="${NS}"`);
    expect(xml).toContain(`formatVersion="${CURRENT_FORMAT.major}.${CURRENT_FORMAT.minor}"`);
    expect(xml).toMatch(/generator="Stemma \d+\.\d+\.\d+"/);
  });

  it('escapes special characters and keeps non-Latin text', () => {
    const doc = sampleDocument();
    doc.people[0].name.given = 'Tom "Tiny" <O\'Brien> & Šárka 漢字';
    doc.people[0].notes = 'Line one\nLine two & more <tags>';
    doc.meta.title = 'Quotes " and \u0001 control';
    const xml = serializeTree(doc);
    expect(xml).not.toContain('\u0001');
    const back = parseTree(xml).doc;
    expect(back.people[0].name.given).toBe('Tom "Tiny" <O\'Brien> & Šárka 漢字');
    expect(back.people[0].notes).toBe('Line one\nLine two & more <tags>');
    expect(back.meta.title).toBe('Quotes " and  control');
  });

  it('keeps partial and approximate dates and free-text dates', () => {
    const doc = sampleDocument();
    doc.people[0].birth = { date: { value: '1898-03', qualifier: 'about' }, place: 'Leeds' };
    doc.people[1].birth = { date: { value: '', text: 'Easter 1901' } };
    const back = roundTrip(doc);
    expect(back.people[0].birth).toEqual({ date: { value: '1898-03', qualifier: 'about' }, place: 'Leeds' });
    expect(back.people[1].birth).toEqual({ date: { value: '', text: 'Easter 1901' } });
  });

  it('keeps photos as embedded data', () => {
    const doc = sampleDocument();
    doc.people[0].photo = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==';
    const xml = serializeTree(doc);
    expect(xml).toContain('<photo mediaType="image/jpeg" encoding="base64">/9j/4AAQSkZJRgABAQ==</photo>');
    expect(parseTree(xml).doc.people[0].photo).toBe(doc.people[0].photo);
  });

  describe('format 1.3', () => {
    it('round-trips a background picture and twins', () => {
      const doc = sampleDocument(new Date('2026-01-01T00:00:00Z'));
      doc.background = { href: 'data:image/svg+xml;base64,PHN2Zy8+', width: 1600, height: 1100, fit: 'contain', opacity: 0.45, name: 'oak.svg' };
      const family = doc.families.find((f) => f.children.length >= 2)!;
      family.children = family.children.map((c, i) => (i < 2 ? { ...c, birthGroup: '1' } : c));
      const xml = serializeTree(doc);
      expect(xml).toContain(
        '<background mediaType="image/svg+xml" encoding="base64" width="1600" height="1100" fit="contain" opacity="0.45" name="oak.svg">PHN2Zy8+</background>',
      );
      expect(xml).toContain('birthGroup="1"');
      expect(roundTrip(doc)).toEqual(doc);
    });

    it('leaves out a damaged picture with a note, and reads files without one', () => {
      const xml = `<familyTree xmlns="${NS}" formatVersion="1.3"><meta><title>T</title></meta><people/><families/>
  <background mediaType="image/png" encoding="base64" fit="sideways" opacity="7">not base64!</background>
</familyTree>`;
      const result = parseTree(xml);
      expect(result.doc.background).toBeUndefined();
      expect(result.warnings.map((w) => w.code)).toContain('xml.bad-background');
      const fine = parseTree(xml.replace('not base64!', 'iVBORw0K'));
      expect(fine.doc.background).toMatchObject({ href: 'data:image/png;base64,iVBORw0K', fit: 'cover', opacity: 1, width: 1000 });
      expect(parseTree(serializeTree(sampleDocument())).doc.background).toBeUndefined();
    });
  });

  describe('format 1.1', () => {
    it('round-trips engagements, chart language and print settings', () => {
      const doc = sampleDocument(new Date('2026-01-01T00:00:00Z'));
      doc.view = { ...doc.view, language: 'cs', showRelationships: false, showUnions: true };
      doc.print = {
        ...DEFAULT_PRINT,
        theme: 'botanical',
        paper: 'A2',
        orientation: 'landscape',
        centerId: 'I11',
        partnerId: null,
        ancestors: 2,
        descendants: 'all',
        branches: 1,
        title: 'Rodina Ashworthových',
        showPhotos: false,
      };
      const xml = serializeTree(doc);
      expect(xml).toContain('<engagement date="2024-12-24" place="Prague, Czechia"/>');
      expect(xml).toMatch(
        /<print theme="botanical" paper="A2" orientation="landscape" center="I11" withPartner="false" centered="true" ancestors="2" descendants="all" branches="1" title="Rodina Ashworthových"/,
      );
      expect(parseTree(xml).doc).toEqual(doc);
    });

    it('writes new elements after the ones older versions know', () => {
      const doc = sampleDocument();
      doc.families[10].notes = 'Met in Prague.';
      const xml = serializeTree(doc);
      const family = xml.slice(xml.indexOf('<family id="F11"'), xml.indexOf('</family>', xml.indexOf('<family id="F11"')));
      expect(family.indexOf('<notes>')).toBeLessThan(family.indexOf('<engagement'));
      expect(xml.indexOf('</families>')).toBeLessThan(xml.indexOf('<print') === -1 ? Infinity : xml.indexOf('<print'));
    });

    it('reads a 1.0 file with the new settings at their defaults', () => {
      const xml = `<familyTree xmlns="${NS}" formatVersion="1.0"><meta><title>Old</title></meta>
  <view style="auto" colorBy="family" lines="square" density="comfortable" showDates="true" showPlaces="false" showPhotos="true" showGenerations="true"/>
  <people/><families/></familyTree>`;
      const { doc, warnings } = parseTree(xml);
      expect(warnings).toEqual([]);
      expect(doc.view).toEqual({ ...DEFAULT_VIEW });
      expect(doc.print).toBeUndefined();
    });

    it('reads a 1.1 file that went through Stemma 1.0 without losing anything', () => {
      const doc = sampleDocument(new Date('2026-10-10T08:00:00Z'));
      doc.print = { ...DEFAULT_PRINT, centerId: 'I11', descendants: 2, branches: 1 };
      // Settings added in 1.2 were not in the file; they read as their defaults.
      doc.view = { ...doc.view, sexColors: DEFAULT_VIEW.sexColors };
      const result = parseTree(SAVED_BY_1_0);
      expect(result.fileVersion).toBe('1.0');
      expect(result.warnings).toEqual([]);
      expect(result.doc).toEqual(doc);
    });

    it('keeps styles, papers and languages it does not have', () => {
      const xml = `<familyTree xmlns="${NS}" formatVersion="1.4"><meta><title>Newer</title></meta>
  <view language="de"/>
  <people/><families/>
  <print theme="watercolour" paper="B2" ancestors="3"/>
</familyTree>`;
      const { doc } = parseTree(xml);
      expect(doc.view.language).toBe('de');
      expect(doc.print?.theme).toBe('watercolour');
      expect(doc.print?.paper).toBe('B2');
      const again = serializeTree(doc);
      expect(again).toContain('language="de"');
      expect(again).toContain('theme="watercolour"');
      expect(again).toContain('paper="B2"');
    });
  });

  describe('compatibility between versions', () => {
    const newerMinor = `<?xml version="1.0" encoding="UTF-8"?>
<familyTree xmlns="${NS}" xmlns:x="urn:example:other" formatVersion="1.7" generator="Stemma 1.9.0" x:origin="import" futureRootAttr="yes">
  <meta>
    <title>Future file</title>
    <colour>teal</colour>
  </meta>
  <view style="night" colorBy="family" lines="curved" density="compact" showDates="true" showPlaces="true" showPhotos="false" showGenerations="false" zoom="1.5"/>
  <people>
    <person id="I1" sex="female" confidence="high">
      <name given="Ada" surname="Lovelace" title="Countess"/>
      <birth date="1815-12-10" place="London" source="S1"/>
      <dna haplogroup="H1"/>
      <x:note>From another tool</x:note>
    </person>
    <person id="I2" sex="male">
      <name given="William" surname="King"/>
    </person>
  </people>
  <families>
    <family id="F1" type="marriage">
      <partner ref="I1"/>
      <partner ref="I2"/>
      <start date="1835-07-08"/>
      <child ref="I3" relation="biological"/>
      <witness ref="I9"/>
    </family>
  </families>
  <sources>
    <source id="S1">Parish register</source>
  </sources>
</familyTree>`;

    it('reads a file from a newer minor version and says so', () => {
      const result = parseTree(newerMinor);
      expect(result.fromNewerVersion).toBe(true);
      expect(result.fileVersion).toBe('1.7');
      expect(result.warnings.some((w) => w.code === 'xml.newer-minor' && w.text.includes('newer version'))).toBe(true);
      expect(result.doc.people[0].name.given).toBe('Ada');
      expect(result.doc.view.lines).toBe('curved');
    });

    it('writes unknown content back unchanged', () => {
      const first = parseTree(newerMinor).doc;
      const xml = serializeTree(first);
      for (const fragment of [
        'confidence="high"',
        'title="Countess"',
        'source="S1"',
        '<dna',
        'haplogroup="H1"',
        '<x:note',
        'From another tool',
        '<witness ref="I9"',
        '<sources',
        'Parish register',
        '<colour',
        'zoom="1.5"',
        'futureRootAttr="yes"',
        'x:origin="import"',
        'xmlns:x="urn:example:other"',
      ]) {
        expect(xml).toContain(fragment);
      }
      // The written file reads back to the same model, so nothing drifts over repeated saves.
      expect(parseTree(xml).doc).toEqual(first);
      // And it is well-formed XML.
      const dom = new DOMParser().parseFromString(xml, 'application/xml');
      expect(dom.getElementsByTagName('parsererror')).toHaveLength(0);
    });

    it('keeps data other tools add in their own namespace', () => {
      const xml = `<familyTree xmlns="${NS}" xmlns:dna="urn:example:dna" formatVersion="1.0">
  <meta><title>T</title></meta>
  <people>
    <person id="I1" sex="female" dna:kit="K-1042"><name given="Ada" surname="Lovelace"/><dna:haplogroup>H1</dna:haplogroup></person>
  </people>
  <families/>
</familyTree>`;
      const out = serializeTree(parseTree(xml).doc);
      expect(out).toContain('xmlns:dna="urn:example:dna"');
      expect(out).toContain('dna:kit="K-1042"');
      expect(out).toMatch(/<dna:haplogroup[^>]*>H1<\/dna:haplogroup>/);
      const again = new DOMParser().parseFromString(out, 'application/xml');
      expect(again.getElementsByTagName('parsererror')).toHaveLength(0);
      expect(again.getElementsByTagNameNS('urn:example:dna', 'haplogroup')).toHaveLength(1);
    });

    it('refuses a newer major version unless forced', () => {
      const newer = newerMinor.replace('formatVersion="1.7"', 'formatVersion="2.0"');
      expect(() => parseTree(newer)).toThrow(XmlFormatError);
      try {
        parseTree(newer);
      } catch (e) {
        expect((e as XmlFormatError).code).toBe('newer-major');
        expect((e as XmlFormatError).fileVersion).toBe('2.0');
      }
      const forced = parseTree(newer, { force: true });
      expect(forced.doc.people).toHaveLength(2);
      expect(forced.warnings.some((w) => w.code === 'xml.newer-major')).toBe(true);
    });

    it('upgrades older major versions through migrations', () => {
      // A pretend format 0 that stored names as text and used <individual>.
      const legacy = `<?xml version="1.0"?>
<familyTree xmlns="${NS}" formatVersion="0.3">
  <meta><title>Old file</title></meta>
  <people>
    <individual id="I1" sex="male">Jan Novák</individual>
  </people>
  <families/>
</familyTree>`;
      const migrations: XmlMigration[] = [
        {
          from: 0,
          to: '1.0',
          describe: 'Names moved into <name> elements.',
          apply(doc) {
            for (const old of Array.from(doc.getElementsByTagNameNS(NS, 'individual'))) {
              const person = doc.createElementNS(NS, 'person');
              person.setAttribute('id', old.getAttribute('id')!);
              person.setAttribute('sex', old.getAttribute('sex')!);
              const [given, ...rest] = (old.textContent ?? '').trim().split(' ');
              const name = doc.createElementNS(NS, 'name');
              name.setAttribute('given', given);
              name.setAttribute('surname', rest.join(' '));
              person.appendChild(name);
              old.replaceWith(person);
            }
          },
        },
      ];
      const result = parseTree(legacy, { migrations });
      expect(result.upgrades.map((u) => u.text)).toEqual(['Names moved into <name> elements.']);
      expect(result.upgrades[0].code).toBe('upgrade.0');
      expect(result.doc.people[0].name).toEqual({ given: 'Jan', surname: 'Novák' });
      expect(() => parseTree(legacy)).toThrow(/no upgrade path/i);
    });
  });

  describe('repairs', () => {
    it('drops links to missing people and duplicate ids', () => {
      const xml = `<familyTree xmlns="${NS}" formatVersion="1.0">
  <people>
    <person id="I1" sex="male"><name given="A" surname=""/></person>
    <person id="I1" sex="female"><name given="B" surname=""/></person>
    <person id="7" sex="female"><name given="C" surname=""/></person>
  </people>
  <families>
    <family id="F1"><partner ref="I1"/><partner ref="I404"/><child ref="7"/><child ref="I1"/></family>
  </families>
</familyTree>`;
      const { doc, warnings } = parseTree(xml);
      const ids = doc.people.map((p) => p.id);
      expect(new Set(ids).size).toBe(3);
      expect(ids[0]).toBe('I1');
      expect(ids[2]).not.toBe('7');
      expect(doc.families[0].partners).toEqual(['I1']);
      expect(doc.families[0].children.map((c) => c.personId)).toEqual([ids[2]]);
      expect(warnings.length).toBeGreaterThanOrEqual(3);
    });

    it('reports ancestry loops', () => {
      const xml = `<familyTree xmlns="${NS}" formatVersion="1.0"><people>
  <person id="A"><name given="A" surname=""/></person><person id="B"><name given="B" surname=""/></person>
</people><families>
  <family id="F1"><partner ref="A"/><child ref="B"/></family>
  <family id="F2"><partner ref="B"/><child ref="A"/></family>
</families></familyTree>`;
      expect(parseTree(xml).warnings.some((w) => w.code === 'xml.loop')).toBe(true);
    });

    it('accepts a file without a namespace or version', () => {
      const result = parseTree('<familyTree><people><person id="I1"><name given="Solo" surname=""/></person></people></familyTree>');
      expect(result.doc.people[0].name.given).toBe('Solo');
      expect(result.warnings[0].code).toBe('xml.no-version');
      expect(result.warnings[0].text).toMatch(/format version/);
    });

    it('rejects files that are not family trees', () => {
      expect(() => parseTree('not xml at all')).toThrow(XmlFormatError);
      expect(() => parseTree('<html><body/></html>')).toThrow(/not a family tree/);
    });
  });
});
