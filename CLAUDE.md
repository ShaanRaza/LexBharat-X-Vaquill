# Standing rules for this project

## Bugs are classes, not examples

When I report a bug, treat it as an example of a class of bugs, never a one-off. For every report: (1) name the general cause; (2) search the whole app, every page, component, data type and route, for every other place with the same cause; (3) fix the cause once, in shared code, not per page; (4) add a test or automated check that would catch the whole class in future; (5) report how many places were affected and fixed. Never fix only the example I gave.

## Before every push

Run `npm run ui-sweep` (browser sweep of every page type at 1280 px and 375 px, see docs/AUDIT-CLASSES.md) together with `npm run test:extract` and `npx tsc --noEmit`. Report what the sweep finds and fix it by class, per the rule above. Do not add to `scripts/ui-sweep/allow.json` without a reason written next to the entry.
