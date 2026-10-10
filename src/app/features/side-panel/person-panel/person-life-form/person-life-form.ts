import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { displayName } from '../../../../core/model/names';
import { PersonPatch } from '../../../../core/model/operations';
import { GenDate, LifeEvent, Person } from '../../../../core/model/types';
import { FileIo } from '../../../../core/services/file-io';
import { ToastService } from '../../../../core/services/toast';
import { I18n } from '../../../../i18n/i18n';
import { DateField } from '../../../../shared/date-field/date-field';
import { Icon } from '../../../../shared/icon/icon';
import { PhotoError, portraitFromFile } from '../../../../shared/photo';
import { PersonActions } from '../../../../state/person-actions';

type EventKey = 'birth' | 'death';

/** Birth and death, portrait and notes. */
@Component({
  selector: 'stemma-person-life-form',
  imports: [Icon, DateField],
  templateUrl: './person-life-form.html',
  styleUrl: './person-life-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'panel-section' },
})
export class PersonLifeForm {
  private readonly people = inject(PersonActions);
  private readonly files = inject(FileIo);
  private readonly toast = inject(ToastService);
  protected readonly t = inject(I18n).t;

  readonly person = input.required<Person>();

  protected readonly name = computed(() => displayName(this.person()));

  private patch(patch: PersonPatch, field: string): void {
    this.people.update(this.person().id, patch, field);
  }

  protected setDate(which: EventKey, date: GenDate | undefined): void {
    this.patch({ [which]: compactEvent({ ...this.person()[which], date }, which === 'death') }, `${which}.date`);
  }

  protected setPlace(which: EventKey, event: Event): void {
    const place = (event.target as HTMLInputElement).value;
    this.patch({ [which]: compactEvent({ ...this.person()[which], place: place || undefined }, which === 'death') }, `${which}.place`);
  }

  protected setDeceased(event: Event): void {
    const died = (event.target as HTMLInputElement).checked;
    this.patch({ death: died ? (this.person().death ?? {}) : undefined }, 'deceased');
  }

  protected setNotes(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.patch({ notes: value.trim() ? value : undefined }, 'notes');
  }

  protected async pickPhoto(): Promise<void> {
    const file = await this.files.pick('image/*');
    if (!file) return;
    try {
      this.patch({ photo: await portraitFromFile(file) }, 'photo');
    } catch (e) {
      this.toast.error(e instanceof PhotoError ? this.t(`photo.${e.code}`) : this.t('photo.failed'));
    }
  }

  protected removePhoto(): void {
    this.patch({ photo: undefined }, 'photo-remove');
  }
}

/** Drops empty fields; an empty birth disappears, an empty death stays (it means the person has died). */
function compactEvent(e: LifeEvent, keepEmpty: boolean): LifeEvent | undefined {
  const out: LifeEvent = {};
  if (e.date && (e.date.value || e.date.text)) out.date = e.date;
  if (e.place?.trim()) out.place = e.place;
  if (e.ext) out.ext = e.ext;
  return Object.keys(out).length || keepEmpty ? out : undefined;
}
