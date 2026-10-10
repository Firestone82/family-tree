import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TreeStore } from '../../core/store/tree-store';
import { I18n } from '../../i18n/i18n';
import { SHEET_PEEK, UiState } from '../../state/ui-state';
import { AddRelativePanel } from './add-relative/add-relative';
import { FamilyPanel } from './family-panel/family-panel';
import { OverviewPanel } from './overview-panel/overview-panel';
import { PersonPanel } from './person-panel/person-panel';

/**
 * Shows what is being worked on: the tree overview, a person, a family, or the
 * form for adding a relative. A column on the right on wide screens, a sheet
 * that slides up from the bottom on phones.
 */
@Component({
  selector: 'stemma-side-panel',
  imports: [PersonPanel, FamilyPanel, AddRelativePanel, OverviewPanel],
  templateUrl: './side-panel.html',
  styleUrl: './side-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'complementary',
    '[attr.aria-label]': "t('panel.label')",
    '[class.narrow]': 'ui.narrow()',
    '[class.open]': 'ui.sheetOpen()',
    '[class.expanded]': 'ui.sheetFull()',
    '[style.--peek]': 'peek',
  },
})
export class SidePanel {
  protected readonly store = inject(TreeStore);
  protected readonly ui = inject(UiState);
  protected readonly t = inject(I18n).t;
  protected readonly peek = `${SHEET_PEEK}px`;

  private drag: { y: number; id: number } | null = null;
  private dragged = false;

  protected toggle(): void {
    if (this.dragged) {
      this.dragged = false;
      return;
    }
    this.ui.sheetExpanded.set(!this.ui.sheetFull());
  }

  /** Tapping the collapsed sheet opens it fully, except on controls inside it. */
  protected peekTap(event: Event): void {
    if (!this.ui.narrow() || this.ui.sheetFull()) return;
    if ((event.target as HTMLElement).closest('button, input, a, select, textarea, label')) return;
    this.ui.sheetExpanded.set(true);
  }

  protected dragStart(e: PointerEvent): void {
    this.drag = { y: e.clientY, id: e.pointerId };
    this.dragged = false;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  protected dragMove(e: PointerEvent): void {
    if (this.drag && e.pointerId === this.drag.id && Math.abs(e.clientY - this.drag.y) > 8) this.dragged = true;
  }

  /** Swipe up to open the sheet fully; swipe down to lower it, then to close it. */
  protected dragEnd(e: PointerEvent): void {
    if (!this.drag) return;
    const dy = e.clientY - this.drag.y;
    this.drag = null;
    if (dy < -40) this.ui.sheetExpanded.set(true);
    else if (dy > 40) {
      if (this.ui.sheetFull()) {
        this.ui.sheetExpanded.set(false);
        this.ui.adding.set(null);
      } else {
        this.store.selection.set(null);
        this.ui.peopleOpen.set(false);
      }
    }
  }
}
