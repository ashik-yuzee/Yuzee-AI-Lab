# Open counselling response layout

Updated 17 September 2026 following feedback that the earlier design had too many boxes.

The shared GuidanceList renderer now displays ordinary headings, paragraphs, bullet lists and numbered steps in the main Quiz and Mini Pathway. Item borders, card backgrounds, rounded containers, numbered circles and topic icons were removed. Full descriptions, separate values and side text remain visible and in their original order.

Status labels are small inline text. Only consequential warnings/blocked items receive a warning icon and restrained colour. A section already labelled as checks does not repeat a warning badge on every row. General learning stages do not imply completed progress. Active question forms and real data tables retain their existing structure.

The main prompt's MEANINGFUL_VISUAL_STRUCTURE guidance is version 1.1. It now favours natural chat answers, connected paragraphs and lists only where useful, while preserving necessary teaching detail and evidence boundaries. The local server was restarted to load it. The JSON schema and routing are unchanged.

Validation: visual-guidance and Mini Pathway regressions passed, including preservation of all descriptions and comparison cells; production build passed. Browser checks at desktop and 390px confirmed ten example rows, no item borders and no horizontal overflow. The existing HTML example was regenerated with the new layout. Its nursing guide remains an illustrative design example, not a verified provider course outline.
