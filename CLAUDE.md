# Standing rules for this project

## Bugs are classes, not examples

When I report a bug, treat it as an example of a class of bugs, never a one-off. For every report: (1) name the general cause; (2) search the whole app, every page, component, data type and route, for every other place with the same cause; (3) fix the cause once, in shared code, not per page; (4) add a test or automated check that would catch the whole class in future; (5) report how many places were affected and fixed. Never fix only the example I gave.
