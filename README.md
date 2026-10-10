# Stemma

An Angular app for mapping a family and getting a clear family tree drawn for you.
You add people and how they are related; the chart lays itself out, colours each
family, names everyone's relationship to the person you centre on, and prints as
a poster in one of three styles. Trees are saved as a versioned XML file that
keeps working as the app changes.

## Features

- **Automatic layout** for real families, not just simple trees: in-laws with their
  own parents, remarriages, divorces, single parents, siblings whose parents are
  unknown, adoption alongside birth parents, cousin marriages, marriages across
  generations, and separate trees side by side. The layout keeps line crossings
  to a minimum, keeps each family's children together under their own line, and
  draws children in birth order.
- **Fast entry**: select someone and add a parent, partner, child or sibling, either
  a new person or someone already in the tree. Sensible defaults (surname, sex,
  which partner is the other parent). Dates are typed the way people write them:
  `17.5.1923`, `May 1923`, `abt 1900`, `before 1850`.
- **Centre on anyone** (double-click a card, or Centre): the view moves to that
  person and their partner, and every card says how its person is related to
  them: Mother, Great-aunt, Sister-in-law, First cousin once removed, Wife's
  cousin. Half and step relations, adoption and in-laws are recognised.
  Relationship names are available in English and Czech (switchable per tree;
  Czech uses the proper genitive forms, e.g. *sestřenice dědečka*).
- **Relationships with status**: married, engaged, partners, separated, divorced,
  widowed or annulled, each with dates and places (engagement, wedding, end),
  chosen already when a partner is added. The marker between partners shows
  interlocked rings for a marriage; a couple who broke up have their rings
  pulled apart, cut with a red slash for a divorce. A note such as
  *m. 1952, Lyon* sits under each couple.
- **Twins, triplets and more**: children of a couple can be marked as born
  together (in the family panel, or when adding a sibling). They stand side by
  side and hang from one point on the chart; a twin of the person in the middle
  is called *twin sister* (*sestra-dvojče*). They keep one date and place of
  birth: change it for one and it changes for all.
- **Surnames that fill themselves in**: a new child, sibling or father gets the
  family name, and a surname at birth that is not written in is taken from the
  father. In a Czech tree the form follows the sex: a daughter of Mikula is
  Mikulová, of Černý Černá, of Marek Marková (and back, for a father).
- **Pretty by default**: family-name colours on heraldic shields (Novák and
  Nováková count as one family), interlocked rings for marriages, a double slash
  for divorce, generation numbers, portraits, four styles (Auto, Archive, Print,
  Night), square or curved lines, and smooth animation when the tree changes.
- **A tree behind the chart**, drawn like an illustration: a leafy crown over
  the ancestors, limbs that fork at each couple, the trunk at the person in the
  middle and roots reaching down to their children and grandchildren. It is
  grown from the layout, so it follows the family as it changes, and it is drawn
  in each style's own colours on screen and in prints.
- **Or a picture of your own** behind the chart instead: SVG, PDF, JPEG, PNG or
  WebP, filling the area or shown whole, at the strength you choose. An SVG
  stays sharp at any size and a PDF is converted at print resolution, so a
  poster on A2 or A1 looks right. The picture is saved inside the XML file.
- **Families at a glance**: the people list groups everyone by family name
  (Mikula and Mikulová together), each family opening and closing, and the
  children of a couple are numbered in birth order.
- **Sex at a glance**, each switchable: a ♂ or ♀ symbol in the corner of each
  card, and cards tinted blue for men and pink for women.
- **In English and Czech**: the app's menus and panels follow the browser's
  language and can be switched under Appearance. The words on the chart are a
  separate setting saved with the tree, so a Czech tree prints in Czech for
  anyone.
- **Print and export** (File, Print and export, or Ctrl+P) with a live preview:
  - three styles: **Heirloom** (vellum, ornamental frame, title on a ribbon),
    **Botanical** (a herbarium sheet; the family grows upwards from roots to
    leafy branches) and **Modern** (white paper, fine lines);
  - the chosen couple in the middle of the page, with their families around
    them, or the whole tree fitted to the page;
  - how far the print reaches: generations up, generations down, and side
    branches (direct line, siblings, cousins, everyone);
  - A4 to A0, US Letter and Tabloid, or a page sized to the tree, with the size
    the names will print at;
  - output to the printer, PDF, PNG or SVG (fonts embedded).
- **Versioned XML** (see below), plus a copy kept in the browser as you work.
- Undo and redo, keyboard navigation (arrow keys move between relatives), light and
  dark mode, and a bottom-sheet layout on phones.

## Getting started

Requires Node.js 22.22.3+ or 24.15+ (Angular 22).

```sh
npm install
npm start          # http://localhost:4200
npm test           # unit tests (Vitest)
npm run lint       # ESLint: TypeScript, Angular and template accessibility rules
npm run format     # Prettier (npm run format:check only checks)
npm run build      # production build in dist/stemma/browser
```

The build is a static site; host `dist/stemma/browser` anywhere.

## Continuous integration and GitHub Pages

`.github/workflows/ci.yml` runs on every push and pull request: it installs
with `npm ci`, lints, checks formatting, runs the unit tests, validates the
example file against the XML schema and builds the site. Pushes to `main` are
then published to GitHub Pages, built with the repository's path as base URL
(or `/` for a `<name>.github.io` repository).

To switch publishing on once: in the repository, open Settings, then Pages, and
under Build and deployment choose **GitHub Actions** as the source.

## The XML file

`File → Save as XML` writes the whole tree, including the chart settings, to a
single file. It is designed to work between versions:

- The root element carries `formatVersion="MAJOR.MINOR"` (currently 1.3); the namespace never changes.
- Files from **older** versions are upgraded on opening through a migration chain.
- Files from **newer minor** versions open, and anything this version does not
  understand is written back unchanged on save, so no data is lost.
- Files from a **newer major** version are refused rather than misread (the user
  can open them anyway).
- Other tools can add their own data in their own namespace; it is preserved.

The full specification and the rules for changing the format are in
[docs/xml-format.md](docs/xml-format.md). There is an XML schema in
[schema/stemma-1.xsd](schema/stemma-1.xsd) and an example in
[samples/ashworth-family.xml](samples/ashworth-family.xml).

## How the code is organised

```
src/app/
  core/                    framework-free logic, unit tested
    model/                 types, dates, names, relationship status, edit operations,
                           surnames at birth, twins (births.ts)
    kinship/               how everyone is related to one person
    lang/                  words on the chart and prints (English, Czech), and how
                           surnames change with sex (cs-surnames.ts)
    colors/                family colours
    xml/                   format constants, writer, parser, migrations
    layout/                automatic layout, line drawing, and the tree behind
                           the chart (tree-shape.ts, foliage.ts, organic.ts)
    poster/                printed pages: scope, paper, styles (themes/), PDF
    store/                 the open tree with undo/redo (signals)
    services/              files, image export, toasts, text measuring, background
                           pictures (pdf.js is loaded only when a PDF is chosen)
  i18n/                    the app's own words: I18n service, message format,
                           locales/ (en.ts is the reference, cs.ts)
  state/                   app state and actions shared by the features:
                           chart model, UI state, document, person, family and
                           background actions, preferences, autosave, shortcuts
  features/                one folder per part of the screen
    top-bar/               title, undo/redo, file and appearance menus
    tree-chart/            the SVG chart: cards, lines, unions, tree backdrop,
                           quick add, zoom; pan/zoom, framing, keys and the glide
                           between layouts are plain classes beside it
    side-panel/            overview, person, family and add-relative panels
    print-studio/          the print and export studio
    dialogs/               confirmations, import report, XML viewer, format notes
    toasts/, empty-state/, sample-note/
  shared/                  small reusable components: icon, switch, segmented
                           control, person row, date field, person picker, and
                           the background picture picker
src/styles/                global design system: tokens, base, controls, panels,
                           menus, dialogs, and the chart's colour sets
```

Every component lives in its own folder with its template, styles and code in
separate files (`name.html`, `name.scss`, `name.ts`). When a component is split
into smaller ones, they go into subfolders of its folder: `side-panel/person-panel/`
holds `person-header/`, `person-summary/`, `person-name-form/`,
`person-life-form/` and `person-family/`, which in turn holds `parent-groups/`,
`couple-list/` and `sibling-list/`.

Components keep dependencies short and one way. A component that changes the
tree calls the services in `state/` itself (for example
`PersonActions.startAdd('partner', id)`), so actions do not travel up through
several parents; small presentational parts (switches, option groups, form
sections) take inputs and emit one output to the component that owns them. Logic that does not need Angular is in `core/` or in
plain classes and functions beside the component (`tree-chart/framing.ts`,
`add-relative/add-rules.ts`), where it is tested on its own.

Edits are pure functions over immutable documents (`core/model/operations.ts`),
which keeps undo simple and makes them easy to test. The layout
(`core/layout/layout.ts`) works in five steps: generations, couple blocks,
crossing reduction (barycentre sweeps from several starting orders, block flips,
adjacent swaps, and moving people out from under other families' sibling bars),
positioning (a spring model solved row by row with weighted isotonic regression),
and line routing with stacked tracks. It is only recomputed when the shape of
the tree changes, starts from the previous order so edits do not reshuffle the
chart, and lays out 800 people in well under a second.

## Adding a print style

A print style is one file in `src/app/core/poster/themes/` that exports a
`PosterTheme` (see `poster-types.ts`):

- **palette, tinctures and fonts**: paper, ink, line and accent colours, the
  family colours, and the card text (any of the bundled Alegreya faces, which
  exports embed);
- **card**: width, padding, the badge (`shield`, `seal`, `bar` or `none`) and
  the lines (relationship, name, surname, dates, place);
- **spacing and lines**: gaps between cards and rows, and `square`, `curved`
  or `branch` lines; `flow: 'up'` draws the oldest generation at the bottom;
- **tree**: the colours of the tree behind the chart: `wood`, `bark`, three
  `canopy` tones (shade, body, light), the `leaves` and an `opacity`;
- **page**: `background`, `header` and `footer` (each returns its height and a
  draw function), and optionally `overlay`, `cardShape`, `connectors`,
  `unionMarker`, `focus` and `generationLabel` to replace the default drawing.

Sizes on the page are given in `page.u`, 1% of the paper's shorter side, so a
style looks the same on A4 and A0. Add the style to `POSTER_THEMES` in
`themes/index.ts`; its `id` is saved in the XML file. `heirloom.ts` uses every
hook, `modern.ts` is the shortest.

## Adding a language

A language has two parts, and either can come first.

**The app's words** (menus, panels, messages) are in `src/app/i18n/locales/`:

1. Copy `en.ts` to `xx.ts` and translate the messages. The catalogue is typed
   against English (`export const xx: Catalogue = { … }`), so the build fails
   until every message is there, and a test checks that each translation uses
   the same `{placeholders}`.
2. Messages with a `{count}` give plural forms for the language's rules, e.g.
   Czech `{ one: '{count} osoba', few: '{count} osoby', other: '{count} osob' }`.
3. Add the language to `LOCALES` in `locales/index.ts` with its own name and
   the locale used for plurals, sorting and lists. It then appears under
   Appearance, and is chosen automatically for browsers set to it.

Components get the words with `protected readonly t = inject(I18n).t;` and
`{{ t('file.save') }}` in templates; `t` reads a signal, so everything updates
when the language changes. Messages from the core (why an edit was refused,
repairs made while reading a file) carry a code and English text; the app shows
the translation of the code when there is one (`op.*`, `file.error.*`,
`notice.xml.*`), so a new message works before it is translated.

**The words on the chart and in prints** (relationship names, marriages, dates)
come from a language pack in `src/app/core/lang/` (`en.ts`, `cs.ts`). Write a
pack with the same functions and add it to `LANGUAGES` in `language.ts`. The
relationship engine (`core/kinship/kinship.ts`) is language-neutral: it gives
the pack the generations up and down, half, step, in-law and partner
relations, and the pack chooses the words. The app also borrows the pack's
date formats for its own language.

## Styles

Global styles in `src/styles/` are the design system: `_tokens.scss` holds the
colours, type and spacing of the interface (with dark mode), and the other
partials the few classes many components share (buttons, fields, menus,
dialogs, panel sections). Everything else is in the component's own `.scss`.

The chart is coloured only through `--t-*` tokens (paper, cards, lines, the
tints for men and women, the tree's wood, crown and leaves) and `--tc-*` tokens
(family colours). `_chart-themes.scss` defines one set per chart style as SCSS
maps, so a new chart style is a new map there.

## Notes

- Fonts: Alegreya, Alegreya SC and Alegreya Sans by Huerta Tipográfica (SIL Open
  Font License), self-hosted through the `@fontsource` packages.
- The copy kept in the browser goes to localStorage, or to IndexedDB when a
  large background picture makes the tree too big for it.
- When the app runs as a Claude artifact, downloads go through the viewer's
  `downloads` capability, which does not allow `.xml`; the app then shows the XML
  to copy or save as a text file. In a normal browser it downloads directly.
  Printing through the browser is not available inside the artifact viewer;
  save a PDF and print that instead.
- PDF and PNG files are drawn at 200 dpi (less on very large paper, to stay
  within what phones can draw). For big posters from a print shop, use SVG.
