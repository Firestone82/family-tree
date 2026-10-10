import { Injectable, inject } from '@angular/core';
import { displayName } from '../../../../core/model/names';
import { Person } from '../../../../core/model/types';
import { I18n } from '../../../../i18n/i18n';
import { ChartModel } from '../../../../state/chart-model';

/** A relative as a row in the panel: name, years and family colour. */
export interface Row {
  id: string;
  name: string;
  dates: string;
  tincture: string;
}

/** Makes the rows the family lists show. Reads signals, so it can be used inside computed values. */
@Injectable({ providedIn: 'root' })
export class PersonRows {
  private readonly model = inject(ChartModel);
  private readonly i18n = inject(I18n);

  row(p: Person): Row {
    return {
      id: p.id,
      name: displayName(p) || this.i18n.t('person.unnamed'),
      dates: this.i18n.lifespan(p),
      tincture: this.model.colors().byPerson.get(p.id) ?? 'argent',
    };
  }
}
