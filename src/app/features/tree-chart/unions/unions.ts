import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { LayoutResult } from '../../../core/layout/layout-types';
import { unionLinePath, unionMarkerPoint } from '../../../core/layout/paths';
import { unionMark } from '../../../core/layout/union-marks';
import { RelationshipStatus, relationshipStatus } from '../../../core/model/relationship';
import { TextMeasurer } from '../../../core/services/text-measure';
import { TreeStore } from '../../../core/store/tree-store';
import { I18n } from '../../../i18n/i18n';
import { MessageKey } from '../../../i18n/locales';
import { UNION_LABEL_FONT } from '../../../state/card-metrics';
import { ChartModel } from '../../../state/chart-model';

const STATUS_TITLE: Record<RelationshipStatus, MessageKey> = {
  married: 'chart.union.married',
  engaged: 'chart.union.engaged',
  partners: 'chart.union.partners',
  separated: 'chart.union.separated',
  divorced: 'chart.union.divorced',
  annulled: 'chart.union.annulled',
  widowed: 'chart.union.widowed',
  ended: 'chart.union.ended',
  unknown: 'chart.union.unknown',
};

/**
 * Couples: the line between partners, the marker on it (interlocked rings for
 * a marriage, one ring for partners, a ring with a stone for an engagement;
 * rings apart, with a slash for a divorce, when the couple broke up), and the
 * marriage date under them. The shapes come from core/layout/union-marks.
 */
@Component({
  // eslint-disable-next-line @angular-eslint/component-selector -- drawn inside an <svg> (or on a <button>), so an attribute selector
  selector: 'g[stemmaUnions]',
  templateUrl: './unions.html',
  styleUrl: './unions.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Unions {
  private readonly store = inject(TreeStore);
  private readonly model = inject(ChartModel);
  private readonly measure = inject(TextMeasurer);
  private readonly i18n = inject(I18n);

  readonly layout = input.required<LayoutResult>();
  /** A couple was clicked (its family id). */
  readonly pick = output<string>();

  protected readonly unions = computed(() => {
    const r = this.model.view().density === 'compact' ? 4 : 4.6;
    const index = this.store.index();
    const t = this.i18n.t;
    return this.layout().unions.map((u) => {
      const fam = index.family(u.familyId);
      const status: RelationshipStatus = fam ? relationshipStatus(fam) : 'unknown';
      return {
        familyId: u.familyId,
        d: unionLinePath(u),
        at: unionMarkerPoint(u),
        mark: unionMark(fam?.kind ?? 'unknown', status, r),
        title: `${t(STATUS_TITLE[status])} ${t('chart.union.select')}`,
      };
    });
  });

  /** Marriage dates and places, under the couple on the line that leads to their children. */
  protected readonly labels = computed(() => {
    this.measure.fontsVersion();
    if (!this.model.view().showUnions) return [];
    const index = this.store.index();
    const lang = this.model.language();
    const o = this.model.options();
    const max = o.cardWidth + o.partnerGap - 16;
    const out: { familyId: string; x: number; y: number; text: string }[] = [];
    for (const u of this.layout().unions) {
      if (u.mode !== 'gap' && u.mode !== 'bridge') continue;
      const fam = index.family(u.familyId);
      const text = fam ? lang.union(fam, relationshipStatus(fam)) : '';
      if (text) out.push({ familyId: u.familyId, x: u.cx, y: u.cy + o.cardHeight / 2 + 14, text: this.measure.fit(text, UNION_LABEL_FONT, max) });
    }
    return out;
  });

  protected readonly lang = computed(() => this.model.language().code);

  protected onPick(familyId: string, event: Event): void {
    event.stopPropagation();
    this.pick.emit(familyId);
  }
}
