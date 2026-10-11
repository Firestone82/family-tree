import { Injectable, computed, inject, signal } from '@angular/core';
import { ColorAssignment, assignColors } from '../core/colors/tinctures';
import { Kin, kinship } from '../core/kinship/kinship';
import { ChartLanguage, chartLanguage, kinLabel, surnameLinesIn } from '../core/lang/language';
import { computeLayout } from '../core/layout/layout';
import { COMFORTABLE_LAYOUT, LayoutOptions, LayoutResult } from '../core/layout/layout-types';
import { displayName, initials, nameUnknown } from '../core/model/names';
import { isBrokenUp, relationshipStatus } from '../core/model/relationship';
import { birthGroupOf } from '../core/model/births';
import { arrangementOf, isArranged } from '../core/model/arrangement';
import { birthSurname } from '../core/model/surnames';
import { RELATIVES, Relatives, Scope, ScopeOptions, relativesOf, relativesSettings, scopeDocument } from '../core/poster/scope';
import { TreeIndex } from '../core/model/tree-index';
import { Sex, TreeDocument, ViewSettings } from '../core/model/types';
import { TextMeasurer } from '../core/services/text-measure';
import { TreeStore } from '../core/store/tree-store';
import { I18n } from '../i18n/i18n';
import { CARD_METRICS, cardFonts } from './card-metrics';

export interface CardLabel {
  given: string;
  surname: string;
  /** The surname at birth when it differs from the surname: "née Barlow". */
  birth: string;
  dates: string;
  /** How the person is related to the person the tree is centred on. */
  kin: string;
  initials: string;
  /** Full name and dates, for tooltips and screen readers. */
  title: string;
  photo?: string;
  sex: Sex;
  deceased: boolean;
  /** Nobody knows the given name: the card says "Unknown" and is drawn dashed. */
  unknown: boolean;
}

/** Room the sex symbol takes from the first line of a card, and the focus mark from the last. */
export const CORNER_ROOM = 16;

/** A card grows at most to this many times the usual width to fit its relationship name; beyond, the name is shortened. */
const MAX_CARD_STRETCH = 2;

/**
 * Everything the chart draws, derived from the store: the layout, colours,
 * relationship names and card labels. The layout is only recomputed when the
 * shape of the tree changes, not when someone edits a name or a date, or when
 * the tree is centred on someone else (unless a relationship name then needs
 * a wider card).
 */
@Injectable({ providedIn: 'root' })
export class ChartModel {
  private readonly store = inject(TreeStore);
  private readonly measure = inject(TextMeasurer);
  private readonly i18n = inject(I18n);

  readonly view = computed<ViewSettings>(() => this.store.doc().view, { equal: shallowEqual });
  /**
   * The words on the chart (relationship names, couples, dates) are in the
   * app's language: one setting for both. The `language` a file carries is
   * written when the tree is saved, for older versions.
   */
  readonly language = computed<ChartLanguage>(() => chartLanguage(this.i18n.code()));

  /**
   * Positions and font sizes inside a card. The `density` a file may carry is
   * no longer used: every tree is drawn with the same spacing. Places are not
   * drawn on the chart (prints can show them), whatever `showPlaces` says.
   */
  readonly metrics = signal(CARD_METRICS).asReadonly();

  readonly options = computed<LayoutOptions>(
    () => {
      const v = this.view();
      const m = this.metrics();
      const base = COMFORTABLE_LAYOUT;
      const extra = (v.showRelationships ? m.kin.shift : 0) + (this.birthRow() ? m.birth.shift : 0);
      return extra ? { ...base, cardHeight: base.cardHeight + extra } : base;
    },
    { equal: (a, b) => a.cardWidth === b.cardWidth && a.cardHeight === b.cardHeight },
  );

  /** The person the tree is centred on; relationship names are relative to them. */
  readonly focusId = computed<string | undefined>(() => {
    const doc = this.store.doc();
    const index = this.store.index();
    return index.person(doc.meta.homePersonId) ? doc.meta.homePersonId : doc.people[0]?.id;
  });

  /** The focus person's current partner, who shares the middle of the chart with them. */
  readonly focusPartnerId = computed<string | undefined>(() => currentPartner(this.store.index(), this.focusId()));

  readonly kin = computed<ReadonlyMap<string, Kin>>(() => kinship(this.store.index(), this.focusId()));

  /** Twins (triplets…) of the person in the middle: how many were born together, by person. */
  readonly focusBornWith = computed<ReadonlyMap<string, number>>(() => {
    const id = this.focusId();
    const group = id ? birthGroupOf(this.store.doc(), id) : undefined;
    return new Map(group ? group.memberIds.filter((m) => m !== id).map((m) => [m, group.memberIds.length]) : []);
  });

  /**
   * The part of the tree the chart shows by the Relatives setting, around the
   * person in the middle and their partner. Undefined when that is everyone.
   */
  private readonly scope = computed<Scope | undefined>(() => {
    // As the setting reads: a file's second cousins (branches 3) count as everyone.
    const { branches, inLawFamilies } = relativesSettings(relativesOf(this.view()));
    const around = this.around();
    if (!around || (branches === 'all' && inLawFamilies)) return undefined;
    return scopeDocument(this.store.doc(), this.store.index(), { ...around, branches, inLawFamilies });
  });

  /** People the Relatives setting leaves out of the chart. */
  readonly hidden = computed<ReadonlySet<string>>(
    () => {
      const scope = this.scope();
      return scope
        ? new Set(
            this.store
              .doc()
              .people.filter((p) => !scope.people.has(p.id))
              .map((p) => p.id),
          )
        : NOBODY;
    },
    { equal: sameSet },
  );

  /** How many people each step of the Relatives setting shows. Worked out only when asked for. */
  readonly relativesCounts = computed<Readonly<Record<Relatives, number>>>(() => {
    const doc = this.store.doc();
    const around = this.around();
    const counts = {} as Record<Relatives, number>;
    for (const r of RELATIVES) {
      counts[r] = around && r !== 'everyone' ? scopeDocument(doc, this.store.index(), { ...around, ...relativesSettings(r) }).people.size : doc.people.length;
    }
    return counts;
  });

  /** The chart's part of the tree is reckoned from the couple in the middle, all generations up and down. */
  private around(): Omit<ScopeOptions, 'branches' | 'inLawFamilies'> | undefined {
    const centerId = this.focusId();
    return centerId ? { centerId, partnerId: this.focusPartnerId(), ancestors: 'all', descendants: 'all' } : undefined;
  }

  private readonly structure = computed(() => structureOf(this.scope()?.doc ?? this.store.doc(), this.store.loadId()), {
    equal: (a, b) => a.key === b.key,
  });

  private previous?: { result: LayoutResult; loadId: number };

  readonly layout = computed<LayoutResult>(() => {
    const s = this.structure();
    const options = this.options();
    const prev = this.previous;
    // Where the layout itself put everyone, without the moves made by hand, so its order stays put.
    const hint = prev && prev.loadId === s.loadId ? prev.result.hint : undefined;
    const result = computeLayout(s.doc, options, hint, this.cardWidths());
    this.previous = { result, loadId: s.loadId };
    return result;
  });

  /** How each person is related to the one in the middle, as their card says: "Bývalá manželka strýce". */
  private readonly relations = computed<ReadonlyMap<string, string>>(() => {
    if (!this.view().showRelationships) return new Map();
    const lang = this.language();
    const kin = this.kin();
    const bornWith = this.focusBornWith();
    return new Map(this.store.doc().people.map((p) => [p.id, kinLabel(lang, kin.get(p.id), p.sex, bornWith.get(p.id))]));
  });

  /** Cards wider than the rest, for a relationship name that would not fit on the usual card. */
  readonly cardWidths = computed<ReadonlyMap<string, number>>(
    () => {
      this.measure.fontsVersion();
      const m = this.metrics();
      const base = this.options().cardWidth;
      const font = cardFonts(m).kin;
      // The name starts after the shield and stops short of the sex symbol.
      const room = m.textX + m.padRight + (this.view().showSex ? CORNER_ROOM : 0);
      const out = new Map<string, number>();
      for (const [id, relation] of this.relations()) {
        if (!relation) continue;
        const needed = Math.ceil(room + this.measure.width(relation, font, m.kin.size * m.kin.spacing));
        if (needed > base) out.set(id, Math.min(needed, base * MAX_CARD_STRETCH));
      }
      return out;
    },
    { equal: sameEntries },
  );

  /** The surname each person was born with: as recorded, or their father's in the chart's language. */
  readonly birthSurnames = computed<ReadonlyMap<string, string>>(() => {
    const index = this.store.index();
    const form = this.language().surnameFor;
    return new Map(this.store.doc().people.map((p) => [p.id, birthSurname(index, p, form)]));
  });

  /** Each person's surname line, and the line under it when they were born with another surname. */
  private readonly surnameLines = computed(() => {
    const lang = this.language();
    const births = this.birthSurnames();
    return new Map(this.store.doc().people.map((p) => [p.id, surnameLinesIn(lang, p, births.get(p.id))]));
  });

  /** Whether any card has a line for a surname at birth: all cards then make room for one, so rows line up. */
  readonly birthRow = computed(() => [...this.surnameLines().values()].some((l) => !!l.birth));

  /**
   * The colours of the name shields: one per family name, taken from the
   * surname each person was born with. The `colorBy` a file may carry is no
   * longer used.
   */
  readonly colors = computed<ColorAssignment>(() => {
    const births = this.birthSurnames();
    return assignColors(this.store.doc(), 'family', this.layout().ranks, (p) => births.get(p.id) || p.name.surname.trim());
  });

  readonly labels = computed<ReadonlyMap<string, CardLabel>>(() => {
    this.measure.fontsVersion();
    const doc = this.store.doc();
    const view = this.view();
    const lang = this.language();
    const relations = this.relations();
    const surnames = this.surnameLines();
    const birthRow = this.birthRow();
    const focusId = this.focusId();
    const m = this.metrics();
    const fonts = cardFonts(m);
    const widths = this.cardWidths();
    const cardWidth = this.options().cardWidth;
    // The sex symbol takes the top right corner, the focus mark the bottom right.
    const top = view.showSex ? CORNER_ROOM : 0;
    const out = new Map<string, CardLabel>();
    for (const p of doc.people) {
      const width = (widths.get(p.id) ?? cardWidth) - m.textX - m.padRight;
      const dates = lang.lifespan(p);
      const relation = relations.get(p.id) ?? '';
      const unknown = nameUnknown(p);
      const title = [displayName(p, lang.unknown(p.sex)), relation, dates].filter(Boolean).join(', ');
      const bottom = p.id === focusId ? CORNER_ROOM : 0;
      const last = view.showDates ? 'dates' : birthRow ? 'birth' : 'surname';
      const names = surnames.get(p.id) ?? { surname: p.name.surname.trim(), birth: '' };
      out.set(p.id, {
        given: this.measure.fit(unknown ? lang.unknown(p.sex) : p.name.given.trim(), fonts.given, width - (view.showRelationships ? 0 : top)),
        surname: this.measure.fit(names.surname, fonts.surname, width - (last === 'surname' ? bottom : 0)),
        birth: this.measure.fit(names.birth, fonts.birth, width - (last === 'birth' ? bottom : 0)),
        dates: view.showDates ? this.measure.fit(dates, fonts.dates, width - (last === 'dates' ? bottom : 0)) : '',
        kin: relation ? this.measure.fit(relation, fonts.kin, width - top, m.kin.size * m.kin.spacing) : '',
        initials: initials(p),
        title,
        photo: view.showPhotos ? p.photo : undefined,
        sex: p.sex,
        deceased: !!p.death,
        unknown,
      });
    }
    return out;
  });

  readonly stats = computed(() => {
    const doc = this.store.doc();
    return {
      people: doc.people.length,
      families: doc.families.filter((f) => f.partners.length === 2).length,
      generations: this.layout().rows.length,
    };
  });
}

/** The partner someone is with now: the latest relationship that has not ended, else the latest. */
export function currentPartner(index: TreeIndex, personId: string | undefined): string | undefined {
  if (!personId) return undefined;
  const fams = index.partnerFamilies(personId).filter((f) => f.partners.length === 2);
  if (!fams.length) return undefined;
  const current = [...fams].reverse().find((f) => !isBrokenUp(relationshipStatus(f))) ?? fams[fams.length - 1];
  return current.partners.find((p) => p !== personId);
}

function shallowEqual<T extends object>(a: T, b: T): boolean {
  if (a === b) return true;
  const ka = Object.keys(a) as (keyof T)[];
  const kb = Object.keys(b) as (keyof T)[];
  return ka.length === kb.length && ka.every((k) => a[k] === b[k]);
}

const NOBODY: ReadonlySet<string> = new Set();

function sameSet<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
  return a.size === b.size && [...a].every((x) => b.has(x));
}

function sameEntries<K, V>(a: ReadonlyMap<K, V>, b: ReadonlyMap<K, V>): boolean {
  return a.size === b.size && [...a].every(([k, v]) => b.get(k) === v);
}

/**
 * The part of a document the layout depends on. Names, dates and notes do not
 * move anyone, so they are left out and edits to them reuse the layout. The
 * home person is passed along but is not part of the key: centring the tree on
 * someone else moves the view, not the people.
 */
function structureOf(doc: TreeDocument, loadId: number): { key: string; doc: TreeDocument; loadId: number } {
  const people = doc.people.map((p) => ({ id: p.id, sex: 'unknown' as const, name: { given: '', surname: '' } }));
  const families = doc.families.map((f) => {
    const out: TreeDocument['families'][number] = {
      id: f.id,
      kind: f.kind,
      partners: f.partners,
      children: f.children.map((c) => ({ personId: c.personId, relation: c.relation })),
    };
    if (f.start?.date?.value) out.start = { date: { value: f.start.date.value } };
    if (f.end?.reason) out.end = { reason: f.end.reason };
    return out;
  });
  const reduced: TreeDocument = {
    meta: { title: '', homePersonId: doc.meta.homePersonId },
    view: doc.view,
    people,
    families,
  };
  // Changes made by hand are part of the layout too.
  const arrangement = arrangementOf(doc);
  if (isArranged(doc)) reduced.arrangement = arrangement;
  const key = JSON.stringify([loadId, people.map((p) => p.id), families, reduced.arrangement ?? null]);
  return { key, doc: reduced, loadId };
}
