import { Injectable, computed, inject, signal } from '@angular/core';
import { ColorAssignment, assignColors } from '../core/colors/tinctures';
import { Kin, kinship } from '../core/kinship/kinship';
import { ChartLanguage, chartLanguage, kinLabel, surnameLinesIn } from '../core/lang/language';
import { computeLayout } from '../core/layout/layout';
import { COMFORTABLE_LAYOUT, LayoutOptions, LayoutResult, PLACE_LINE_HEIGHT } from '../core/layout/layout-types';
import { displayName, initials } from '../core/model/names';
import { isBrokenUp, relationshipStatus } from '../core/model/relationship';
import { birthGroupOf } from '../core/model/births';
import { birthSurname } from '../core/model/surnames';
import { TreeIndex } from '../core/model/tree-index';
import { ColorBy, Sex, TreeDocument, ViewSettings } from '../core/model/types';
import { TextMeasurer } from '../core/services/text-measure';
import { TreeStore } from '../core/store/tree-store';
import { CARD_METRICS, cardFonts } from './card-metrics';

export interface CardLabel {
  given: string;
  surname: string;
  /** The surname at birth when it differs from the surname: "née Barlow". */
  birth: string;
  dates: string;
  place: string;
  /** How the person is related to the person the tree is centred on. */
  kin: string;
  initials: string;
  /** Full name and dates, for tooltips and screen readers. */
  title: string;
  photo?: string;
  sex: Sex;
  deceased: boolean;
}

/** Room the sex symbol takes from the first line of a card, and the focus mark from the last. */
export const CORNER_ROOM = 16;

/**
 * Everything the chart draws, derived from the store: the layout, colours,
 * relationship names and card labels. The layout is only recomputed when the
 * shape of the tree changes, not when someone edits a name or a date, or when
 * the tree is centred on someone else.
 */
@Injectable({ providedIn: 'root' })
export class ChartModel {
  private readonly store = inject(TreeStore);
  private readonly measure = inject(TextMeasurer);

  readonly view = computed<ViewSettings>(() => this.store.doc().view, { equal: shallowEqual });
  readonly language = computed<ChartLanguage>(() => chartLanguage(this.view().language));

  /**
   * Positions and font sizes inside a card. The `density` a file may carry is
   * no longer used: every tree is drawn with the same spacing.
   */
  readonly metrics = signal(CARD_METRICS).asReadonly();

  readonly options = computed<LayoutOptions>(
    () => {
      const v = this.view();
      const m = this.metrics();
      const base = COMFORTABLE_LAYOUT;
      const extra = (v.showPlaces ? PLACE_LINE_HEIGHT : 0) + (v.showRelationships ? m.kin.shift : 0) + (this.birthRow() ? m.birth.shift : 0);
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

  /** The couple in the middle, for the tree drawn behind the chart. */
  readonly focusIds = computed<readonly string[]>(() => [this.focusId(), this.focusPartnerId()].filter((id): id is string => !!id), {
    equal: (a, b) => a.length === b.length && a.every((x, i) => x === b[i]),
  });

  readonly kin = computed<ReadonlyMap<string, Kin>>(() => kinship(this.store.index(), this.focusId()));

  /** Twins (triplets…) of the person in the middle: how many were born together, by person. */
  readonly focusBornWith = computed<ReadonlyMap<string, number>>(() => {
    const id = this.focusId();
    const group = id ? birthGroupOf(this.store.doc(), id) : undefined;
    return new Map(group ? group.memberIds.filter((m) => m !== id).map((m) => [m, group.memberIds.length]) : []);
  });

  private readonly structure = computed(() => structureOf(this.store.doc(), this.store.loadId()), {
    equal: (a, b) => a.key === b.key,
  });

  private previous?: { result: LayoutResult; loadId: number };

  readonly layout = computed<LayoutResult>(() => {
    const s = this.structure();
    const options = this.options();
    const prev = this.previous;
    const hint = prev && prev.loadId === s.loadId ? new Map(prev.result.cards.map((c) => [c.personId, c.x + c.w / 2])) : undefined;
    const result = computeLayout(s.doc, options, hint);
    this.previous = { result, loadId: s.loadId };
    return result;
  });

  /** The surname each person was born with: as recorded, or their father's in the tree's language. */
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

  readonly colors = computed<ColorAssignment>(() => this.colorsBy(this.view().colorBy));

  /** Family colours, whatever the chart is coloured by: for the family groups of the people list. */
  readonly familyColors = computed<ColorAssignment>(() => (this.view().colorBy === 'family' ? this.colors() : this.colorsBy('family')));

  private colorsBy(colorBy: ColorBy): ColorAssignment {
    const births = this.birthSurnames();
    return assignColors(this.store.doc(), colorBy, this.layout().ranks, (p) => births.get(p.id) || p.name.surname.trim());
  }

  readonly labels = computed<ReadonlyMap<string, CardLabel>>(() => {
    this.measure.fontsVersion();
    const doc = this.store.doc();
    const view = this.view();
    const lang = this.language();
    const kin = this.kin();
    const surnames = this.surnameLines();
    const birthRow = this.birthRow();
    const bornWith = this.focusBornWith();
    const focusId = this.focusId();
    const m = this.metrics();
    const fonts = cardFonts(m);
    const width = this.options().cardWidth - m.textX - m.padRight;
    // The sex symbol takes the top right corner, the focus mark the bottom right.
    const top = view.showSex ? CORNER_ROOM : 0;
    const out = new Map<string, CardLabel>();
    for (const p of doc.people) {
      const dates = lang.lifespan(p);
      const place = p.birth?.place ?? p.death?.place ?? '';
      const relation = view.showRelationships ? kinLabel(lang, kin.get(p.id), p.sex, bornWith.get(p.id)) : '';
      const title = [displayName(p), relation, dates].filter(Boolean).join(', ');
      const bottom = p.id === focusId ? CORNER_ROOM : 0;
      const last = view.showPlaces ? 'place' : view.showDates ? 'dates' : birthRow ? 'birth' : 'surname';
      const names = surnames.get(p.id) ?? { surname: p.name.surname.trim(), birth: '' };
      out.set(p.id, {
        given: this.measure.fit(p.name.given.trim() || lang.unnamed, fonts.given, width - (view.showRelationships ? 0 : top)),
        surname: this.measure.fit(names.surname, fonts.surname, width - (last === 'surname' ? bottom : 0)),
        birth: this.measure.fit(names.birth, fonts.birth, width - (last === 'birth' ? bottom : 0)),
        dates: view.showDates ? this.measure.fit(dates, fonts.dates, width - (last === 'dates' ? bottom : 0)) : '',
        place: view.showPlaces ? this.measure.fit(place, fonts.place, width - bottom) : '',
        kin: relation ? this.measure.fit(relation, fonts.kin, width - top) : '',
        initials: initials(p),
        title,
        photo: view.showPhotos ? p.photo : undefined,
        sex: p.sex,
        deceased: !!p.death,
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
  const key = JSON.stringify([loadId, people.map((p) => p.id), families]);
  return { key, doc: reduced, loadId };
}
