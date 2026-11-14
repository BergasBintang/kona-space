---
title: Charts in a note
kind: starter
source: starter
---
# Charts in a note

A note in Kona can hold a chart. Kona draws it from a code block that opens with the word chart, and the same numbers are one click away as a table. The block holds a few settings, then the numbers as a markdown table: a header line, a divider line and one row for each thing.

```chart
type: column
title: Sessions for each role
| Role | Sonnet | Haiku |
|---|---|---|
| Kiki | 12 | 3 |
| Jiro | 30 | 8 |
| Sora | 18 | 5 |
```

## The settings

- `type` is the one setting that has to be there. The first column of the table names each row; every other column of numbers is one series.
- Optional: `title`, `stack` (true, or percent for shares of a whole), `labels` (on or off), `legend` (off), `smooth`, `markers`, `fill`, `bins`, `line` (the columns drawn as a line in a combo), `totals` (the steps of a waterfall that are totals), `min`, `max`, `unit` (a sign such as $ or %, found from the numbers when they carry it), `x-title`, `y-title` and `height`.

## Types

The types are column, bar, line, area, combo, pie, doughnut, scatter, bubble, radar, histogram, box, waterfall, funnel, pareto, treemap, sunburst and heatmap. A pie or doughnut takes six parts or fewer (past eight the small ones are folded into Other), a scatter takes up to four series, a bubble takes a name, x, y and size, a box takes a group name and a number in each row, a waterfall names its totals, and a treemap or sunburst takes its names first and its size last.

Kona does not draw a second value axis (two scales on one chart invent a link between them: make two charts), nor 3D, surface, stock and map charts. A chart that cannot be drawn says why, in words, and shows its table instead.

How notes work: [[how-the-brain-works]]. The journey of a product: [[kona-journey]].
