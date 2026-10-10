import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { LayoutCard } from '../../core/layout/layout-types';
import { unionMarkerPoint } from '../../core/layout/paths';
import { displayName } from '../../core/model/names';
import { TreeStore } from '../../core/store/tree-store';
import { I18n } from '../../i18n/i18n';
import { ChartModel } from '../../state/chart-model';
import { PersonActions } from '../../state/person-actions';
import { Relation, UiState } from '../../state/ui-state';
import { BackdropPicture } from './backdrop-picture/backdrop-picture';
import { FamilyLines } from './family-lines/family-lines';
import { Screen, coupleCentre, fitView, floatOver, revealView } from './framing';
import { GenerationBands } from './generation-bands/generation-bands';
import { ChartGestures } from './gestures';
import { chartKey, neighbour } from './keyboard';
import { LayoutMotion } from './layout-motion';
import { PersonCard } from './person-card/person-card';
import { Placeholders } from './placeholders/placeholders';
import { QuickAdd } from './quick-add/quick-add';
import { TreeBackdrop } from './tree-backdrop/tree-backdrop';
import { Unions } from './unions/unions';
import { ChartViewport, clampZoom } from './viewport';
import { ZoomControls } from './zoom-controls/zoom-controls';

/**
 * The family tree chart: an SVG canvas that can be dragged and zoomed. It
 * shows the layout from the chart model and turns clicks and keys into
 * selections. Moving the view (viewport, gestures, framing), gliding between
 * layouts (layout-motion) and the keys (keyboard) live in their own files.
 */
@Component({
  selector: 'stemma-chart',
  imports: [TreeBackdrop, BackdropPicture, GenerationBands, FamilyLines, Unions, Placeholders, PersonCard, QuickAdd, ZoomControls],
  templateUrl: './tree-chart.html',
  styleUrl: './tree-chart.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-style]': 'model.view().style',
    '[class.is-panning]': 'gestures.panning()',
    '(keydown)': 'onKey($event)',
  },
})
export class TreeChart {
  protected readonly store = inject(TreeStore);
  protected readonly model = inject(ChartModel);
  protected readonly ui = inject(UiState);
  private readonly people = inject(PersonActions);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly t = inject(I18n).t;

  /** Space covered by overlays (the bottom sheet on phones), kept clear when fitting. */
  readonly insetBottom = input(0);

  private readonly svgRef = viewChild.required<ElementRef<SVGSVGElement>>('svg');
  private readonly reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  protected readonly viewport = new ChartViewport(this.reduceMotion);
  private readonly motion = new LayoutMotion(this.viewport, this.reduceMotion);
  protected readonly gestures = new ChartGestures(
    this.viewport,
    () => this.svgRef().nativeElement,
    () => (this.motion.userMoved = true),
  );
  protected readonly size = signal<Screen>({ w: 0, h: 0 });
  /** The layout on screen; between two layouts it is an in-between frame. */
  protected readonly displayed = this.motion.displayed;
  protected readonly gliding = this.motion.gliding;
  protected readonly flashId = signal<string | null>(null);

  protected readonly worldTransform = computed(() => {
    const { x, y, k } = this.viewport.view();
    return `translate(${x.toFixed(2)},${y.toFixed(2)}) scale(${k.toFixed(4)})`;
  });
  protected readonly dotTransform = computed(() => {
    const { x, y } = this.viewport.view();
    return `translate(${x.toFixed(1)},${y.toFixed(1)})`;
  });
  protected readonly zoomPercent = computed(() => Math.round(this.viewport.view().k * 100));
  protected readonly isEmpty = computed(() => this.store.doc().people.length === 0);

  protected readonly selectedId = computed(() => {
    const s = this.store.selection();
    return s?.kind === 'person' ? s.id : null;
  });

  protected readonly selectedCard = computed<LayoutCard | undefined>(() => {
    const id = this.selectedId();
    return id ? this.displayed().cards.find((c) => c.personId === id) : undefined;
  });

  protected readonly selectedUnion = computed(() => {
    const s = this.store.selection();
    if (s?.kind !== 'family') return null;
    const u = this.displayed().unions.find((x) => x.familyId === s.id);
    return u ? unionMarkerPoint(u) : null;
  });

  /** Where the quick-add buttons float, in screen pixels. */
  protected readonly quickAdd = computed(() => {
    const c = this.selectedCard();
    const person = this.store.selectedPerson();
    if (!c || !person || this.gestures.panning() || this.ui.adding() || this.ui.narrow()) return null;
    const view = this.viewport.view();
    // Zoomed far out the buttons would cover the neighbours; the panel has the same actions.
    if (view.k < 0.5) return null;
    return {
      ...floatOver(c, view),
      parentsFull: (this.store.index().primaryParentFamily(person.id)?.partners.length ?? 0) >= 2,
      isFocus: person.id === this.model.focusId(),
      name: displayName(person),
    };
  });

  private pendingFit = true;

  constructor() {
    effect(() => {
      const target = this.model.layout();
      const loadId = this.store.loadId();
      untracked(() => {
        // Keep the person being worked on still while the chart rearranges.
        const anchors = [this.selectedId(), this.ui.adding()?.personId].filter((x): x is string => !!x);
        if (this.motion.show(target, loadId, anchors)) {
          this.pendingFit = true;
          if (this.size().w) this.initialView();
        }
      });
    });
    effect(() => {
      const req = this.ui.focusRequest();
      if (req) untracked(() => this.centreOnPerson(req.personId));
    });
    effect(() => {
      const req = this.ui.centreRequest();
      if (req) untracked(() => this.centreOnCouple(req.personId));
    });
    let firstFit = true;
    effect(() => {
      this.ui.fitRequest();
      if (firstFit) {
        firstFit = false;
        return;
      }
      untracked(() => this.fit(true));
    });
    effect(() => {
      const f = this.ui.flash();
      if (!f) return;
      untracked(() => {
        this.flashId.set(f.personId);
        setTimeout(() => {
          if (this.flashId() === f.personId) this.flashId.set(null);
        }, 1400);
      });
    });
    // Keep the selected person in view when the selection changes.
    effect(() => {
      const id = this.selectedId();
      if (id) untracked(() => setTimeout(() => this.ensureVisible(id), 0));
    });
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => this.attach(destroyRef));
  }

  // -- view -----------------------------------------------------------------

  /** The part of the chart not covered by the bottom sheet. */
  private visible(): Screen {
    const { w, h } = this.size();
    return { w, h: Math.max(120, h - this.insetBottom()) };
  }

  /**
   * The first view of a tree: everything when that is readable, otherwise the
   * home person at a comfortable zoom (a wide tree on a phone would be specks).
   */
  private initialView(): void {
    this.fit(false);
    if (this.viewport.view().k >= 0.45) return;
    const doc = this.store.doc();
    const id = doc.meta.homePersonId ?? doc.people[0]?.id;
    const c = id ? this.model.layout().cards.find((x) => x.personId === id) : undefined;
    if (!c) return;
    const { w, h } = this.visible();
    this.viewport.centreOn(c.x + c.w / 2, c.y + c.h / 2, 0.72, w, h, false);
  }

  protected fit(animate: boolean): void {
    const screen = this.visible();
    if (!screen.w || !screen.h) {
      this.pendingFit = true;
      return;
    }
    this.pendingFit = false;
    const gutter = this.model.view().showGenerations ? 40 : 0;
    this.viewport.go(fitView(this.model.layout().bounds, screen, gutter), animate);
  }

  private centreOnPerson(personId: string): void {
    const c = this.model.layout().cards.find((x) => x.personId === personId);
    if (!c) return;
    const { w, h } = this.visible();
    this.viewport.centreOn(c.x + c.w / 2, c.y + c.h / 2, Math.max(this.viewport.view().k, 0.75), w, h, true);
  }

  /** Brings a person and their partner to the middle of the view. */
  private centreOnCouple(personId: string): void {
    const centre = coupleCentre(this.model.layout(), this.store.index(), personId);
    if (!centre) return;
    const { w, h } = this.visible();
    this.motion.userMoved = true;
    this.viewport.centreOn(centre.x, centre.y, clampZoom(Math.min(Math.max(this.viewport.view().k, 0.6), 1.1)), w, h, true);
  }

  private ensureVisible(personId: string): void {
    const c = this.model.layout().cards.find((x) => x.personId === personId);
    const view = c ? revealView(c, this.viewport.view(), this.visible()) : null;
    if (view) this.viewport.go(view, true);
  }

  protected zoom(factor: number): void {
    const { w, h } = this.visible();
    this.viewport.zoomAt(factor, w / 2, h / 2, true);
  }

  private attach(destroyRef: DestroyRef): void {
    const host = this.host.nativeElement;
    const svg = this.svgRef().nativeElement;
    const measure = () => {
      const rect = host.getBoundingClientRect();
      const prev = this.size();
      this.size.set({ w: rect.width, h: rect.height });
      if (this.pendingFit || (!prev.w && rect.width)) this.initialView();
    };
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(host);
    if (!ro) measure();
    const wheel = (e: WheelEvent) => this.gestures.wheel(e);
    svg.addEventListener('wheel', wheel, { passive: false });
    destroyRef.onDestroy(() => {
      ro?.disconnect();
      svg.removeEventListener('wheel', wheel);
      this.viewport.stop();
      this.motion.stop();
    });
  }

  // -- picking ----------------------------------------------------------------

  protected onBackgroundClick(): void {
    if (this.gestures.swallowClick()) return;
    this.ui.adding.set(null);
    this.store.selectPerson(null);
  }

  protected onCardPick(personId: string, event: Event): void {
    event.stopPropagation();
    if (this.gestures.swallowClick()) return;
    if (this.ui.adding()?.personId !== personId) this.ui.adding.set(null);
    this.store.selectPerson(personId);
    // On a phone, a person tapped while zoomed far out is brought up close.
    if (this.ui.narrow() && this.viewport.view().k < 0.5) this.centreOnPerson(personId);
  }

  /** Double click centres the tree on someone; their relatives are then named from them. */
  protected onCardDoubleClick(personId: string, event: Event): void {
    event.stopPropagation();
    this.store.selectPerson(personId);
    this.people.centreOn(personId);
  }

  protected onUnionPick(familyId: string): void {
    if (this.gestures.swallowClick()) return;
    this.people.openFamily(familyId);
  }

  protected onPlaceholderPick(familyId: string): void {
    if (this.gestures.swallowClick()) return;
    const first = this.store.index().family(familyId)?.children[0]?.personId;
    if (first) this.people.startAdd('parent', first);
  }

  protected startAdd(relation: Relation): void {
    const id = this.selectedId();
    if (id) this.people.startAdd(relation, id);
  }

  protected centreHere(): void {
    const id = this.selectedId();
    if (id) this.people.centreOn(id);
  }

  // -- keyboard ---------------------------------------------------------------

  protected onKey(e: KeyboardEvent): void {
    const key = chartKey(e);
    if (!key) return;
    if (key.kind === 'zoom') this.zoom(key.factor);
    else if (key.kind === 'fit') this.fit(true);
    else {
      const id = this.selectedId();
      const next = id ? neighbour(this.store.index(), this.displayed().cards, id, key.direction) : undefined;
      if (!next) return;
      this.store.selectPerson(next);
      queueMicrotask(() => this.host.nativeElement.querySelector<SVGElement>(`[data-person="${next}"]`)?.focus({ preventScroll: true }));
    }
    e.preventDefault();
  }

  protected tinctureOf(personId: string) {
    return this.model.colors().byPerson.get(personId) ?? 'argent';
  }
}
