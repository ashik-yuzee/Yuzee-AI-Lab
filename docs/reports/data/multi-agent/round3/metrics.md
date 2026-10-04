# MULTI_AGENT eval — metrics

Generated 2026-10-04T15:48:32.246Z · model gemini-3.7-flash · isolated server http://localhost:3021. Wall = request start → `done` (client-side). Answer start = first `delta` (VANILLA/EXP_RAG) or RESPONSE_STREAM_STARTED (MA, server clock).

| Variant | Turns | Accepted | Wall median ms | Wall mean ms | First delta median ms | MA answer-start median ms | Mean main $ | Mean aux $ | Mean total $/turn | Mean in/cached/out/think tok |
|---|---|---|---|---|---|---|---|---|---|---|
| VANILLA | 11 | 11/11 | 17632 | 17550 | 10633 | — | 0.00363 | 0.00026 | 0.00389 | 60914/46438/1838/722 |
| EXP_RAG | 11 | 11/11 | 14767 | 14741 | 8728 | — | 0.00255 | 0.00013 | 0.00268 | 21455/9122/1452/1266 |
| MULTI_AGENT | 11 | 11/11 | 14101 | 14375 | 6512 | 4044 | 0.00238 | 0.00079 | 0.00317 | 23604/9775/1351/542 |

## Failed / withheld / retried turns

None.

## Per-turn wall ms

| Turn | VANILLA | EXP_RAG | MULTI_AGENT | MA_MEDIUM | MA_LOW |
|---|---|---|---|---|
| l0-concept#1 | 22382 ($0.0038) | 13504 ($0.0023) | 14753 ($0.0024) | — | — |
| t1-lookup#1 | 17632 ($0.0032) | 15431 ($0.0027) | 14101 ($0.0025) | — | — |
| t2-fit#1 | 14477 ($0.0042) | 13239 ($0.0025) | 11371 ($0.0029) | — | — |
| t3-pathway#1 | 22718 ($0.0040) | 14623 ($0.0027) | 18589 ($0.0041) | — | — |
| t4-company#1 | 13826 ($0.0041) | 13078 ($0.0026) | 13657 ($0.0035) | — | — |
| t5-discovery#1 | 15092 ($0.0038) | 14767 ($0.0031) | 14103 ($0.0028) | — | — |
| t7-missing#1 | 13381 ($0.0031) | 9040 ($0.0015) | 10449 ($0.0026) | — | — |
| s4-change#1 | 19207 ($0.0045) | 19138 ($0.0035) | 19100 ($0.0053) | — | — |
| s10-local#1 | 15631 ($0.0038) | 15305 ($0.0029) | 16609 ($0.0031) | — | — |
| m1-multi#1 | 19306 ($0.0039) | 16075 ($0.0031) | 13279 ($0.0026) | — | — |
| m1-multi#2 | 19393 ($0.0044) | 17951 ($0.0026) | 12111 ($0.0033) | — | — |

## MULTI_AGENT agent timelines

Times are ms from request start (server clock). Agents whose [start,end] intervals overlap ran in parallel.

### t1-lookup#1 MULTI_AGENT — level 1, state completed, wall 14101 ms, answer-start 1842 ms, aux $0.00012
Understood: A quick UX designer lookup. · classifier rules · parallel: none

| Agent | Exec | Status | Start | End | Duration | $ | Summary |
|---|---|---|---|---|---|---|---|
| JOBS | retrieval | completed | 51 | 1826 | 1775 | 0.00000 | No matching job records found for Perth; 6 related occupation profiles |

Merge: confidence 0.3, conflicts 0, failed none, facts 6, findings 6, dupes removed 0, missing 1 · next actions: none

### t2-fit#1 MULTI_AGENT — level 2, state completed, wall 11371 ms, answer-start 4400 ms, aux $0.00092
Understood: Your question about UX designer needs profile, jobs and skills checks. · classifier rules · parallel: PROFILE, SKILLS, JOBS

| Agent | Exec | Status | Start | End | Duration | $ | Summary |
|---|---|---|---|---|---|---|---|
| PROFILE | analysis | completed | 30 | 2059 | 2029 | 0.00014 | Found user profile indicating cafe supervisor experience and self-taught Figma skills. |
| SKILLS | analysis | completed | 2059 | 4240 | 2181 | 0.00031 | Found user profile matching Figma skills against UX designer roles with identified capability gaps. |
| JOBS | analysis | completed | 31 | 4399 | 4368 | 0.00034 | Found 5 UX designer job records and multiple adjacent design roles. |

Merge: confidence 0.7, conflicts 0, failed none, facts 7, findings 9, dupes removed 0, missing 5 · next actions: Which of these jobs fit me?; Close my top skill gap; Add your missing details

### t3-pathway#1 MULTI_AGENT — level 3, state completed, wall 18589 ms, answer-start 5976 ms, aux $0.00169
Understood: Your question about UX design needs profile, jobs, skills, market, learning and pathway checks. · classifier rules · parallel: PROFILE, MARKET, SKILLS, JOBS, LEARNING, PATHWAY

| Agent | Exec | Status | Start | End | Duration | $ | Summary |
|---|---|---|---|---|---|---|---|
| PROFILE | analysis | completed | 102 | 1900 | 1798 | 0.00009 | Found user statement expressing intent to transition from hospitality to UX design. |
| MARKET | analysis | completed | 102 | 4308 | 4205 | 0.00021 | No direct UX design vacancy or salary data was found in the provided evidence. |
| SKILLS | analysis | completed | 1900 | 4613 | 2713 | 0.00026 | Found UX design competency requirements and evaluated skill gaps for transitioning from hospitality. |
| JOBS | analysis | completed | 102 | 4711 | 4609 | 0.00023 | Found zero direct job records and five design-related occupations. |
| LEARNING | analysis | completed | 103 | 5006 | 4903 | 0.00033 | Found 3 learning options and 3 units to support the transition into UX design. |
| PATHWAY | analysis | completed | 1900 | 5974 | 4074 | 0.00042 | Found UX design qualifications and short courses to transition from hospitality. |

Merge: confidence 0.48, conflicts 0, failed none, facts 9, findings 10, dupes removed 1, missing 8 · next actions: Compare UX courses; Build this pathway; Close my top skill gap; Add your missing details

### t4-company#1 MULTI_AGENT — level 3, state completed, wall 13657 ms, answer-start 4271 ms, aux $0.00096
Understood: Your question about product needs profile, jobs, company, skills and learning checks. · classifier rules · parallel: COMPANY, LEARNING, SKILLS, JOBS

| Agent | Exec | Status | Start | End | Duration | $ | Summary |
|---|---|---|---|---|---|---|---|
| PROFILE | analysis | completed | 106 | 106 | 0 | 0.00000 | No saved profile details yet, so I am working from this message only |
| COMPANY | analysis | completed | 106 | 2003 | 1897 | 0.00000 | No records naming Canva in Yuzee's data |
| LEARNING | analysis | completed | 106 | 4002 | 3896 | 0.00022 | Found 3 learning options and 3 units to close product role gaps. |
| SKILLS | analysis | completed | 106 | 4009 | 3903 | 0.00029 | Found product and production management roles requiring specific skills. |
| JOBS | analysis | completed | 106 | 4270 | 4164 | 0.00031 | Found product and production management job records and matching occupational roles in the evidence. |

Merge: confidence 0.41, conflicts 0, failed none, facts 5, findings 5, dupes removed 0, missing 8 · next actions: Compare learning options; Which of these jobs fit me?; Close my top skill gap; Add your missing details

### t5-discovery#1 MULTI_AGENT — level 2, state completed, wall 14103 ms, answer-start 4044 ms, aux $0.00063
Understood: Your question about teaching assistant needs profile, jobs and opportunities checks. · classifier rules · parallel: PROFILE, JOBS, OPPORTUNITY

| Agent | Exec | Status | Start | End | Duration | $ | Summary |
|---|---|---|---|---|---|---|---|
| PROFILE | analysis | completed | 103 | 104 | 1 | 0.00000 | No saved profile details yet, so I am working from this message only |
| JOBS | analysis | completed | 103 | 3767 | 3664 | 0.00024 | Found 0 job records and 5 adjacent role types. |
| OPPORTUNITY | analysis | completed | 104 | 4042 | 3938 | 0.00027 | Found 1 matching teaching assistant role and several related educational qualifications. |

Merge: confidence 0.47, conflicts 0, failed none, facts 5, findings 5, dupes removed 0, missing 8 · next actions: Explore Graduate Teaching Assistant; Add your missing details

### t7-missing#1 MULTI_AGENT — level 2, state completed, wall 10449 ms, answer-start 3854 ms, aux $0.00058
Understood: Your question needs profile, jobs and opportunities checks. · classifier rules · parallel: PROFILE, OPPORTUNITY, JOBS

| Agent | Exec | Status | Start | End | Duration | $ | Summary |
|---|---|---|---|---|---|---|---|
| PROFILE | analysis | completed | 72 | 73 | 1 | 0.00000 | No saved profile details yet, so I am working from this message only |
| OPPORTUNITY | analysis | completed | 73 | 3834 | 3761 | 0.00022 | Found 5 potential occupations based on general career catalogues. |
| JOBS | analysis | completed | 72 | 3853 | 3781 | 0.00024 | Found zero job records and six occupation profiles across administrative and healthcare domains. |

Merge: confidence 0.33, conflicts 0, failed none, facts 3, findings 4, dupes removed 0, missing 7 · next actions: Explore Credit Checker; Add your missing details

### s4-change#1 MULTI_AGENT — level 3, state completed, wall 19100 ms, answer-start 5845 ms, aux $0.00200
Understood: Your question needs profile, jobs, skills, market, learning and pathway checks. · classifier rules · parallel: PROFILE, SKILLS, JOBS, MARKET, LEARNING, PATHWAY

| Agent | Exec | Status | Start | End | Duration | $ | Summary |
|---|---|---|---|---|---|---|---|
| PROFILE | analysis | completed | 89 | 1856 | 1767 | 0.00014 | Found 1 user statement detailing retail management experience and career transition intent. |
| SKILLS | analysis | completed | 1856 | 4858 | 3002 | 0.00030 | Found retail management experience and multiple HR occupations requiring active listening, coordination, and critical thinking. |
| JOBS | analysis | completed | 90 | 5284 | 5194 | 0.00032 | Found 3 HR roles and several adjacent career profiles matching retail management background. |
| MARKET | analysis | completed | 90 | 5324 | 5234 | 0.00033 | Found positive national employment projections for human resource managers, clerks, and professionals. |
| LEARNING | analysis | completed | 90 | 5326 | 5236 | 0.00035 | Identified relevant HR qualifications, skill sets and postgraduate courses matching your retail background. |
| PATHWAY | analysis | completed | 1856 | 5844 | 3988 | 0.00041 | Found career paths into HR supported by your retail management background and relevant qualifications. |

Merge: confidence 0.78, conflicts 0, failed none, facts 15, findings 17, dupes removed 1, missing 8 · next actions: Explore Certificate IV in HR; Build this pathway; Close my top skill gap; Add your missing details

### s10-local#1 MULTI_AGENT — level 1, state completed, wall 16609 ms, answer-start 2532 ms, aux $0.00013
Understood: A quick disability support worker lookup. · classifier rules · parallel: none

| Agent | Exec | Status | Start | End | Duration | $ | Summary |
|---|---|---|---|---|---|---|---|
| LEARNING | retrieval | completed | 56 | 1946 | 1890 | 0.00000 | Found 14 course and qualification records for Geelong |

Merge: confidence 0.7, conflicts 0, failed none, facts 6, findings 6, dupes removed 0, missing 0 · next actions: none

### m1-multi#2 MULTI_AGENT — level 3, state completed, wall 12111 ms, answer-start 4033 ms, aux $0.00139
Understood: Your question about with regular business hours needs profile, jobs, skills, market, learning and pathway checks. · classifier rules · parallel: PROFILE, MARKET, PATHWAY, JOBS, SKILLS, LEARNING

| Agent | Exec | Status | Start | End | Duration | $ | Summary |
|---|---|---|---|---|---|---|---|
| PROFILE | analysis | completed | 4 | 1728 | 1724 | 0.00012 | Found nurse profile indicating shift work burnout in Brisbane. |
| MARKET | analysis | completed | 4 | 3542 | 3538 | 0.00020 | Found six healthcare and data occupation profiles matching general criteria. |
| PATHWAY | analysis | completed | 1728 | 3555 | 1827 | 0.00019 | Found nurse profile seeking business hours, but lack specific role and study evidence. |
| JOBS | analysis | completed | 4 | 3588 | 3584 | 0.00022 | Found 0 job records and 6 adjacent occupation profiles in the evidence. |
| SKILLS | analysis | completed | 1728 | 3880 | 2152 | 0.00024 | Found nurse profile and health administration units aligning with business hours roles. |
| LEARNING | analysis | completed | 4 | 4032 | 4028 | 0.00027 | Found 6 postgraduate healthcare management courses and 2 nursing diploma and advanced diploma pathways. |

Merge: confidence 0.52, conflicts 0, failed none, facts 10, findings 11, dupes removed 1, missing 8 · next actions: Add target business hours roles; Compare learning options; Close my top skill gap

**Total Gemini cost for this collection: $0.1072** (33 turns; main + auxiliary).