# Stemma XML file format

Stemma saves a family tree as one XML file. The file holds everyone in the tree,
how they are related, how the chart should look and how it is printed, so a
tree reopens exactly as it was saved. This page describes **format 1.3** and the
rules that keep files working between versions of the app.

- Namespace: `urn:stemma:family-tree` (never changes between versions)
- Root element: `<familyTree formatVersion="1.3">`
- Encoding: UTF-8
- Schema: [`schema/stemma-1.xsd`](../schema/stemma-1.xsd)
- Example: [`samples/ashworth-family.xml`](../samples/ashworth-family.xml)

```sh
xmllint --noout --schema schema/stemma-1.xsd my-tree.xml
```

## Versions and compatibility

`formatVersion` is `MAJOR.MINOR`.

| Format | App | Added |
| --- | --- | --- |
| 1.0 | Stemma 1.0 | People, families, events, photos, chart settings. |
| 1.1 | Stemma 1.1 | `<engagement>` in `<family>`; `showRelationships`, `showUnions` and `language` on `<view>`; `<print>` with print settings. |
| 1.2 | Stemma 1.2 | `showSex`, `sexColors` and `showTree` on `<view>` and `<print>`. |
| 1.3 | Stemma 1.3 | `<background>`, a picture behind the chart; `birthGroup` on `<child>` for twins and triplets. |

Files of an older minor version open in Stemma 1.3 as they are. A 1.3 file
opens in Stemma 1.0 to 1.2, which say it comes from a newer version, show
everything they know, and write the 1.3 additions back unchanged when they
save (an older app shows its drawn tree instead of the picture, and twins as
ordinary siblings).

| The file is… | What the app does |
| --- | --- |
| Same major, same or older minor (`1.0` read by an app that writes `1.2`) | Reads it normally. |
| Same major, **newer minor** (`1.3` read by an app that writes `1.0`) | Reads it and says so. Everything it does not understand is kept and written back unchanged on save. |
| **Older major** (`1.x` read by an app that writes `2.0`) | Upgrades it through the migration chain in `src/app/core/xml/migrations.ts`, then reads it and lists what was upgraded. |
| **Newer major** (`3.0` read by an app that writes `2.x`) | Refuses by default, because the structure may have changed. The user can open it anyway, best effort. |

What this means for whoever changes the format:

1. **Minor version (1.0 → 1.1)**: only add things. New elements and attributes
   must be optional, and older apps must be able to ignore them. Do not change the
   meaning of anything that exists, including what a missing attribute means.
   Enumerated values (for example `sex` or `relation`) are closed within a major
   version: a new value needs a new attribute or a major version. (That is why an
   engagement is a new element and not a new `type`.) Lists that are meant to
   grow, such as print styles and paper sizes, are open: unknown values are kept
   and something sensible is used instead. New elements go at the end of their
   parent, after the existing ones: older apps write unknown elements last, so
   the order survives a round trip.
2. **Major version (1.x → 2.0)**: anything may change, but write a migration:
   - bump `CURRENT_FORMAT` in `src/app/core/xml/format.ts`;
   - add `{ from: 1, to: '2.0', describe, apply(doc) { … } }` to `MIGRATIONS`;
     it receives the parsed XML DOM and rewrites it into the 2.0 shape;
   - add a test that reads a 1.x file (see `xml.spec.ts` for an example with a
     pretend format 0);
   - publish `schema/stemma-2.xsd`.

### Unknown content is preserved

When reading, Stemma keeps every attribute and child element it does not know,
on every element it reads: the root, `<meta>`, `<view>`, `<people>`, `<person>`,
`<name>`, the events, `<families>`, `<family>` and `<child>`. When saving, it
writes them back on the same element. Two consequences:

- A file from a newer version survives a round trip through an older one.
- Other tools can attach their own data in their own namespace, and Stemma keeps it:

```xml
<familyTree xmlns="urn:stemma:family-tree" xmlns:dna="urn:example:dna" formatVersion="1.0">
  …
  <person id="I1" sex="female" dna:kit="K-1042">
    <name given="Ada" surname="Lovelace"/>
    <dna:haplogroup>H1</dna:haplogroup>
  </person>
```

Unknown elements are written after the known ones in their parent.

### Repairs on reading

Files edited by hand or produced by other tools are read leniently. Each repair
is reported to the user after opening:

- ids that are not valid XML names, or are duplicated, get a new id;
- links (`ref`) to people who are not in the file are dropped;
- a family with more than two partners keeps the first two;
- someone listed as both partner and child of one family loses the child link;
- invalid calendar dates are kept as `dateText`;
- ancestry loops (someone recorded as their own ancestor) are reported; the
  chart ignores the loop.

## Structure

```xml
<?xml version="1.0" encoding="UTF-8"?>
<familyTree xmlns="urn:stemma:family-tree" formatVersion="1.3" generator="Stemma 1.3.0">
  <meta>
    <title>The Ashworth family</title>
    <description>An example tree.</description>
    <created>2026-10-10T08:00:00.000Z</created>
    <modified>2026-10-10T08:00:00.000Z</modified>
    <homePerson ref="I11"/>
  </meta>
  <view style="auto" colorBy="family" lines="square" density="comfortable"
        showDates="true" showPlaces="true" showPhotos="true" showGenerations="true"
        showRelationships="true" showUnions="true" language="en"
        showSex="true" sexColors="true" showTree="true"/>
  <people>
    <person id="I1" sex="male">
      <name given="Thomas" surname="Ashworth"/>
      <birth date="1898-03-14" place="Leeds, England"/>
      <death date="1971-11-02" place="Leeds, England"/>
      <occupation>Bookbinder</occupation>
      <notes>Ran a small bindery on Kirkgate for forty years.</notes>
    </person>
    …
  </people>
  <families>
    <family id="F5" type="marriage">
      <partner ref="I11"/>
      <partner ref="I14"/>
      <start date="1979" place="Manchester, England"/>
      <end reason="divorce" date="1988"/>
      <child ref="I20"/>
      <child ref="I21"/>
    </family>
    <family id="F11" type="partnership">
      <partner ref="I22"/>
      <partner ref="I26"/>
      <start date="2019"/>
      <child ref="I29"/>
      <engagement date="2024-12-24" place="Prague, Czechia"/>
    </family>
    …
  </families>
  <print theme="heirloom" paper="A3" orientation="auto" center="I11" centered="true"
         ancestors="all" descendants="2" branches="1" showTree="true"/>
  <background mediaType="image/svg+xml" encoding="base64" width="1600" height="1100"
              fit="cover" opacity="0.6" name="oak.svg">PHN2ZyB4bWxucz0i…</background>
</familyTree>
```

Elements appear in the order shown. All attributes not marked required are optional.

### `<meta>`

| Element | Content |
| --- | --- |
| `title` | Name of the tree (required). |
| `description` | Free text. |
| `created`, `modified` | ISO 8601 timestamps (`xs:dateTime`). |
| `homePerson ref` | The person the tree is centred on. Relationship names on the chart (Mother, Cousin) are given from their point of view. |

### `<view>`

How the chart is drawn. Every attribute has a default.

| Attribute | Values | Default |
| --- | --- | --- |
| `style` | `auto` (follows light/dark mode), `archive`, `print`, `night` | `auto` |
| `colorBy` | `family`, `generation`, `sex`, `none` | `family` |
| `lines` | `square`, `curved` | `square` |
| `density` | `comfortable`, `compact`. No longer used: the chart always has the same spacing. Kept and written back. | `comfortable` |
| `showDates`, `showPlaces`, `showPhotos`, `showGenerations` | `true`, `false` | `true`, `false`, `true`, `true` |
| `showRelationships` (1.1) | Relationship names on the cards. `true`, `false` | `true` |
| `showUnions` (1.1) | A note under each couple whose marker does not say it all: engaged, divorced, separated, annulled. (Earlier versions also show the dates and places of the wedding.) `true`, `false` | `true` |
| `language` (1.1) | Language of the words on the chart and in prints, a BCP 47 tag: `en`, `cs`. Languages the app does not have are kept and drawn in English. | `en` |
| `showSex` (1.2) | A ♂ or ♀ symbol in the top right corner of each card. `true`, `false` | `true` |
| `sexColors` (1.2) | Cards tinted by sex: blue for men, pink for women. `true`, `false` | `false` |
| `showTree` (1.2) | A drawn tree behind the chart: its crown over the ancestors, its trunk at the person in the middle, its roots down to the descendants. When the file has a `<background>` (1.3), that picture is shown instead. `true`, `false` | `true` |

The language of the app's own menus and panels is a setting of the browser, not
of the tree, and is not stored in the file.

### `<person>`

| Attribute | |
| --- | --- |
| `id` (required) | An XML name (`[A-Za-z_][A-Za-z0-9._-]*`), unique among people. |
| `sex` | `female`, `male`, `other`, `unknown` (default). |

| Child | |
| --- | --- |
| `name` (required) | Attributes `given`, `surname`, `birthSurname` (the surname at birth, when it differs; drawn on a line of its own under the surname), `nickname` (no longer shown or edited; kept and written back). |
| `birth`, `death` | Events (below). `<death/>` with no attributes means the person has died, details unknown. A person without `<death>` is treated as living. |
| `occupation` | Text. No longer shown or edited; kept and written back. |
| `photo` | Either base64 data with `mediaType` and `encoding="base64"`, or an `href`. |
| `notes` | Text; line breaks are kept. |

### Events: `birth`, `death`, `engagement`, `start`, `end`

| Attribute | |
| --- | --- |
| `date` | A calendar date, possibly partial: `1923`, `1923-05` or `1923-05-17`. |
| `dateQualifier` | `about`, `before`, `after`, `estimated`, `calculated`. |
| `dateText` | Wording that is not a calendar date, such as `Easter 1902`. Used instead of `date`. |
| `place` | Free text, such as `Brno, Czechia`. |
| `reason` (only on `end`) | `divorce`, `separation`, `annulment`, `death`, `other`. |

### `<family>`

A family joins up to two partners with their children. It can have:

- **two partners**: a couple, with or without children;
- **one partner**: a single known parent and their children;
- **no partners**: siblings whose parents are not recorded yet.

| Attribute | |
| --- | --- |
| `id` (required) | Unique among families. |
| `type` | `marriage` (default), `partnership`, `unknown`. |

| Child | |
| --- | --- |
| `partner ref` | 0 to 2. |
| `start`, `end` | The wedding (or the start of a partnership), and when the relationship ended. The app no longer shows or edits the dates and places of `start`, `end` and `engagement`; they are kept and written back. |
| `child ref` | In birth order; the chart draws children in this order. Attribute `relation`: `biological` (default), `adopted`, `foster`, `step`, `unknown`. Attribute `birthGroup` (1.3): children of the family with the same value were born together, as twins, triplets and so on; they stand next to each other and share the date and place of birth. |
| `notes` | Text. |
| `engagement` (1.1) | When the couple got engaged. Written after `notes`. |

Twins born to a couple:

```xml
<family id="F12">
  <partner ref="I30"/>
  <partner ref="I31"/>
  <child ref="I32" birthGroup="1"/>
  <child ref="I33" birthGroup="1"/>
  <child ref="I34"/>
</family>
```

The status shown in the app follows from these:

| Status | Stored as |
| --- | --- |
| Married | `type="marriage"`, no `end` |
| Engaged | `type="partnership"` with `<engagement>`, no `end` |
| Partners | `type="partnership"`, no `end` |
| Separated, divorced, annulled, widowed | `<end reason="separation">`, `"divorce"`, `"annulment"`, `"death"` |
| Ended for another reason | `<end reason="other">` |
| Not known | `type="unknown"` |

A person can be a child in several families, for example their birth parents
and their adoptive parents. The chart draws them under one family (birth parents
first, then adoptive, foster, step) and links the others with a dashed line.

### `<print>` (1.1)

How the tree is printed and exported. Every attribute is optional.

| Attribute | Values | Default |
| --- | --- | --- |
| `theme` | Print style: `heirloom`, `botanical`, `modern`. Styles the app does not have are kept and printed with the first one. | `heirloom` |
| `paper` | `A4`, `A3`, `A2`, `A1`, `A0`, `letter`, `tabloid`, or `fit` for a page the size of the tree. Unknown sizes are kept and printed on A3. | `A3` |
| `orientation` | `auto` (whichever fits the tree bigger), `portrait`, `landscape` | `auto` |
| `center` | The person in the middle of the page. | the home person |
| `partner` | Their partner beside them. | their current partner |
| `withPartner` | `false` to print the person without a partner. | `true` |
| `centered` | Keep the couple exactly in the middle of the page, even when one side of the family is bigger. | `true` |
| `ancestors` | Generations above the couple: a number or `all`. | `all` |
| `descendants` | Generations below the couple: a number or `all`. | `all` |
| `branches` | Side branches: `0` the direct line, `1` adds siblings, aunts, uncles, nieces and nephews, `2` first cousins, `all` everyone. Partners of everyone included are always included. | `all` |
| `title`, `subtitle` | Text for the page, instead of the tree's title and the generated summary. | |
| `showDates`, `showPlaces`, `showPhotos`, `showUnions`, `showRelationships`, `showGenerations` | What the printed cards and page show. | `true` |
| `showSex`, `sexColors`, `showTree` (1.2) | Sex symbols, cards tinted by sex, and the tree behind the chart, as on `<view>`. | `true`, `false`, `true` |

### `<background>` (1.3)

A picture of the person's own, drawn behind the chart and in prints instead of
the generated tree, wherever `showTree` is on. It is embedded like a photo.

| Attribute | Values | Default |
| --- | --- | --- |
| `mediaType`, `encoding` | The type of the picture (`image/svg+xml`, `image/png`, `image/jpeg`, `image/webp`) and `base64`; the data is the element's text. Or `href` instead. | |
| `width`, `height` | Its size in pixels (an SVG's own units), so it can be placed without loading it first. | 1000 |
| `fit` | `cover` fills the area behind the chart, cropping what sticks out; `contain` shows the whole picture. | `cover` |
| `opacity` | 0 to 1. | `1` |
| `name` | The file it came from. | |

An SVG stays a drawing and prints sharply at any size. The app turns a PDF into
a picture of its first page, about 6000 pixels on the long side, when it is
chosen; the file stores that picture.

