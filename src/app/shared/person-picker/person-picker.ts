import { ChangeDetectionStrategy, Component, computed, inject, input, model, signal } from '@angular/core';
import { normalizeQuery, searchText, sortName } from '../../core/model/names';
import { TreeStore } from '../../core/store/tree-store';
import { I18n } from '../../i18n/i18n';
import { ChartModel } from '../../state/chart-model';

let nextId = 0;

/** Search for someone already in the tree. */
@Component({
  selector: 'stemma-person-picker',
  templateUrl: './person-picker.html',
  styleUrl: './person-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonPicker {
  private readonly store = inject(TreeStore);
  private readonly model = inject(ChartModel);
  private readonly i18n = inject(I18n);

  readonly inputId = input.required<string>();
  /** People who cannot be chosen (for example because that would loop the tree). */
  readonly exclude = input<ReadonlySet<string>>(new Set());
  readonly selected = model<string | null>(null);

  protected readonly t = this.i18n.t;
  protected readonly listId = `picker-${++nextId}`;
  protected readonly query = signal('');
  protected readonly active = signal(0);

  protected readonly results = computed(() => {
    const q = normalizeQuery(this.query());
    const exclude = this.exclude();
    const colors = this.model.colors().byPerson;
    return this.store
      .doc()
      .people.filter((p) => !exclude.has(p.id) && (!q || searchText(p).includes(q)))
      .map((p) => ({ id: p.id, name: sortName(p), dates: this.i18n.lifespan(p), tincture: colors.get(p.id) ?? 'argent' }))
      .sort((a, b) => this.i18n.compare(a.name, b.name))
      .slice(0, 60);
  });

  protected readonly activeId = computed(() => (this.results().length ? `${this.listId}-${this.active()}` : null));

  protected onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.active.set(0);
  }

  protected onKey(event: KeyboardEvent): void {
    const n = this.results().length;
    if (!n) return;
    if (event.key === 'ArrowDown') {
      this.active.update((i) => Math.min(n - 1, i + 1));
      event.preventDefault();
    } else if (event.key === 'ArrowUp') {
      this.active.update((i) => Math.max(0, i - 1));
      event.preventDefault();
    } else if (event.key === 'Enter') {
      this.choose(this.results()[this.active()].id);
      event.preventDefault();
    }
  }

  protected choose(id: string): void {
    this.selected.set(id);
  }
}
