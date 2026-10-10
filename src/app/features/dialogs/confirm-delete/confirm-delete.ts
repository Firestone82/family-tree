import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, computed, inject, input, output, viewChild } from '@angular/core';
import { displayName } from '../../../core/model/names';
import { TreeStore } from '../../../core/store/tree-store';
import { I18n } from '../../../i18n/i18n';
import { Icon } from '../../../shared/icon/icon';
import { PersonActions } from '../../../state/person-actions';

/** "Delete Simon Ashworth?" Enter deletes; Escape cancels, as in any dialog. */
@Component({
  selector: 'stemma-confirm-delete',
  imports: [Icon],
  templateUrl: './confirm-delete.html',
  styleUrl: './confirm-delete.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDelete {
  private readonly store = inject(TreeStore);
  private readonly people = inject(PersonActions);
  protected readonly t = inject(I18n).t;

  readonly personId = input.required<string>();
  readonly done = output<void>();

  private readonly confirmButton = viewChild.required<ElementRef<HTMLButtonElement>>('confirmButton');

  protected readonly name = computed(() => displayName(this.store.index().person(this.personId())) || this.t('person.unnamed'));

  constructor() {
    // The dialog opens before its content is drawn, so it cannot pick the button itself.
    afterNextRender(() => this.confirmButton().nativeElement.focus());
  }

  protected confirm(): void {
    this.people.confirmDelete(this.personId());
  }
}
