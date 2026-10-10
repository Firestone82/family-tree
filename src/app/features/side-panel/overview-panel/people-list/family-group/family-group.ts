import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Icon } from '../../../../../shared/icon/icon';
import { PersonRow } from '../../../../../shared/person-row/person-row';

export interface FamilyRow {
  id: string;
  name: string;
  dates: string;
  tincture: string;
  /** Left out of the chart by the Relatives setting. */
  offChart?: boolean;
}

/** One family in the people list: its name, which opens and closes the list of its members. */
@Component({
  selector: 'stemma-family-group',
  imports: [Icon, PersonRow],
  templateUrl: './family-group.html',
  styleUrl: './family-group.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.open]': 'open()' },
})
export class FamilyGroupItem {
  readonly label = input.required<string>();
  readonly tincture = input('argent');
  readonly members = input.required<readonly FamilyRow[]>();
  readonly open = input(false);
  /** Accessible name of the member count, such as "5 people". */
  readonly countLabel = input('');
  /** Says why a member is greyed out: the chart leaves them out. */
  readonly offChartHint = input('');
  readonly toggleOpen = output<void>();
  readonly pick = output<string>();
}
