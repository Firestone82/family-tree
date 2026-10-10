import { isValidDateValue } from '../model/dates';
import { ID_PATTERN, newId } from '../model/ids';
import {
  BACKGROUND_FIT_VALUES,
  BackgroundFit,
  BackgroundImage,
  CHILD_RELATION_VALUES,
  COLOR_BY_VALUES,
  ChildRelation,
  DEFAULT_PRINT,
  DEFAULT_VIEW,
  DENSITY_VALUES,
  END_REASON_VALUES,
  Extensions,
  FAMILY_KIND_VALUES,
  Family,
  FamilyChild,
  FamilyEnd,
  GenDate,
  LINE_STYLE_VALUES,
  LifeEvent,
  ORIENTATION_VALUES,
  Person,
  PersonName,
  PrintSettings,
  QUALIFIER_VALUES,
  Reach,
  SEX_VALUES,
  TREE_STYLE_VALUES,
  TreeDocument,
  TreeMeta,
  ViewSettings,
} from '../model/types';
import { CURRENT_FORMAT, ROOT_ELEMENT, XML_NAMESPACE, compareFormat, formatVersionString, parseFormatVersion } from './format';
import { MIGRATIONS, MigrationError, XmlMigration, runMigrations } from './migrations';
import { Notice, NoticeParams, notice } from '../model/notice';

/** A BCP 47 language tag such as "en", "cs" or "pt-BR". */
const LANGUAGE_TAG = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/;

export type XmlFormatErrorCode = 'invalid-xml' | 'not-a-tree' | 'bad-version' | 'newer-major' | 'migration';

/** A file that cannot be opened. `code` and `params` are for translation; `message` is the English text. */
export class XmlFormatError extends Error implements Notice {
  readonly text: string;

  constructor(
    readonly code: XmlFormatErrorCode,
    message: string,
    readonly fileVersion?: string,
    readonly params: NoticeParams = {},
  ) {
    super(message);
    this.text = message;
    this.name = 'XmlFormatError';
  }
}

export interface ParseOptions {
  /** Read a file from a newer major version anyway, keeping what can be understood. */
  force?: boolean;
  migrations?: readonly XmlMigration[];
}

export interface ParseResult {
  doc: TreeDocument;
  /** Problems found and repaired while reading. */
  warnings: Notice[];
  /** The format version written in the file. */
  fileVersion: string;
  /** Upgrades applied to a file from an older major version. */
  upgrades: Notice[];
  /** True when the file came from a newer version of the app. */
  fromNewerVersion: boolean;
}

const SHOW_ATTRS = ['showDates', 'showPlaces', 'showPhotos', 'showGenerations', 'showRelationships', 'showUnions', 'showSex', 'sexColors', 'showTree'];

const KNOWN = {
  root: { attrs: ['formatVersion', 'generator'], elements: ['meta', 'view', 'people', 'families', 'print', 'background'] },
  meta: { attrs: [], elements: ['title', 'description', 'created', 'modified', 'homePerson'] },
  view: { attrs: ['style', 'colorBy', 'lines', 'density', ...SHOW_ATTRS, 'language'], elements: [] },
  print: {
    attrs: [
      'theme',
      'paper',
      'orientation',
      'center',
      'partner',
      'withPartner',
      'centered',
      'ancestors',
      'descendants',
      'branches',
      'title',
      'subtitle',
      ...SHOW_ATTRS,
    ],
    elements: [],
  },
  people: { attrs: [], elements: ['person'] },
  families: { attrs: [], elements: ['family'] },
  person: { attrs: ['id', 'sex'], elements: ['name', 'birth', 'death', 'occupation', 'photo', 'notes'] },
  name: { attrs: ['given', 'surname', 'birthSurname', 'nickname'], elements: [] },
  event: { attrs: ['date', 'dateQualifier', 'dateText', 'place'], elements: [] },
  end: { attrs: ['date', 'dateQualifier', 'dateText', 'place', 'reason'], elements: [] },
  family: { attrs: ['id', 'type'], elements: ['partner', 'engagement', 'start', 'end', 'child', 'notes'] },
  child: { attrs: ['ref', 'relation', 'birthGroup'], elements: [] },
  background: { attrs: ['mediaType', 'encoding', 'href', 'width', 'height', 'fit', 'opacity', 'name'], elements: [] },
} satisfies Record<string, { attrs: string[]; elements: string[] }>;

type Known = (typeof KNOWN)[keyof typeof KNOWN];

/**
 * Reads a tree from XML. Older formats are upgraded, unknown content is kept
 * for writing back, and broken references are repaired with a warning.
 */
export function parseTree(xml: string, options: ParseOptions = {}): ParseResult {
  const warnings: Notice[] = [];
  const dom = new DOMParser().parseFromString(xml.replace(/^\uFEFF/, ''), 'application/xml');
  const error = dom.getElementsByTagName('parsererror')[0];
  if (error) {
    const detail = (error.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
    throw new XmlFormatError('invalid-xml', `The file is not valid XML.${detail ? ` ${detail}` : ''}`, undefined, { detail });
  }
  const root = dom.documentElement;
  if (!root || root.localName !== ROOT_ELEMENT || !isOurs(root)) {
    throw new XmlFormatError('not-a-tree', `This XML file is not a family tree (expected a <${ROOT_ELEMENT}> root element).`, undefined, {
      root: ROOT_ELEMENT,
    });
  }

  const versionText = root.getAttribute('formatVersion');
  let version = parseFormatVersion(versionText);
  if (!versionText) {
    warnings.push(
      notice('xml.no-version', `The file does not say which format version it uses, so it was read as version ${formatVersionString()}.`, {
        version: formatVersionString(),
      }),
    );
    version = { ...CURRENT_FORMAT };
  } else if (!version) {
    throw new XmlFormatError('bad-version', `The format version "${versionText}" is not recognised.`, versionText, { version: versionText });
  }
  const fileVersion = versionText ?? formatVersionString();
  const fromNewerVersion = compareFormat(version!, CURRENT_FORMAT) > 0;

  if (version!.major > CURRENT_FORMAT.major) {
    if (!options.force) {
      throw new XmlFormatError(
        'newer-major',
        `This file uses format ${fileVersion}, which comes from a newer version of Stemma. This version reads format ${CURRENT_FORMAT.major}.x.`,
        fileVersion,
        { version: fileVersion, supported: `${CURRENT_FORMAT.major}.x` },
      );
    }
    warnings.push(
      notice('xml.newer-major', `The file uses format ${fileVersion}, newer than this app understands. Parts of it may be missing.`, { version: fileVersion }),
    );
  } else if (fromNewerVersion) {
    warnings.push(
      notice(
        'xml.newer-minor',
        `The file was saved by a newer version (format ${fileVersion}). Details this version does not show are kept and saved back unchanged.`,
        { version: fileVersion },
      ),
    );
  }

  let upgrades: Notice[] = [];
  if (version!.major < CURRENT_FORMAT.major) {
    try {
      upgrades = runMigrations(dom, version!.major, warnings, options.migrations ?? MIGRATIONS);
    } catch (e) {
      if (e instanceof MigrationError) throw new XmlFormatError('migration', e.message, fileVersion, { version: fileVersion });
      throw e;
    }
  }

  const reader = new Reader(warnings);
  const doc = reader.readRoot(dom.documentElement);
  repair(doc, warnings);
  return { doc, warnings, fileVersion, upgrades, fromNewerVersion };
}

/**
 * A picture kept in the file: its `href`, or base64 data with its `mediaType`
 * as a data: URL. Null when the data is damaged, undefined when there is none.
 */
function embedded(el: Element): string | null | undefined {
  const href = el.getAttribute('href');
  if (href) return href;
  const data = (el.textContent ?? '').replace(/\s+/g, '');
  if (!data) return undefined;
  if (!/^[A-Za-z0-9+/=]+$/.test(data)) return null;
  const type = el.getAttribute('mediaType') || 'image/jpeg';
  return `data:${type};base64,${data}`;
}

class Reader {
  constructor(private readonly warnings: Notice[]) {}

  readRoot(root: Element): TreeDocument {
    const meta = this.readMeta(first(root, 'meta'));
    const view = this.readView(first(root, 'view'));
    const peopleEl = first(root, 'people');
    const familiesEl = first(root, 'families');
    const people = peopleEl ? elements(peopleEl, 'person').map((el) => this.readPerson(el)) : [];
    const families = familiesEl ? elements(familiesEl, 'family').map((el) => this.readFamily(el)) : [];
    const doc: TreeDocument = { meta, view, people, families };
    const printEl = first(root, 'print');
    if (printEl) doc.print = this.readPrint(printEl);
    const background = this.readBackground(first(root, 'background'));
    if (background) doc.background = background;
    setExt(doc, captureExt(root, KNOWN.root, ['xmlns']));
    const sectionExt: TreeDocument['sectionExt'] = {};
    const pe = peopleEl ? captureExt(peopleEl, KNOWN.people) : undefined;
    const fe = familiesEl ? captureExt(familiesEl, KNOWN.families) : undefined;
    if (pe) sectionExt.people = pe;
    if (fe) sectionExt.families = fe;
    if (pe || fe) doc.sectionExt = sectionExt;
    return doc;
  }

  readMeta(el: Element | undefined): TreeMeta {
    const meta: TreeMeta = { title: '' };
    if (!el) return { title: 'Untitled tree' };
    meta.title = text(first(el, 'title')) || 'Untitled tree';
    const description = text(first(el, 'description'));
    if (description) meta.description = description;
    const created = text(first(el, 'created'));
    if (created) meta.created = created;
    const modified = text(first(el, 'modified'));
    if (modified) meta.modified = modified;
    const home = first(el, 'homePerson')?.getAttribute('ref');
    if (home) meta.homePersonId = home;
    setExt(meta, captureExt(el, KNOWN.meta));
    return meta;
  }

  readView(el: Element | undefined): ViewSettings {
    const view: ViewSettings = { ...DEFAULT_VIEW };
    if (!el) return view;
    view.style = this.enumAttr(el, 'style', TREE_STYLE_VALUES, DEFAULT_VIEW.style);
    view.colorBy = this.enumAttr(el, 'colorBy', COLOR_BY_VALUES, DEFAULT_VIEW.colorBy);
    view.lines = this.enumAttr(el, 'lines', LINE_STYLE_VALUES, DEFAULT_VIEW.lines);
    view.density = this.enumAttr(el, 'density', DENSITY_VALUES, DEFAULT_VIEW.density);
    view.showDates = boolAttr(el, 'showDates', DEFAULT_VIEW.showDates);
    view.showPlaces = boolAttr(el, 'showPlaces', DEFAULT_VIEW.showPlaces);
    view.showPhotos = boolAttr(el, 'showPhotos', DEFAULT_VIEW.showPhotos);
    view.showGenerations = boolAttr(el, 'showGenerations', DEFAULT_VIEW.showGenerations);
    view.showRelationships = boolAttr(el, 'showRelationships', DEFAULT_VIEW.showRelationships);
    view.showUnions = boolAttr(el, 'showUnions', DEFAULT_VIEW.showUnions);
    view.showSex = boolAttr(el, 'showSex', DEFAULT_VIEW.showSex);
    view.sexColors = boolAttr(el, 'sexColors', DEFAULT_VIEW.sexColors);
    view.showTree = boolAttr(el, 'showTree', DEFAULT_VIEW.showTree);
    const language = el.getAttribute('language')?.trim();
    if (language) {
      if (LANGUAGE_TAG.test(language)) view.language = language;
      else this.warnings.push(notice('xml.bad-language', `The language "${language}" is not a language code; English was used.`, { language }));
    }
    setExt(view, captureExt(el, KNOWN.view));
    return view;
  }

  readPrint(el: Element): PrintSettings {
    const print: PrintSettings = { ...DEFAULT_PRINT };
    // Style and paper are open lists: a newer version may add some. Unknown ones are
    // kept as they are and drawn with the defaults.
    const theme = el.getAttribute('theme')?.trim();
    if (theme) print.theme = theme;
    const paper = el.getAttribute('paper')?.trim();
    if (paper) print.paper = paper;
    print.orientation = this.enumAttr(el, 'orientation', ORIENTATION_VALUES, DEFAULT_PRINT.orientation);
    const center = el.getAttribute('center')?.trim();
    if (center) print.centerId = center;
    const partner = el.getAttribute('partner')?.trim();
    if (!boolAttr(el, 'withPartner', true)) print.partnerId = null;
    else if (partner) print.partnerId = partner;
    print.centered = boolAttr(el, 'centered', DEFAULT_PRINT.centered);
    print.ancestors = this.reachAttr(el, 'ancestors', DEFAULT_PRINT.ancestors);
    print.descendants = this.reachAttr(el, 'descendants', DEFAULT_PRINT.descendants);
    print.branches = this.reachAttr(el, 'branches', DEFAULT_PRINT.branches);
    const title = el.getAttribute('title');
    if (title?.trim()) print.title = title;
    const subtitle = el.getAttribute('subtitle');
    if (subtitle?.trim()) print.subtitle = subtitle;
    print.showDates = boolAttr(el, 'showDates', DEFAULT_PRINT.showDates);
    print.showPlaces = boolAttr(el, 'showPlaces', DEFAULT_PRINT.showPlaces);
    print.showPhotos = boolAttr(el, 'showPhotos', DEFAULT_PRINT.showPhotos);
    print.showUnions = boolAttr(el, 'showUnions', DEFAULT_PRINT.showUnions);
    print.showRelationships = boolAttr(el, 'showRelationships', DEFAULT_PRINT.showRelationships);
    print.showGenerations = boolAttr(el, 'showGenerations', DEFAULT_PRINT.showGenerations);
    print.showSex = boolAttr(el, 'showSex', DEFAULT_PRINT.showSex);
    print.sexColors = boolAttr(el, 'sexColors', DEFAULT_PRINT.sexColors);
    print.showTree = boolAttr(el, 'showTree', DEFAULT_PRINT.showTree);
    setExt(print, captureExt(el, KNOWN.print));
    return print;
  }

  private reachAttr(el: Element, name: string, fallback: Reach): Reach {
    const raw = el.getAttribute(name)?.trim();
    if (!raw) return fallback;
    if (raw === 'all') return 'all';
    if (/^\d{1,3}$/.test(raw)) return Number(raw);
    this.warnings.push(unknownValue(raw, name, String(fallback)));
    return fallback;
  }

  readPerson(el: Element): Person {
    const id = el.getAttribute('id') ?? '';
    const sex = this.enumAttr(el, 'sex', SEX_VALUES, 'unknown');
    const nameEl = first(el, 'name');
    const name: PersonName = {
      given: nameEl?.getAttribute('given')?.trim() ?? '',
      surname: nameEl?.getAttribute('surname')?.trim() ?? '',
    };
    const birthSurname = nameEl?.getAttribute('birthSurname')?.trim();
    if (birthSurname) name.birthSurname = birthSurname;
    const nickname = nameEl?.getAttribute('nickname')?.trim();
    if (nickname) name.nickname = nickname;
    if (nameEl) setExt(name, captureExt(nameEl, KNOWN.name));

    const person: Person = { id, sex, name };
    const birth = first(el, 'birth');
    if (birth) person.birth = this.readEvent(birth, KNOWN.event);
    const death = first(el, 'death');
    if (death) person.death = this.readEvent(death, KNOWN.event);
    const occupation = text(first(el, 'occupation'));
    if (occupation) person.occupation = occupation;
    const photo = this.readPhoto(first(el, 'photo'));
    if (photo) person.photo = photo;
    const notes = text(first(el, 'notes'));
    if (notes) person.notes = notes;
    setExt(person, captureExt(el, KNOWN.person));
    return person;
  }

  readPhoto(el: Element | undefined): string | undefined {
    const data = el ? embedded(el) : undefined;
    if (data === null) this.warnings.push(notice('xml.bad-photo', 'A photo could not be read and was left out.'));
    return data ?? undefined;
  }

  /** The picture behind the chart; left out (with a note) when its data cannot be read. */
  readBackground(el: Element | undefined): BackgroundImage | undefined {
    if (!el) return undefined;
    const href = embedded(el);
    if (href === null) this.warnings.push(notice('xml.bad-background', 'The background picture could not be read and was left out.'));
    if (!href) return undefined;
    const size = (name: string) => {
      const v = Number(el.getAttribute(name));
      return Number.isFinite(v) && v > 0 ? v : 1000;
    };
    const opacity = Number(el.getAttribute('opacity') ?? 1);
    const background: BackgroundImage = {
      href,
      width: size('width'),
      height: size('height'),
      fit: this.enumAttr(el, 'fit', BACKGROUND_FIT_VALUES, 'cover') as BackgroundFit,
      opacity: Number.isFinite(opacity) ? Math.min(1, Math.max(0, opacity)) : 1,
    };
    const name = el.getAttribute('name');
    if (name) background.name = name;
    setExt(background, captureExt(el, KNOWN.background));
    return background;
  }

  readFamily(el: Element): Family {
    const id = el.getAttribute('id') ?? '';
    const family: Family = {
      id,
      kind: this.enumAttr(el, 'type', FAMILY_KIND_VALUES, 'marriage'),
      partners: elements(el, 'partner')
        .map((p) => p.getAttribute('ref') ?? '')
        .filter(Boolean),
      children: elements(el, 'child')
        .map((c): FamilyChild | null => {
          const ref = c.getAttribute('ref');
          if (!ref) return null;
          const child: FamilyChild = { personId: ref, relation: this.enumAttr(c, 'relation', CHILD_RELATION_VALUES, 'biological') as ChildRelation };
          const group = c.getAttribute('birthGroup')?.trim();
          if (group) child.birthGroup = group;
          setExt(child, captureExt(c, KNOWN.child));
          return child;
        })
        .filter((c): c is FamilyChild => c !== null),
    };
    const engagement = first(el, 'engagement');
    if (engagement) family.engagement = this.readEvent(engagement, KNOWN.event);
    const start = first(el, 'start');
    if (start) family.start = this.readEvent(start, KNOWN.event);
    const end = first(el, 'end');
    if (end) {
      const e: FamilyEnd = this.readEvent(end, KNOWN.end);
      const reason = end.getAttribute('reason');
      if (reason) e.reason = this.enumValue(reason, END_REASON_VALUES, 'other', 'reason');
      family.end = e;
    }
    const notes = text(first(el, 'notes'));
    if (notes) family.notes = notes;
    setExt(family, captureExt(el, KNOWN.family));
    return family;
  }

  readEvent(el: Element, known: Known): LifeEvent {
    const event: LifeEvent = {};
    const value = el.getAttribute('date')?.trim();
    const dateText = el.getAttribute('dateText')?.trim();
    const qualifierText = el.getAttribute('dateQualifier');
    let date: GenDate | undefined;
    if (value) {
      if (isValidDateValue(value)) {
        date = { value };
        if (qualifierText) {
          const q = QUALIFIER_VALUES.find((v) => v === qualifierText);
          if (q) date.qualifier = q;
          else
            this.warnings.push(
              notice('xml.bad-qualifier', `The date qualifier "${qualifierText}" is not recognised and was ignored.`, { qualifier: qualifierText }),
            );
        }
      } else {
        date = { value: '', text: value };
        this.warnings.push(notice('xml.not-a-date', `"${value}" is not a calendar date in YYYY-MM-DD form; it was kept as text.`, { value }));
      }
    } else if (dateText) {
      date = { value: '', text: dateText };
    }
    if (date) event.date = date;
    const place = el.getAttribute('place')?.trim();
    if (place) event.place = place;
    setExt(event, captureExt(el, known));
    return event;
  }

  private enumAttr<T extends string>(el: Element, attr: string, allowed: readonly T[], fallback: T): T {
    const raw = el.getAttribute(attr);
    if (raw === null || raw === '') return fallback;
    return this.enumValue(raw, allowed, fallback, attr);
  }

  private enumValue<T extends string>(raw: string, allowed: readonly T[], fallback: T, attr: string): T {
    const v = allowed.find((a) => a === raw);
    if (v) return v;
    this.warnings.push(unknownValue(raw, attr, fallback));
    return fallback;
  }
}

function unknownValue(value: string, name: string, fallback: string): Notice {
  return notice('xml.unknown-value', `The value "${value}" for ${name} is not recognised; "${fallback}" was used instead.`, { value, name, fallback });
}

// ---------------------------------------------------------------------------
// repairs

function repair(doc: TreeDocument, warnings: Notice[]): void {
  const taken = new Set<string>();
  const personIdMap = new Map<string, string>();
  let renamed = 0;
  let duplicates = 0;

  for (const p of doc.people) {
    const original = p.id;
    if (!ID_PATTERN.test(p.id) || taken.has(p.id)) {
      if (taken.has(p.id)) duplicates++;
      else renamed++;
      p.id = newId('I', taken);
    }
    taken.add(p.id);
    if (!personIdMap.has(original)) personIdMap.set(original, p.id);
  }
  for (const f of doc.families) {
    if (!ID_PATTERN.test(f.id) || taken.has(f.id)) {
      if (taken.has(f.id)) duplicates++;
      else renamed++;
      f.id = newId('F', taken);
    }
    taken.add(f.id);
  }
  if (renamed) warnings.push(notice('xml.renamed-ids', `${plural(renamed, 'id was', 'ids were')} not valid and got a new value.`, { count: renamed }));
  if (duplicates) {
    warnings.push(
      notice(
        'xml.duplicate-ids',
        `${plural(duplicates, 'duplicate id was', 'duplicate ids were')} renamed. Links to them point to the first entry with that id.`,
        { count: duplicates },
      ),
    );
  }

  const exists = (id: string) => personIdMap.has(id);
  let dangling = 0;
  let extraPartners = 0;
  let selfLinks = 0;
  for (const f of doc.families) {
    const partners: string[] = [];
    for (const ref of f.partners) {
      if (!exists(ref)) {
        dangling++;
        continue;
      }
      const id = personIdMap.get(ref)!;
      if (!partners.includes(id)) partners.push(id);
    }
    if (partners.length > 2) {
      extraPartners += partners.length - 2;
      partners.length = 2;
    }
    f.partners = partners;

    const seen = new Set<string>();
    const children: FamilyChild[] = [];
    for (const c of f.children) {
      if (!exists(c.personId)) {
        dangling++;
        continue;
      }
      const id = personIdMap.get(c.personId)!;
      if (partners.includes(id)) {
        selfLinks++;
        continue;
      }
      if (seen.has(id)) continue;
      seen.add(id);
      children.push({ ...c, personId: id });
    }
    f.children = children;
  }
  if (dangling) {
    warnings.push(
      notice(
        'xml.dangling-links',
        `${plural(dangling, 'link points', 'links point')} to people who are not in the file and ${dangling === 1 ? 'was' : 'were'} removed.`,
        { count: dangling },
      ),
    );
  }
  if (extraPartners) {
    warnings.push(
      notice('xml.extra-partners', `A family can have at most two partners; ${plural(extraPartners, 'extra partner was', 'extra partners were')} left out.`, {
        count: extraPartners,
      }),
    );
  }
  if (selfLinks) {
    warnings.push(
      notice(
        'xml.self-links',
        `${plural(selfLinks, 'person was', 'people were')} listed as both partner and child in the same family; the child link was removed.`,
        { count: selfLinks },
      ),
    );
  }

  if (doc.meta.homePersonId) {
    const id = personIdMap.get(doc.meta.homePersonId);
    if (id) doc.meta.homePersonId = id;
    else delete doc.meta.homePersonId;
  }
  if (doc.print?.centerId) {
    const id = personIdMap.get(doc.print.centerId);
    if (id) doc.print.centerId = id;
    else delete doc.print.centerId;
  }
  if (doc.print?.partnerId) {
    const id = personIdMap.get(doc.print.partnerId);
    if (id) doc.print.partnerId = id;
    else delete doc.print.partnerId;
  }

  const empty = doc.families.filter((f) => f.partners.length + f.children.length === 0).length;
  if (empty) doc.families = doc.families.filter((f) => f.partners.length + f.children.length > 0);

  const cycle = findAncestryCycle(doc);
  if (cycle) {
    const name = doc.people.find((p) => p.id === cycle);
    const label = name ? [name.name.given, name.name.surname].filter(Boolean).join(' ') || cycle : cycle;
    warnings.push(
      notice(
        'xml.loop',
        `The parent links around ${label} form a loop (someone is recorded as their own ancestor). The chart ignores the loop; check those links.`,
        { name: label },
      ),
    );
  }
}

/** Returns a person id inside an ancestry loop, or undefined. */
function findAncestryCycle(doc: TreeDocument): string | undefined {
  const childrenOf = new Map<string, string[]>();
  for (const f of doc.families) {
    for (const p of f.partners) {
      const list = childrenOf.get(p) ?? [];
      list.push(...f.children.map((c) => c.personId));
      childrenOf.set(p, list);
    }
  }
  const state = new Map<string, 1 | 2>();
  for (const start of doc.people.map((p) => p.id)) {
    if (state.has(start)) continue;
    const stack: [string, number][] = [[start, 0]];
    state.set(start, 1);
    while (stack.length) {
      const top = stack[stack.length - 1];
      const kids = childrenOf.get(top[0]) ?? [];
      if (top[1] < kids.length) {
        const next = kids[top[1]++];
        const s = state.get(next);
        if (s === 1) return next;
        if (!s) {
          state.set(next, 1);
          stack.push([next, 0]);
        }
      } else {
        state.set(top[0], 2);
        stack.pop();
      }
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// DOM helpers

function isOurs(el: Element): boolean {
  return el.namespaceURI === XML_NAMESPACE || !el.namespaceURI;
}

function elements(parent: Element, name: string): Element[] {
  const out: Element[] = [];
  for (let n = parent.firstElementChild; n; n = n.nextElementSibling) {
    if (n.localName === name && isOurs(n)) out.push(n);
  }
  return out;
}

function first(parent: Element, name: string): Element | undefined {
  for (let n = parent.firstElementChild; n; n = n.nextElementSibling) {
    if (n.localName === name && isOurs(n)) return n;
  }
  return undefined;
}

function text(el: Element | undefined): string {
  return (el?.textContent ?? '').trim();
}

function boolAttr(el: Element, name: string, fallback: boolean): boolean {
  const raw = el.getAttribute(name)?.trim().toLowerCase();
  if (raw === 'true' || raw === '1' || raw === 'yes') return true;
  if (raw === 'false' || raw === '0' || raw === 'no') return false;
  return fallback;
}

let serializer: XMLSerializer | undefined;

/** Collects attributes and child elements that the reader does not understand. */
function captureExt(el: Element, known: Known, ignoreAttrs: string[] = []): Extensions | undefined {
  const attrs: Record<string, string> = {};
  let hasAttrs = false;
  for (const attr of Array.from(el.attributes)) {
    const local = attr.localName;
    const isPlain = !attr.namespaceURI;
    if (isPlain && (known.attrs as readonly string[]).includes(local)) continue;
    if (ignoreAttrs.includes(attr.name)) continue;
    attrs[attr.name] = attr.value;
    hasAttrs = true;
  }
  const elementsOut: string[] = [];
  for (let n = el.firstElementChild; n; n = n.nextElementSibling) {
    if (isOurs(n) && (known.elements as readonly string[]).includes(n.localName)) continue;
    serializer ??= new XMLSerializer();
    let xml = serializer.serializeToString(n);
    if (n.namespaceURI === XML_NAMESPACE) {
      // Serialised on its own the element repeats the default namespace; in the file it inherits it.
      const end = xml.indexOf('>');
      xml = xml.slice(0, end).replace(` xmlns="${XML_NAMESPACE}"`, '') + xml.slice(end);
    }
    elementsOut.push(xml);
  }
  if (!hasAttrs && !elementsOut.length) return undefined;
  const ext: Extensions = {};
  if (hasAttrs) ext.attrs = attrs;
  if (elementsOut.length) ext.elements = elementsOut;
  return ext;
}

function setExt(target: { ext?: Extensions }, ext: Extensions | undefined): void {
  if (ext) target.ext = ext;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
