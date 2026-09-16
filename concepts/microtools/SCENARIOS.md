# Scenarios and acceptance review

This records the original 15 September fixture review. See `STREAMING-REVIEW.md` for the 16 September live conversation and compact streaming update.

Reviewed 15 September 2026. The 31 automated concept checks, TypeScript check and isolated production build pass. All data below is illustrative. Automated checks validate deterministic logic; browser checks verify interaction and layout. Neither substitutes for testing with actual users or live source data.

## Five primary journeys

| User / goal | Path demonstrated | Expected experience | Verification |
|---|---|---|---|
| Student or family understanding study | Course → skills → specific skill → required depth → evidence gap | Basic answer first; choose the skill; answer a short role question; never equate missing evidence with missing capability | Engine and browser |
| Adult exploring a career change | Career → specialisation → career → stages → skill depth | Separate specialisation, responsibility and skill proficiency; keep previous answer available | Full engine path; specialisation in browser |
| Job seeker or team exploring an employer | Company → roles → company skills → specific skill | Separate example role families from live vacancies; do not infer hiring or unmet needs | Full engine path; roles and company skills in browser |
| Educator reviewing a course | Curriculum skills → industry alignment → improvement options | Ask for target industry and typed location; do not claim an industry gap without evidence; validate before changing curriculum | Engine and browser |
| Person exploring a sector | Industry → local roles → career → skills → practice | Keep location explicit; distinguish role connections from local demand; carry context into learning routes | Full engine path; local roles and career in browser |

## Interaction and failure cases

| Scenario | Expected handling | Current coverage |
|---|---|---|
| First answer | Explain the immediate topic without requiring a tool click | Engine + browser |
| Too many potential tools | Three cards initially; expandable to at most five reviewed choices | Engine + browser |
| More than one skill / role | Named entity choices; no silent selection for ambiguous natural questions | Engine + browser cards |
| Missing location | User types location in a labelled field; no geolocation | Engine + browser |
| Location unknown to user | User can give an approximate region/country; this POC does not geocode or assert it exists | Text input; real location disambiguation remains future work |
| Empty / whitespace-only required input | Block execution and show the relevant question | Engine; native form constraint in browser |
| Previously provided location | Carry it down that branch instead of asking again | Engine |
| Course comparison | Ask for a second distinct course; show common factors and unresolved information | Engine + browser |
| Wrong comparison entity | Reject same course, nonexistent ID or non-course entity | Engine |
| Fee / funding question | Collect location and application status; clearly state data is not connected | Engine + browser |
| Uncertain status | “Not sure yet” is valid; no eligibility assumption | Engine + browser |
| Skill gap | Show submitted experience and target as unassessed; ask for real evidence before scoring | Engine + browser |
| Course outcome | Sample direction is not a verified outcome or employment promise | Engine + browser |
| Company roles | Example roles are not advertised vacancies | Engine + browser |
| Curriculum gap | Lack of industry data does not establish misalignment | Engine + browser |
| Unsupported natural question | Say the concept cannot answer; keep relevant actions available | Engine + browser |
| Natural question with one known intent | Route only to a single eligible bound action | Engine |
| Natural question with ambiguous entities | Ask the user to choose the intended item | Engine |
| Invented / disabled tool | Fail closed | Engine |
| Forged or unknown entity | Reject the request | Engine |
| Stale parent / other journey | Reject mismatched context | Engine |
| Repeated identical successful call | Suppress suggestions; execution can reopen the saved answer | Engine suppression; saved navigation in browser |
| Empty service response | No facts or negative capability inference; keep prior answers | Engine; available in lab simulation |
| Failed request | Preserve parent and offer retry or return | Engine + browser |
| Retry after simulated error | Same context; new response, old result preserved | Browser |
| Earlier branch | Saved answers and breadcrumbs reopen the original result | Engine + browser |
| Switching journeys | Each keeps its own answers and context | Browser |
| Switching during sample loading | Ignore the cancelled response | Implemented request token; not separately timing-tested |
| Stop exploring | Clear stopping state with a resume option | Browser |
| Narrow screen | Cards stack; readable inputs; no horizontal document overflow | Browser at requested 390 × 844 |
| Keyboard access | Native buttons, labelled form controls, visible focus and focused follow-up input | Browser focus/inputs; full assistive-technology audit remains open |
| Local event recording | Log IDs and outcomes; omit free text/location from downloads | Code review; no external telemetry |
| Runtime model JSON corruption | Must fail before rendering | Not applicable to fixtures; production schema validator still required |
| Stale / conflicting / multi-source evidence | Show source dates, scope and unresolved conflicts | Not connected; no source freshness or conflict claims in POC |
| Refresh persistence | Reload starts fresh; no silent storage of profile text | Documented memory-only design |

## What to learn from people

Recruit separate sessions with younger students (with appropriate consent), parents/family members, adult career changers and educators. Do not assume one age group has one reading or technology skill level.

Use tasks rather than explaining the controls: “Find what you would practise”, “Check another course”, “Find something you still need to confirm”, “Return to a previous answer”, and “Ask a question in your own words”. Record whether they finish without help, what they believe is verified, whether they notice the next actions, which label they choose, where they hesitate and whether they can find their earlier answer.

Success criteria to agree before live integration:

- Users can explain the main answer and identify its limitations in their own words.
- Users can choose a relevant next question without needing the entire tool catalog.
- Users understand when they are supplying information versus asking for new research.
- Users can distinguish a course-to-role connection from a verified opening or guaranteed outcome.
- Users can recover from no data and return to their previous place.
- Users can stop comfortably rather than feeling obliged to follow every suggestion.

The concept’s event export helps inspect clicks and branches, but it does not measure comprehension or prove suitability for ages 15–55. Those conclusions require the sessions above.
