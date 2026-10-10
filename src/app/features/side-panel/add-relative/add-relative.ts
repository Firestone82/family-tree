import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { displayName } from '../../../core/model/names';
import { PersonSource } from '../../../core/model/operations';
import { RelationshipStatus } from '../../../core/model/relationship';
import { ChildRelation, GenDate, Person, Sex } from '../../../core/model/types';
import { TreeStore } from '../../../core/store/tree-store';
import { I18n } from '../../../i18n/i18n';
import { Icon } from '../../../shared/icon/icon';
import { PersonPicker } from '../../../shared/person-picker/person-picker';
import { SegmentOption, Segmented } from '../../../shared/segmented/segmented';
import { PersonActions } from '../../../state/person-actions';
import { AddRequest } from '../../../state/ui-state';
import { defaultSex, defaultSurname, excludedPeople, orphanChildren, partnerOptions, sharedSiblings } from './add-rules';
import { ChildOptions } from './child-options/child-options';
import { NewPersonFields } from './new-person-fields/new-person-fields';
import { ParentOptions } from './parent-options/parent-options';
import { PartnerOptions } from './partner-options/partner-options';

/** The form for adding a parent, partner, child or sibling: a new person or someone already in the tree. */
@Component({
  selector: 'stemma-add-relative',
  imports: [Icon, Segmented, PersonPicker, NewPersonFields, ParentOptions, PartnerOptions, ChildOptions],
  templateUrl: './add-relative.html',
  styleUrl: './add-relative.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddRelativePanel {
  private readonly store = inject(TreeStore);
  private readonly people = inject(PersonActions);
  private readonly i18n = inject(I18n);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly t = this.i18n.t;

  readonly request = input.required<AddRequest>();

  protected readonly mode = signal<'new' | 'existing'>('new');
  protected readonly given = signal('');
  private readonly surnameInput = signal<string | null>(null);
  private readonly sexInput = signal<Sex | null>(null);
  protected readonly birth = signal<GenDate | undefined>(undefined);
  protected readonly deceased = signal(false);
  protected readonly existingId = signal<string | null>(null);
  protected readonly relation = signal<ChildRelation>('biological');
  protected readonly status = signal<RelationshipStatus>('married');
  private readonly otherParentInput = signal<string | null | undefined>(undefined);
  protected readonly withSiblings = signal(true);
  protected readonly joinFamily = signal(true);
  /** A new sibling is a twin of the person: born together, same date and place. */
  protected readonly twin = signal(false);

  private readonly index = this.store.index;
  protected readonly name = computed(() => displayName(this.index().person(this.request().personId)));
  protected readonly title = computed(() => this.t(`add.title.${this.request().relation}`));
  protected readonly submitLabel = computed(() => this.t(`add.submit.${this.request().relation}`));
  protected readonly modes = computed<SegmentOption<'new' | 'existing'>[]>(() => [
    { value: 'new', label: this.t('add.new') },
    { value: 'existing', label: this.t('add.existing') },
  ]);

  protected readonly partnerOptions = computed(() => partnerOptions(this.index(), this.request().personId));
  protected readonly otherParentId = computed<string | null>(() => {
    const chosen = this.otherParentInput();
    if (chosen !== undefined) return chosen;
    const requested = this.request().otherParentId;
    if (requested !== undefined) return requested;
    const options = this.partnerOptions();
    return options.length ? options[options.length - 1].id : null;
  });

  protected readonly sex = computed<Sex>(() => this.sexInput() ?? defaultSex(this.index(), this.request()));
  protected readonly surname = computed(() => this.surnameInput() ?? defaultSurname(this.index(), this.request(), this.sex(), this.otherParentId()));
  protected readonly sharedSiblings = computed(() => {
    const s = sharedSiblings(this.index(), this.request());
    return s ? { names: this.names(s.people), optional: s.optional } : null;
  });
  protected readonly orphans = computed(() => {
    const o = orphanChildren(this.index(), this.request());
    return o ? { familyId: o.familyId, names: this.names(o.people) } : null;
  });
  protected readonly exclude = computed(() => excludedPeople(this.index(), this.request(), this.otherParentId(), this.relation()));

  protected readonly siblingNote = computed(() => {
    const req = this.request();
    if (req.relation !== 'sibling') return '';
    const parents = this.index().parents(req.personId);
    if (parents.length) return this.t('add.siblingShares', { names: this.names(parents) });
    const given = this.index().person(req.personId)?.name.given;
    return given ? this.t('add.siblingNoParents', { name: given }) : this.t('add.siblingNoParentsUnnamed');
  });

  protected readonly twinLabel = computed(() => this.t('add.twin', { name: this.index().person(this.request().personId)?.name.given || this.name() }));

  protected readonly canSubmit = computed(() => (this.mode() === 'new' ? !!(this.given().trim() || this.surname().trim()) : !!this.existingId()));

  constructor() {
    // Start fresh for each request, and put the cursor in the first field.
    effect(() => {
      this.request();
      untracked(() => {
        this.mode.set('new');
        this.given.set('');
        this.surnameInput.set(null);
        this.sexInput.set(null);
        this.birth.set(undefined);
        this.deceased.set(false);
        this.existingId.set(null);
        this.relation.set('biological');
        this.status.set('married');
        this.otherParentInput.set(undefined);
        this.withSiblings.set(true);
        this.joinFamily.set(true);
        this.twin.set(false);
        setTimeout(() => this.host.nativeElement.querySelector<HTMLInputElement>('#add-given')?.focus(), 40);
      });
    });
  }

  private names(people: Person[]): string {
    return this.i18n.list(people.map((p) => p.name.given || displayName(p)));
  }

  protected setSurname(value: string): void {
    this.surnameInput.set(value);
  }

  protected setSex(sex: Sex): void {
    this.sexInput.set(sex);
  }

  protected checked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  protected setOtherParent(id: string | null): void {
    this.otherParentInput.set(id);
  }

  protected cancel(): void {
    this.people.cancelAdd();
  }

  protected submit(event?: Event): void {
    event?.preventDefault();
    if (!this.canSubmit()) return;
    const req = this.request();
    const source: PersonSource =
      this.mode() === 'existing'
        ? { existingId: this.existingId()! }
        : {
            draft: {
              given: this.given(),
              surname: this.surname(),
              sex: this.sex(),
              birth: this.birth() ? { date: this.birth() } : undefined,
              death: this.deceased() ? {} : undefined,
            },
          };
    switch (req.relation) {
      case 'parent':
        this.people.addRelative('parent', req.personId, source, {
          relation: this.relation(),
          onlyThisChild: this.sharedSiblings()?.optional ? !this.withSiblings() : false,
        });
        break;
      case 'partner': {
        const orphans = this.orphans();
        this.people.addRelative('partner', req.personId, source, {
          partner: { status: this.status(), joinFamilyId: orphans && this.joinFamily() ? orphans.familyId : undefined },
        });
        break;
      }
      case 'child':
        this.people.addRelative('child', req.personId, source, { child: { otherParentId: this.otherParentId(), relation: this.relation() } });
        break;
      case 'sibling':
        this.people.addRelative('sibling', req.personId, source, { twin: this.twin() });
        break;
    }
  }
}
