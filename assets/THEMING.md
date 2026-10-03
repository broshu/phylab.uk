# PhyLab colour themes

Load `/assets/theme.css` in the document head before page styles. It follows the system colour scheme, declares the native form-control scheme, and centralises the UI palette. Pages do not need a theme switch or a second hard-coded dark palette.

Use `--site-bg` for the page, `--site-surface` for cards and controls, `--site-surface-soft` for inset panels, `--site-text` and `--site-muted` for text, and `--site-border` / `--site-border-soft` for separators. Use `--site-green` with `--site-on-accent` for filled primary controls. Links and hover states use `--site-green` / `--site-green-hover`. Status text uses `--site-success`, `--site-danger`, `--site-info` or `--site-amber`.

The existing site names (`--paper`, `--card`, `--ink`, `--muted`, `--line`, `--green`, `--green-2`, `--accent`, `--shadow`) are shared aliases. Lab-local names can also refer to the shared tokens; do not assign the same interface colour independently on each page.

Physics colours encode meaning and are separate from UI colours. Existing fixed-palette figures use `--site-figure-bg` to keep dark labels readable in either scheme. Camera scenes and oscilloscope displays have their own viewing surfaces. Avoid blanket inversion or recolouring of image pixels, canvas drawings, or charge signs.

Printed AR markers require black ink on white paper. Their fixed palette and the print media rules must be preserved. Verify both marker sheets in print preview after changing their presentation.

Frame Sequencer is shipped as a compiled app. Its UI theme is supplied by `labs/frame-sequencer/assets/theme-overrides.css`, loaded after the compiled stylesheet. If the app is rebuilt and utility classes change, check those overrides again.

Check both system schemes, focus and selected states, native select menus, mobile widths, and a live switch of the system scheme. Existing fixed-palette diagrams and source images can remain light inside a themed frame.
