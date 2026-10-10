import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { ageBetween, todayDate } from '../../../../core/model/dates';
import { LifeEvent, Person } from '../../../../core/model/types';
import { TreeStore } from '../../../../core/store/tree-store';
import { I18n } from '../../../../i18n/i18n';
import { MessageKey } from '../../../../i18n/locales';
import { Icon } from '../../../../shared/icon/icon';
import { Relation } from '../../../../state/ui-state';

/** Buttons to add a relative, and the person's life in a sentence or two. */
@Component({
  selector: 'stemma-person-summary',
  imports: [Icon],
  templateUrl: './person-summary.html',
  styleUrl: './person-summary.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'panel-section', '[attr.aria-label]': "t('person.addRelative')", role: 'group' },
})
export class PersonSummary {
  private readonly store = inject(TreeStore);
  private readonly i18n = inject(I18n);
  protected readonly t = this.i18n.t;

  readonly person = input.required<Person>();
  readonly add = output<Relation>();

  protected readonly needsParents = computed(() => {
    const primary = this.store.index().primaryParentFamily(this.person().id);
    return !primary || primary.partners.length < 2;
  });

  /** "Born 14 March 1898 in Leeds, England", "Died 2 November 1971, aged 73". */
  protected readonly facts = computed(() => {
    const p = this.person();
    const out: string[] = [];
    const born = this.event('fact.born', p.birth);
    if (born) out.push(born);
    if (p.death) {
      const died = this.event('fact.died', p.death) || this.t('fact.died');
      const age = ageBetween(p.birth?.date, p.death.date);
      out.push(age ? this.t(age.approximate ? 'fact.diedAgedAbout' : 'fact.diedAged', { died, count: age.years }) : died);
    } else if (p.birth?.date?.value) {
      const age = ageBetween(p.birth.date, todayDate());
      if (age && age.years < 120) out.push(this.t(age.approximate ? 'fact.ageAbout' : 'fact.age', { count: age.years }));
    }
    return out;
  });

  private event(prefix: 'fact.born' | 'fact.died', e: LifeEvent | undefined): string {
    if (!e) return '';
    const date = this.i18n.dates().fullDate(e.date);
    const place = e.place ?? '';
    if (date && place) return this.t(`${prefix}.datePlace` as MessageKey, { date, place });
    if (date) return this.t(`${prefix}.date` as MessageKey, { date });
    if (place) return this.t(`${prefix}.place` as MessageKey, { place });
    return '';
  }
}
