# Fonts

No font binaries are bundled yet.

When the project is ready to vendor typography assets, place the licensed webfont files for:

* Outfit: display, HUD numerals, and compact UI headings.
* Inter: body copy, coaching text, menus, and results panels.

Recommended filenames:

* `Outfit-Regular.woff2`
* `Outfit-SemiBold.woff2`
* `Outfit-Bold.woff2`
* `Inter-Regular.woff2`
* `Inter-Medium.woff2`
* `Inter-SemiBold.woff2`

`src/ui/variables.css` already declares Outfit/Inter with system fallbacks, so the UI remains readable until `@font-face` rules are added.
