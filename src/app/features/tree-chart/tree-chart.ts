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
import { TreeStore } from '../../core/store/tree-store';
import { I18n } from '../../i18n/i18n';
import { Icon } from '../../shared/icon/icon';
import { ArrangeActions } from '../../state/arrange-actions';
import { ChartModel } from '../../state/chart-model';
import { PersonActions } from '../../state/person-actions';
import { Relation, UiState } from '../../state/ui-state';
import { ArrangeDrag, DRAG_START, blockOf, lowestLineMove, previewLayout } from './arrange';
import { ArrangeBar } from './arrange-bar/arrange-bar';
import { ArrangeHandles } from './arrange-handles/arrange-handles';
import { FamilyLines } from './family-lines/family-lines';
import { Screen, coupleCentre, fitView, floatOver, revealView } from './framing';
import { GenerationBands } from './generation-bands/generation-bands';
import { ChartGestures } from './gestures';
import { chartKey, neighbour } from './keyboard';
import { LayoutMotion } from './layout-motion';
import { PersonCard } from './person-card/person-card';
import { Placeholders } from './placeholders/placeholders';
import { QuickAdd } from './quick-add/quick-add';
import { RelativesFilter } from './relatives-filter/relatives-filter';
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
  imports: [GenerationBands, FamilyLines, Unions, Placeholders, PersonCard, QuickAdd, ZoomControls, RelativesFilter, ArrangeHandles, ArrangeBar, Icon],
  templateUrl: './tree-chart.html',
  styleUrl: './tree-chart.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.is-panning]': 'gestures.panning()',
    '[class.arranging]': 'ui.arranging()',
    '[class.is-dragging]': '!!drag()',
    '(keydown)': 'onKey($event)',
  },
})
export class TreeChart {
  protected readonly store = inject(TreeStore);
  protected readonly model = inject(ChartModel);
  protected readonly ui = inject(UiState);
  private readonly people = inject(PersonActions);
  protected readonly arrange = inject(ArrangeActions);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly i18n = inject(I18n);
  protected readonly t = this.i18n.t;

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
  protected readonly flashId = signal<string | null>(null);

  /** What is being dragged by hand while arranging, and how far. */
  protected readonly drag = signal<ArrangeDrag | null>(null);
  /** The layout on screen with whatever is being dragged where the pointer has it. */
  protected readonly shown = computed(() => previewLayout(this.displayed(), this.drag()));
  /** A press on a card or a line while arranging; it becomes a drag once the pointer moves. */
  private press: { pointerId: number; x: number; y: number; card?: string; line?: string; started: boolean } | null = null;
  /** The click that ends a drag is not a click on the chart. */
  private swallowArrangeClick = false;

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
    return id ? this.shown().cards.find((c) => c.personId === id) : undefined;
  });

  protected readonly selectedUnion = computed(() => {
    const s = this.store.selection();
    if (s?.kind !== 'family') return null;
    const u = this.shown().unions.find((x) => x.familyId === s.id);
    return u ? unionMarkerPoint(u) : null;
  });

  /** Where the quick-add buttons float, in screen pixels. */
  protected readonly quickAdd = computed(() => {
    const c = this.selectedCard();
    const person = this.store.selectedPerson();
    if (!c || !person || this.gestures.panning() || this.ui.adding() || this.ui.narrow() || this.ui.arranging()) return null;
    const view = this.viewport.view();
    // Zoomed far out the buttons would cover the neighbours; the panel has the same actions.
    if (view.k < 0.5) return null;
    return {
      ...floatOver(c, view),
      parentsFull: (this.store.index().primaryParentFamily(person.id)?.partners.length ?? 0) >= 2,
      isFocus: person.id === this.model.focusId(),
      name: this.i18n.name(person),
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

  // -- pointer ----------------------------------------------------------------

  protected onPointerDown(e: PointerEvent): void {
    if (this.ui.arranging() && this.pressToArrange(e)) return;
    this.gestures.down(e);
  }

  protected onPointerMove(e: PointerEvent): void {
    if (this.press?.pointerId === e.pointerId) this.dragToArrange(e);
    else this.gestures.move(e);
  }

  protected onPointerUp(e: PointerEvent): void {
    if (this.press?.pointerId === e.pointerId) this.releaseToArrange(e);
    else this.gestures.up(e);
  }

  /** While arranging, a press on a card or on a family's line may become a drag of it. */
  private pressToArrange(e: PointerEvent): boolean {
    if (this.press || (e.pointerType === 'mouse' && e.button !== 0)) return false;
    const target = e.target as Element | null;
    const line = target?.closest('[data-line]')?.getAttribute('data-line') ?? undefined;
    const card = line ? undefined : (target?.closest('[data-person]')?.getAttribute('data-person') ?? undefined);
    if (!line && !card) return false;
    this.press = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, card, line, started: false };
    try {
      this.svgRef().nativeElement.setPointerCapture(e.pointerId);
    } catch {
      // Dragging works without capture, only less well outside the chart.
    }
    return true;
  }

  private dragToArrange(e: PointerEvent): void {
    const p = this.press!;
    const sx = e.clientX - p.x;
    const sy = e.clientY - p.y;
    if (!p.started && Math.hypot(sx, sy) < DRAG_START) return;
    const k = this.viewport.view().k;
    const layout = this.displayed();
    if (p.card) {
      if (!p.started) this.motion.stop();
      const drag = this.drag();
      const block = drag?.kind === 'card' ? drag : blockOf(layout, this.store.index(), p.card);
      this.drag.set({ kind: 'card', members: block.members, families: block.families, dx: sx / k });
    } else if (p.line) {
      this.drag.set({ kind: 'line', familyId: p.line, dy: Math.max(lowestLineMove(layout, p.line), sy / k) });
    }
    p.started = true;
  }

  private releaseToArrange(e: PointerEvent): void {
    const p = this.press!;
    this.press = null;
    try {
      this.svgRef().nativeElement.releasePointerCapture(e.pointerId);
    } catch {
      // Already released.
    }
    const drag = this.drag();
    if (!p.started || !drag) {
      // A press that did not move is a click: on a card it selects them.
      this.drag.set(null);
      if (p.card && e.type === 'pointerup') this.onCardPick(p.card, e);
      this.swallowArrangeClick = true;
      setTimeout(() => (this.swallowArrangeClick = false), 50);
      return;
    }
    // The glide to the new layout starts from where the pointer left things.
    this.motion.displayed.set(this.shown());
    this.drag.set(null);
    this.swallowArrangeClick = true;
    setTimeout(() => (this.swallowArrangeClick = false), 50);
    if (drag.kind === 'card') this.arrange.moveCouple(drag.members, drag.dx);
    else this.arrange.moveLine(drag.familyId, drag.dy);
  }

  protected toggleArrange(): void {
    this.ui.arranging.update((on) => !on);
  }

  protected onTurn(e: { familyId: string; personId: string }): void {
    this.arrange.turnCouple(e.familyId, e.personId);
  }

  // -- picking ----------------------------------------------------------------

  protected onBackgroundClick(): void {
    if (this.swallowArrangeClick) return;
    if (this.gestures.swallowClick()) return;
    this.ui.adding.set(null);
    this.store.selectPerson(null);
  }

  protected onCardPick(personId: string, event: Event): void {
    event.stopPropagation();
    if (this.swallowArrangeClick) return;
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
    if (this.ui.arranging() && this.arrangeKey(e)) {
      e.preventDefault();
      return;
    }
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

  /**
   * While arranging: Escape is done; Alt with an arrow moves the selected couple
   * sideways, or the selected couple's line (click their marker) up and down.
   */
  private arrangeKey(e: KeyboardEvent): boolean {
    if ((e.target as Element | null)?.closest?.('input, textarea, select')) return false;
    if (e.key === 'Escape' && !this.press) {
      this.ui.arranging.set(false);
      return true;
    }
    const selection = this.store.selection();
    if (selection?.kind === 'family' && e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      const dy = e.key === 'ArrowUp' ? Math.max(lowestLineMove(this.displayed(), selection.id), -10) : 10;
      this.arrange.moveLine(selection.id, dy);
      return true;
    }
    const id = this.selectedId();
    if (!id || !e.altKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return false;
    const { members } = blockOf(this.displayed(), this.store.index(), id);
    this.arrange.moveCouple(members, e.key === 'ArrowLeft' ? -20 : 20);
    return true;
  }

  protected tinctureOf(personId: string) {
    return this.model.colors().byPerson.get(personId) ?? 'argent';
  }
}
