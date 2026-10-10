import { BackgroundImage, Extensions, Family, LifeEvent, Person, PrintSettings, Reach, TreeDocument } from '../model/types';
import { arrangementOf } from '../model/arrangement';
import { CURRENT_FORMAT, GENERATOR, ROOT_ELEMENT, XML_NAMESPACE, formatVersionString } from './format';
import { Attrs, XmlWriter } from './xml-writer';

export interface SerializeOptions {
  /** Written to the `generator` attribute. */
  generator?: string;
}

/** Serialises a tree to the current XML file format. */
export function serializeTree(doc: TreeDocument, options: SerializeOptions = {}): string {
  const w = new XmlWriter();
  w.declaration();
  w.open(ROOT_ELEMENT, [
    ['xmlns', XML_NAMESPACE],
    ['formatVersion', formatVersionString(CURRENT_FORMAT)],
    ['generator', options.generator ?? GENERATOR],
    ...extAttrs(doc.ext),
  ]);

  writeMeta(w, doc);
  writeView(w, doc);

  const peopleExt = doc.sectionExt?.people;
  w.open('people', extAttrs(peopleExt));
  for (const person of doc.people) writePerson(w, person);
  extElements(w, peopleExt);
  w.close();

  const familiesExt = doc.sectionExt?.families;
  w.open('families', extAttrs(familiesExt));
  for (const family of doc.families) writeFamily(w, family);
  extElements(w, familiesExt);
  w.close();

  // Elements added in a minor version go after the existing ones, where an
  // older app that keeps them as unknown content would write them back.
  if (doc.print) writePrint(w, doc.print);
  if (doc.background) writeBackground(w, doc.background);
  writeArrangement(w, doc);

  extElements(w, doc.ext);
  w.close();
  return w.toString();
}

function writeMeta(w: XmlWriter, doc: TreeDocument): void {
  const m = doc.meta;
  w.open('meta', extAttrs(m.ext));
  w.element('title', [], m.title);
  if (m.description) w.element('description', [], m.description);
  if (m.created) w.element('created', [], m.created);
  if (m.modified) w.element('modified', [], m.modified);
  if (m.homePersonId) w.element('homePerson', [['ref', m.homePersonId]]);
  extElements(w, m.ext);
  w.close();
}

function writeView(w: XmlWriter, doc: TreeDocument): void {
  const v = doc.view;
  const attrs: Attrs = [
    ['style', v.style],
    ['colorBy', v.colorBy],
    ['lines', v.lines],
    ['density', v.density],
    ['showDates', v.showDates],
    ['showPlaces', v.showPlaces],
    ['showPhotos', v.showPhotos],
    ['showGenerations', v.showGenerations],
    ['showRelationships', v.showRelationships],
    ['showUnions', v.showUnions],
    ['language', v.language],
    ['showSex', v.showSex],
    ['sexColors', v.sexColors],
    ['showTree', v.showTree],
    ['branches', reach(v.branches)],
    ['inLawFamilies', v.inLawFamilies],
    ...extAttrs(v.ext),
  ];
  if (v.ext?.elements?.length) {
    w.open('view', attrs);
    extElements(w, v.ext);
    w.close();
  } else {
    w.element('view', attrs);
  }
}

function writePerson(w: XmlWriter, p: Person): void {
  w.open('person', [['id', p.id], ['sex', p.sex], ...extAttrs(p.ext)]);
  const nameAttrs: Attrs = [
    ['given', p.name.given],
    ['surname', p.name.surname],
    ['birthSurname', p.name.birthSurname],
    ['nickname', p.name.nickname],
    ...extAttrs(p.name.ext),
  ];
  if (p.name.ext?.elements?.length) {
    w.open('name', nameAttrs);
    extElements(w, p.name.ext);
    w.close();
  } else {
    w.element('name', nameAttrs);
  }
  if (p.birth) writeEvent(w, 'birth', p.birth);
  if (p.death) writeEvent(w, 'death', p.death);
  if (p.occupation) w.element('occupation', [], p.occupation);
  if (p.photo) writePhoto(w, p.photo);
  if (p.notes) w.element('notes', [], p.notes);
  extElements(w, p.ext);
  w.close();
}

function writePhoto(w: XmlWriter, photo: string): void {
  const m = /^data:([^;,]+);base64,(.*)$/s.exec(photo);
  if (m)
    w.element(
      'photo',
      [
        ['mediaType', m[1]],
        ['encoding', 'base64'],
      ],
      m[2],
    );
  else w.element('photo', [['href', photo]]);
}

function writeFamily(w: XmlWriter, f: Family): void {
  w.open('family', [['id', f.id], ['type', f.kind], ...extAttrs(f.ext)]);
  for (const partner of f.partners) w.element('partner', [['ref', partner]]);
  if (f.start) writeEvent(w, 'start', f.start);
  if (f.end) writeEvent(w, 'end', f.end, [['reason', f.end.reason]]);
  for (const child of f.children) {
    const attrs: Attrs = [
      ['ref', child.personId],
      ['relation', child.relation === 'biological' ? undefined : child.relation],
      ['birthGroup', child.birthGroup],
      ...extAttrs(child.ext),
    ];
    if (child.ext?.elements?.length) {
      w.open('child', attrs);
      extElements(w, child.ext);
      w.close();
    } else {
      w.element('child', attrs);
    }
  }
  if (f.notes) w.element('notes', [], f.notes);
  if (f.engagement) writeEvent(w, 'engagement', f.engagement);
  extElements(w, f.ext);
  w.close();
}

function writePrint(w: XmlWriter, p: PrintSettings): void {
  const attrs: Attrs = [
    ['theme', p.theme],
    ['paper', p.paper],
    ['orientation', p.orientation],
    ['center', p.centerId],
    ['partner', p.partnerId ?? undefined],
    ['withPartner', p.partnerId === null ? false : undefined],
    ['centered', p.centered],
    ['ancestors', reach(p.ancestors)],
    ['descendants', reach(p.descendants)],
    ['branches', reach(p.branches)],
    ['title', p.title],
    ['subtitle', p.subtitle],
    ['showDates', p.showDates],
    ['showPlaces', p.showPlaces],
    ['showPhotos', p.showPhotos],
    ['showUnions', p.showUnions],
    ['showRelationships', p.showRelationships],
    ['showGenerations', p.showGenerations],
    ['showSex', p.showSex],
    ['sexColors', p.sexColors],
    ['showTree', p.showTree],
    ['inLawFamilies', p.inLawFamilies],
    ...extAttrs(p.ext),
  ];
  if (p.ext?.elements?.length) {
    w.open('print', attrs);
    extElements(w, p.ext);
    w.close();
  } else {
    w.element('print', attrs);
  }
}

function writeBackground(w: XmlWriter, b: BackgroundImage): void {
  const m = /^data:([^;,]+);base64,(.*)$/s.exec(b.href);
  const attrs: Attrs = [
    ...(m
      ? ([
          ['mediaType', m[1]],
          ['encoding', 'base64'],
        ] as Attrs)
      : ([['href', b.href]] as Attrs)),
    ['width', Math.round(b.width * 100) / 100],
    ['height', Math.round(b.height * 100) / 100],
    ['fit', b.fit],
    ['opacity', Math.round(b.opacity * 100) / 100],
    ['name', b.name],
    ...extAttrs(b.ext),
  ];
  w.element('background', attrs, m ? m[2] : undefined);
}

function reach(r: Reach): string {
  return r === 'all' ? 'all' : String(r);
}

function writeEvent(w: XmlWriter, name: string, e: LifeEvent, extra: Attrs = []): void {
  const attrs: Attrs = [
    ...extra,
    ['date', e.date?.value],
    ['dateQualifier', e.date?.value ? e.date.qualifier : undefined],
    ['dateText', e.date?.value ? undefined : e.date?.text],
    ['place', e.place],
    ...extAttrs(e.ext),
  ];
  if (e.ext?.elements?.length) {
    w.open(name, attrs);
    extElements(w, e.ext);
    w.close();
  } else {
    w.element(name, attrs);
  }
}

/** Changes made by hand to the layout, for the people and families in the tree, in their order. */
function writeArrangement(w: XmlWriter, doc: TreeDocument): void {
  if (!doc.arrangement) return;
  const a = arrangementOf(doc);
  const moves = doc.people.filter((p) => a.moves[p.id] !== undefined);
  const lines = doc.families.filter((f) => a.lines[f.id] !== undefined);
  const couples = doc.families.filter((f) => a.left[f.id] !== undefined);
  if (!moves.length && !lines.length && !couples.length && !a.ext) return;
  w.open('arrangement', extAttrs(a.ext));
  for (const p of moves)
    w.element('move', [
      ['person', p.id],
      ['dx', String(a.moves[p.id])],
    ]);
  for (const f of lines)
    w.element('line', [
      ['family', f.id],
      ['dy', String(a.lines[f.id])],
    ]);
  for (const f of couples)
    w.element('couple', [
      ['family', f.id],
      ['left', a.left[f.id]],
    ]);
  extElements(w, a.ext);
  w.close();
}

function extAttrs(ext: Extensions | undefined): Attrs {
  if (!ext?.attrs) return [];
  return Object.entries(ext.attrs);
}

function extElements(w: XmlWriter, ext: Extensions | undefined): void {
  for (const xml of ext?.elements ?? []) w.raw(xml);
}
