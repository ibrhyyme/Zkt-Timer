# Self-hosted Google Fonts

Downloaded once (2026-10-26) from the Google Fonts CSS2 API so that no page of the
app contacts `fonts.googleapis.com` or `fonts.gstatic.com`. The `@font-face` rules
are generated into `client/styles/fonts-google.scss`.

| Family | Used for | Licence |
|---|---|---|
| Roboto Mono | timer digits (the only timer face) and other numbers | Apache License 2.0 |
| JetBrains Mono | ZKT sign-in screens, trainer | SIL Open Font License 1.1 |
| Space Mono | competition schedule | SIL Open Font License 1.1 |
| Inter Tight | ZKT sign-in screens | SIL Open Font License 1.1 |

Fira Sans, Fira Mono, Kiwi Maru, Montserrat and Poppins were removed on 2026-11-04 with
the timer font picker, the only thing in the app that used them. Poppins 600/700 (latin,
latin-ext; SIL OFL 1.1) is kept in `scripts/store-fonts/poppins/` for the store screenshot
captions (`scripts/store-screenshots.js`), outside public/ so it does not ship in the app.

Both licences allow bundling and redistributing the fonts with the app.
