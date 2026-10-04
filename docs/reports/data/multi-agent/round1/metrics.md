# MULTI_AGENT eval — metrics

Generated 2026-10-04T14:57:56.101Z · model gemini-3.7-flash · isolated server http://localhost:3011. Wall = request start → `done` (client-side). Answer start = first `delta` (VANILLA/EXP_RAG) or RESPONSE_STREAM_STARTED (MA, server clock).

| Variant | Turns | Accepted | Wall median ms | Wall mean ms | First delta median ms | MA answer-start median ms | Mean main $ | Mean aux $ | Mean total $/turn | Mean in/cached/out/think tok |
|---|---|---|---|---|---|---|---|---|---|---|
| VANILLA | 11 | 11/11 | 17809 | 17459 | 10748 | — | 0.00457 | 0.00024 | 0.00482 | 62580/37739/1926/939 |
| EXP_RAG | 11 | 11/11 | 13357 | 14083 | 7849 | — | 0.00252 | 0.00013 | 0.00265 | 20963/7463/1350/1107 |
| MA_MEDIUM | 11 | 10/11 | 16231 | 16770 | 10236 | 5106 | 0.00261 | 0.00089 | 0.00351 | 22185/8127/1342/1171 |
| MA_LOW | 7 | 7/7 | 12247 | 15050 | 7450 | 6398 | 0.00237 | 0.00127 | 0.00363 | 24603/9644/1507/63 |

### MA_LOW subset (t2-fit, t3-pathway, t4-company, t5-discovery, s4-change, m1-multi)

| Variant | Turns | Wall median ms | Mean total $/turn |
|---|---|---|---|
| VANILLA | 7 | 18819 | 0.00453 |
| EXP_RAG | 7 | 13728 | 0.00279 |
| MA_MEDIUM | 7 | 18792 | 0.00408 |
| MA_LOW | 7 | 12247 | 0.00363 |

## Failed / withheld / retried turns

- s10-local#1 MA_MEDIUM: status 200, accepted false, retried false, error protocol_validation_error — schema: `/content_blocks/1: must have required property 'text'` (model JSON parsed; answer withheld from the user, blind.json shows "(no answer)"). Not retried (not a transport/5xx failure).

## Per-turn wall ms

| Turn | VANILLA | EXP_RAG | MA_MEDIUM | MA_LOW |
|---|---|---|---|---|
| l0-concept#1 | 17809 ($0.0069) | 12040 ($0.0028) | 15564 ($0.0026) | — |
| t1-lookup#1 | 17643 ($0.0072) | 11156 ($0.0025) | 9289 ($0.0023) | — |
| t2-fit#1 | 18764 ($0.0045) | 13728 ($0.0027) | 19993 ($0.0040) | 12070 ($0.0032) |
| t3-pathway#1 | 19143 ($0.0042) | 20968 ($0.0034) | 18792 ($0.0045) | 19532 ($0.0046) |
| t4-company#1 | 15462 ($0.0049) | 15744 ($0.0030) | 20452 ($0.0041) | 12247 ($0.0034) |
| t5-discovery#1 | 20085 ($0.0041) | 13357 ($0.0027) | 14462 ($0.0033) | 12132 ($0.0029) |
| t7-missing#1 | 9536 ($0.0022) | 8583 ($0.0015) | 10428 ($0.0021) | — |
| s4-change#1 | 18819 ($0.0048) | 14452 ($0.0027) | 26043 ($0.0054) | 22258 ($0.0050) |
| s10-local#1 | 17523 ($0.0050) | 19327 ($0.0028) | 16231 ($0.0031) | — |
| m1-multi#1 | 15356 ($0.0040) | 12513 ($0.0025) | 15842 ($0.0030) | 10337 ($0.0023) |
| m1-multi#2 | 21914 ($0.0051) | 13046 ($0.0026) | 17378 ($0.0042) | 16772 ($0.0040) |

## MULTI_AGENT agent timelines

Level-0 turns (l0-concept MA_MEDIUM, m1-multi#1 MA_MEDIUM/MA_LOW) emitted no orchestration events: no plan, no specialists — they are answered like EXP_RAG.

Times are ms from request start (server clock). Agents whose [start,end] intervals overlap ran in parallel.

### t1-lookup#1 MA_MEDIUM — level 1, state completed, wall 9289 ms, answer-start 2289 ms, aux $0.00012
Understood: A quick UX designer lookup. · classifier rules · parallel: none

| Agent | Exec | Status | Start | End | Duration | $ | Summary |
|---|---|---|---|---|---|---|---|
| JOBS | retrieval | completed | 536 | 2286 | 1749 | 0.00000 | No matching job records found for Perth; 6 related occupation profiles |

Merge: confidence 0.3, conflicts 0, failed none, facts 6, findings 6, dupes removed 0, missing 1 · next actions: none

### t2-fit#1 MA_LOW — level 2, state completed, wall 12070 ms, answer-start 5477 ms, aux $0.00102
Understood: Your question about UX designer needs profile, jobs and skills checks. · classifier rules · parallel: PROFILE, SKILLS, JOBS

| Agent | Exec | Status | Start | End | Duration | $ | Summary |
|---|---|---|---|---|---|---|---|
| PROFILE | analysis | completed | 26 | 2127 | 2101 | 0.00011 | Found 1 self-reported profile statement regarding UX suitability. |
| SKILLS | analysis | completed | 2127 | 4867 | 2740 | 0.00040 | Found 1 user profile and multiple UX and customer service role records. |
| JOBS | analysis | completed | 26 | 5476 | 5450 | 0.00037 | Found 6 job records and 1 adjacent role types related to UX design. |

Merge: confidence 0.63, conflicts 0, failed none, facts 10, findings 12, dupes removed 2, missing 5 · next actions: Which of these jobs fit me?; How to build User Experience (UX) Design; Add your missing details

### t2-fit#1 MA_MEDIUM — level 2, state completed, wall 19993 ms, answer-start 5106 ms, aux $0.00107
Understood: Your question about UX designer needs profile, jobs and skills checks. · classifier rules · parallel: PROFILE, JOBS, SKILLS

| Agent | Exec | Status | Start | End | Duration | $ | Summary |
|---|---|---|---|---|---|---|---|
| PROFILE | analysis | completed | 14 | 2238 | 2224 | 0.00016 | Found 1 user statement regarding cafe supervision experience and self-taught Figma skills. |
| JOBS | analysis | completed | 14 | 4987 | 4973 | 0.00037 | Found 6 job records and 1 adjacent role types in the retrieved sample. |
| SKILLS | analysis | completed | 2238 | 5104 | 2866 | 0.00041 | Found self-taught Figma skills and cafe supervisor experience compared with UX designer requirements. |

Merge: confidence 0.68, conflicts 0, failed none, facts 6, findings 14, dupes removed 1, missing 6 · next actions: Which of these jobs fit me?; How to build User Experience (UX) Design; Add your missing details

### t3-pathway#1 MA_LOW — level 3, state completed, wall 19532 ms, answer-start 9970 ms, aux $0.00194
Understood: Your question about UX design needs profile, jobs, skills, market, learning and pathway checks. · classifier rules · parallel: PROFILE, JOBS, MARKET, SKILLS, LEARNING

| Agent | Exec | Status | Start | End | Duration | $ | Summary |
|---|---|---|---|---|---|---|---|
| PROFILE | analysis | completed | 51 | 2122 | 2071 | 0.00011 | Found profile statement regarding career transition. |
| JOBS | analysis | completed | 51 | 5802 | 5751 | 0.00029 | Found 0 job records and 5 adjacent design occupation profiles in the evidence. |
| MARKET | analysis | completed | 51 | 5833 | 5782 | 0.00026 | Found no UX design records in evidence, only unrelated roles like lecturers and other designer types. |
| SKILLS | analysis | completed | 2122 | 5934 | 3812 | 0.00031 | Found UX design competency units and identified key skills for transitioning from hospitality. |
| LEARNING | analysis | completed | 51 | 6890 | 6839 | 0.00047 | Found UX design learning options ranging from skill sets to postgraduate study. |
| PATHWAY | analysis | completed | 6890 | 9968 | 3078 | 0.00037 | Found targeted learning options and design occupations to build a transition pathway into UX design. |

Merge: confidence 0.48, conflicts 0, failed none, facts 13, findings 20, dupes removed 4, missing 8 · next actions: Refine study preferences; Build this pathway; Compare learning options; How to build user experience methodology

### t3-pathway#1 MA_MEDIUM — level 3, state completed, wall 18792 ms, answer-start 9687 ms, aux $0.00199
Understood: Your question about UX design needs profile, jobs, skills, market, learning and pathway checks. · classifier rules · parallel: PROFILE, MARKET, SKILLS, JOBS, LEARNING

| Agent | Exec | Status | Start | End | Duration | $ | Summary |
|---|---|---|---|---|---|---|---|
| PROFILE | analysis | completed | 81 | 2128 | 2047 | 0.00011 | Found profile request to transition from hospitality to UX design with no experience details. |
| MARKET | analysis | completed | 81 | 5233 | 5151 | 0.00025 | Found various design and ICT occupations, but no specific UX design demand data. |
| SKILLS | analysis | completed | 2128 | 6096 | 3968 | 0.00036 | Analyzed user skills against UX requirements and identified critical and transferable skill gaps. |
| JOBS | analysis | completed | 81 | 6735 | 6654 | 0.00037 | Found 6 design occupation profiles and related roles for career transition exploration. |
| LEARNING | analysis | completed | 81 | 7315 | 7234 | 0.00047 | Found 3 relevant UX design learning options ranging from skill sets to postgraduate study. |
| PATHWAY | analysis | completed | 7315 | 9686 | 2371 | 0.00028 | Found structured learning options and skill sets to transition from hospitality into UX design. |

Merge: confidence 0.54, conflicts 0, failed none, facts 13, findings 20, dupes removed 2, missing 8 · next actions: Build Pathway; Compare learning options; How to build user experience methodology; Add your missing details

### t4-company#1 MA_LOW — level 3, state completed, wall 12247 ms, answer-start 5159 ms, aux $0.00113
Understood: Your question about product needs profile, jobs, company, skills and learning checks. · classifier rules · parallel: PROFILE, COMPANY, JOBS, LEARNING, SKILLS

| Agent | Exec | Status | Start | End | Duration | $ | Summary |
|---|---|---|---|---|---|---|---|
| PROFILE | analysis | completed | 45 | 47 | 1 | 0.00000 | No saved profile details yet, so I am working from this message only |
| COMPANY | analysis | completed | 46 | 1931 | 1885 | 0.00000 | No records naming Canva in Yuzee's data |
| JOBS | analysis | completed | 46 | 4552 | 4506 | 0.00031 | Found product and management role profiles and mapping data in the evidence. |
| LEARNING | analysis | completed | 46 | 4582 | 4536 | 0.00026 | Found learning options for product management and agile methodologies. |
| SKILLS | analysis | completed | 47 | 5158 | 5111 | 0.00041 | Found recurring product development and strategy requirements across multiple industry units. |

Merge: confidence 0.34, conflicts 0, failed none, facts 10, findings 13, dupes removed 1, missing 8 · next actions: Compare learning options; How to build Product and technology strategy; Add your missing details

### t4-company#1 MA_MEDIUM — level 3, state completed, wall 20452 ms, answer-start 6856 ms, aux $0.00123
Understood: Your question about product needs profile, jobs, company, skills and learning checks. · classifier rules · parallel: COMPANY, SKILLS, LEARNING, JOBS

| Agent | Exec | Status | Start | End | Duration | $ | Summary |
|---|---|---|---|---|---|---|---|
| PROFILE | analysis | completed | 16 | 17 | 1 | 0.00000 | No saved profile details yet, so I am working from this message only |
| COMPANY | analysis | completed | 17 | 3680 | 3663 | 0.00000 | No records naming Canva in Yuzee's data |
| SKILLS | analysis | completed | 17 | 6298 | 6281 | 0.00034 | Found product and production management records to identify required skills and potential gaps. |
| LEARNING | analysis | completed | 17 | 6781 | 6764 | 0.00034 | Found 3 units and 3 courses related to product management and digital product design. |
| JOBS | analysis | completed | 17 | 6856 | 6839 | 0.00042 | Found 6 job records and 4 adjacent role types related to product and production management. |

Merge: confidence 0.43, conflicts 0, failed none, facts 10, findings 13, dupes removed 0, missing 8 · next actions: Compare learning options; Which of these jobs fit me?; How to build Product Management; Add your missing details

### t5-discovery#1 MA_LOW — level 2, state completed, wall 12132 ms, answer-start 4780 ms, aux $0.00070
Understood: Your question about teaching assistant needs profile, jobs and opportunities checks. · classifier rules · parallel: PROFILE, JOBS, OPPORTUNITY

| Agent | Exec | Status | Start | End | Duration | $ | Summary |
|---|---|---|---|---|---|---|---|
| PROFILE | analysis | completed | 57 | 58 | 1 | 0.00000 | No saved profile details yet, so I am working from this message only |
| JOBS | analysis | completed | 57 | 4755 | 4698 | 0.00029 | Found 0 job records and 5 adjacent role types for teaching assistant in Melbourne. |
| OPPORTUNITY | analysis | completed | 59 | 4780 | 4721 | 0.00028 | Found teaching assistant adjacent roles and qualifications from the evidence. |

Merge: confidence 0.37, conflicts 0, failed none, facts 4, findings 7, dupes removed 0, missing 8 · next actions: Explore Graduate Teaching Assistant; Add your missing details

### t5-discovery#1 MA_MEDIUM — level 2, state completed, wall 14462 ms, answer-start 4521 ms, aux $0.00072
Understood: Your question about teaching assistant needs profile, jobs and opportunities checks. · classifier rules · parallel: PROFILE, OPPORTUNITY, JOBS

| Agent | Exec | Status | Start | End | Duration | $ | Summary |
|---|---|---|---|---|---|---|---|
| PROFILE | analysis | completed | 61 | 62 | 1 | 0.00000 | No saved profile details yet, so I am working from this message only |
| OPPORTUNITY | analysis | completed | 63 | 3814 | 3751 | 0.00024 | Found matching teaching assistant roles and adjacent qualifications from the evidence. |
| JOBS | analysis | completed | 61 | 4520 | 4459 | 0.00035 | Found 6 occupational profiles and 5 adjacent roles related to teaching assistants in Melbourne. |

Merge: confidence 0.43, conflicts 0, failed none, facts 6, findings 8, dupes removed 0, missing 8 · next actions: Explore Graduate Teaching Assistant; Add your missing details

### t7-missing#1 MA_MEDIUM — level 2, state completed, wall 10428 ms, answer-start 4270 ms, aux $0.00068
Understood: Your question needs profile, jobs and opportunities checks. · classifier rules · parallel: PROFILE, JOBS, OPPORTUNITY

| Agent | Exec | Status | Start | End | Duration | $ | Summary |
|---|---|---|---|---|---|---|---|
| PROFILE | analysis | completed | 69 | 70 | 1 | 0.00000 | No saved profile details yet, so I am working from this message only |
| JOBS | analysis | completed | 69 | 4030 | 3961 | 0.00029 | Found 0 job records and 5 adjacent role types from occupation profiles. |
| OPPORTUNITY | analysis | completed | 70 | 4268 | 4198 | 0.00027 | Found several occupations matching the evidence to explore. |

Merge: confidence 0.37, conflicts 0, failed none, facts 6, findings 7, dupes removed 0, missing 8 · next actions: Explore Credit Checker; Add your missing details

### s4-change#1 MA_LOW — level 3, state completed, wall 22258 ms, answer-start 10489 ms, aux $0.00218
Understood: Your question needs profile, jobs, skills, market, learning and pathway checks. · classifier rules · parallel: PROFILE, SKILLS, JOBS, LEARNING, MARKET

| Agent | Exec | Status | Start | End | Duration | $ | Summary |
|---|---|---|---|---|---|---|---|
| PROFILE | analysis | completed | 98 | 2224 | 2125 | 0.00015 | Found retail management experience and career transition goal. |
| SKILLS | analysis | completed | 2224 | 7130 | 4906 | 0.00039 | Found retail management experience and HR goal with transferable leadership skills. |
| JOBS | analysis | completed | 99 | 7142 | 7043 | 0.00031 | Found 5 human resources roles and mapped Australian occupation profiles with projected growth. |
| LEARNING | analysis | completed | 99 | 7606 | 7507 | 0.00043 | Found multiple human resources courses, units and skill sets matching your career transition goals. |
| MARKET | analysis | completed | 99 | 7695 | 7596 | 0.00040 | Found national employment projections and profiles for human resource managers, professionals, and clerks. |
| PATHWAY | analysis | completed | 7695 | 10488 | 2793 | 0.00036 | Found 3 career transition routes into human resources leveraging retail management experience. |

Merge: confidence 0.76, conflicts 0, failed none, facts 15, findings 20, dupes removed 3, missing 8 · next actions: Refine study preferences; Build this pathway; Compare learning options; How to build Human Resources Management/Personnel Adm

### s4-change#1 MA_MEDIUM — level 3, state completed, wall 26043 ms, answer-start 9222 ms, aux $0.00200
Understood: Your question needs profile, jobs, skills, market, learning and pathway checks. · classifier rules · parallel: PROFILE, JOBS, MARKET, SKILLS, LEARNING

| Agent | Exec | Status | Start | End | Duration | $ | Summary |
|---|---|---|---|---|---|---|---|
| PROFILE | analysis | completed | 83 | 2228 | 2145 | 0.00015 | Found 1 user profile statement containing retail management experience and career transition goal. |
| JOBS | analysis | completed | 83 | 5711 | 5628 | 0.00029 | Found 0 job records and 4 adjacent role types for moving from retail management to HR. |
| MARKET | analysis | completed | 83 | 6062 | 5979 | 0.00034 | Found 3 HR occupation profiles and national employment projections indicating positive growth across roles. |
| SKILLS | analysis | completed | 2228 | 6240 | 4012 | 0.00039 | Found 20 years of retail management experience and recurring human resources role requirements. |
| LEARNING | analysis | completed | 83 | 6832 | 6749 | 0.00040 | Found multiple learning options ranging from skill sets to postgraduate degrees for transitioning into HR. |
| PATHWAY | analysis | completed | 6832 | 9218 | 2386 | 0.00028 | Found multiple pathways from retail management to human resources utilizing vocational and postgraduate learning options. |

Merge: confidence 0.7, conflicts 0, failed none, facts 12, findings 18, dupes removed 2, missing 8 · next actions: Build Pathway; Compare learning options; How to build Labor and Industrial Relations; Add your missing details

### s10-local#1 MA_MEDIUM — level 1, state completed, wall 16231 ms, answer-start 1825 ms, aux $0.00013
Understood: A quick disability support worker lookup. · classifier rules · parallel: none

| Agent | Exec | Status | Start | End | Duration | $ | Summary |
|---|---|---|---|---|---|---|---|
| LEARNING | retrieval | completed | 83 | 1824 | 1741 | 0.00000 | Found 6 course and qualification records for Geelong |

Merge: confidence 0.7, conflicts 0, failed none, facts 6, findings 6, dupes removed 0, missing 0 · next actions: none

### m1-multi#2 MA_LOW — level 3, state completed, wall 16772 ms, answer-start 7319 ms, aux $0.00177
Understood: Your question about with regular business hours needs profile, jobs, skills, market, learning and pathway checks. · classifier rules · parallel: PROFILE, LEARNING, MARKET, JOBS, SKILLS

| Agent | Exec | Status | Start | End | Duration | $ | Summary |
|---|---|---|---|---|---|---|---|
| PROFILE | analysis | completed | 13 | 1809 | 1796 | 0.00011 | Found 1 profile record regarding shift work burnout and registered nurse status in Brisbane. |
| LEARNING | analysis | completed | 13 | 4077 | 4064 | 0.00030 | Found postgraduate courses and medical administration skill sets matching regular business hours. |
| MARKET | analysis | completed | 13 | 4201 | 4188 | 0.00026 | Found several healthcare occupation profiles for exploring alternative roles, but lack specific Brisbane vacancy data. |
| JOBS | analysis | completed | 13 | 4463 | 4450 | 0.00033 | Found 6 healthcare occupation profiles relevant to nursing and patient support roles. |
| SKILLS | analysis | completed | 1809 | 4543 | 2734 | 0.00032 | Found 3 adjacent occupations and 3 relevant training units for business hours transition. |
| PATHWAY | analysis | completed | 4543 | 7319 | 2776 | 0.00031 | Found three potential career pathways utilizing nursing experience to transition into regular business hours roles. |

Merge: confidence 0.63, conflicts 0, failed none, facts 16, findings 23, dupes removed 0, missing 8 · next actions: Discuss study preferences; Build this pathway; Compare learning options; How to build medical terminology

### m1-multi#2 MA_MEDIUM — level 3, state completed, wall 17378 ms, answer-start 6936 ms, aux $0.00166
Understood: Your question about with regular business hours needs profile, jobs, skills, market, learning and pathway checks. · classifier rules · parallel: PROFILE, MARKET, SKILLS, LEARNING, JOBS

| Agent | Exec | Status | Start | End | Duration | $ | Summary |
|---|---|---|---|---|---|---|---|
| PROFILE | analysis | completed | 4 | 1843 | 1839 | 0.00014 | Found registered nurse profile in Brisbane seeking regular business hours. |
| MARKET | analysis | completed | 4 | 3687 | 3683 | 0.00023 | Found six healthcare occupation profiles for exploring roles, though specific local demand figures are absent. |
| SKILLS | analysis | completed | 1843 | 4034 | 2191 | 0.00024 | Found nursing background and identified relevant health administration and telehealth units. |
| LEARNING | analysis | completed | 4 | 4132 | 4128 | 0.00031 | Found qualification and unit records relevant to healthcare, clinical care, and nursing pathways. |
| JOBS | analysis | completed | 4 | 4586 | 4582 | 0.00032 | Found 6 occupation profiles and related healthcare roles in the provided evidence. |
| PATHWAY | analysis | completed | 4586 | 6935 | 2349 | 0.00026 | Found nursing background and explored healthcare administration, telehealth, and clinical courses for regular business hours. |

Merge: confidence 0.59, conflicts 0, failed none, facts 14, findings 18, dupes removed 0, missing 8 · next actions: Explore telehealth courses; Build this pathway; Compare learning options; How to build Administer and coordinate Telehealth ser

**Total Gemini cost for this collection: $0.1462** (40 turns; main + auxiliary).