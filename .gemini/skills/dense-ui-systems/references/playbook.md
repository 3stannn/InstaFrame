# Intentional UI playbook

## Visual constraints
1. Neutral canvas and panel surfaces, hairline borders, and one restrained accent. In dark mode preserve contrast without saturated glow effects.
2. Reject neon gradients, colored shadow halos, rainbow badge systems, oversized diffuse shadows, and oversized hero headings in operational screens.
3. Prefer a useful header with title, context, and one primary action; a compact filter/search toolbar; the actual work surface; and a clear pagination/result count footer.
4. Avoid repeated nested cards and arbitrary four-card metric rows. A metric is justified only if it supports a real decision with a defined calculation and time range.
5. Use short line heights carefully, a small type scale, clear weights, and tabular numerals for amounts and measurements. Do not turn all prose into monospace.

## Accessible density
1. Prefer native tables for tabular data. Include a caption or accessible label, column headers, scoped headers where needed, and aria-sort on the active sortable column.
2. Put links/buttons inside cells rather than making an entire row a fake button. Do not assign grid roles unless implementing the required grid keyboard model.
3. Compact visual rows must retain usable targets. Provide a minimum 24-by-24 CSS-pixel target or applicable WCAG spacing exception; prefer larger touch targets.
4. Search/filter state should survive navigation where useful. Ensure screen-reader announcements do not fire noisily for every keystroke.
5. Support 200% zoom, keyboard-only operation, high contrast, reduced motion, and narrow screens. Horizontal table scrolling may be appropriate; label the scroll region and preserve critical columns.
6. Text contrast targets: at least 4.5:1 for normal text, 3:1 for large text; meaningful controls/focus indicators require sufficient non-text contrast.

## State contract
1. Loading: explain what is loading and reserve layout space without endless shimmer.
2. Empty-new: explain the domain item and provide a concrete create/import action.
3. Empty-filtered: show active filters and a clear reset control.
4. Error: preserve input, identify the failed action, give retry/recovery, and avoid exposing secrets.
5. Forbidden: explain the needed permission without revealing protected records.
6. Pending/success: announce the action result and prevent accidental duplicates without concealing server failures.

## Data authenticity
Store ISO timestamps; render timezone-aware local dates with an explicit zone or accessible full timestamp. Fixtures may use examples such as API quota, job duration, or invoice aging only when those concepts belong to the product. Label all synthetic values; never make up supposedly live data.
