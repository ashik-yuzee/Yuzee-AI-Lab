# MULTI_AGENT eval — metrics

Generated 2026-10-04T15:56:47.630Z · model gemini-3.7-flash · isolated server http://localhost:3021. Wall = request start → `done` (client-side). Answer start = first `delta` (VANILLA/EXP_RAG) or RESPONSE_STREAM_STARTED (MA, server clock).

| Variant | Turns | Accepted | Wall median ms | Wall mean ms | First delta median ms | MA answer-start median ms | Mean main $ | Mean aux $ | Mean total $/turn | Mean in/cached/out/think tok |
|---|---|---|---|---|---|---|---|---|---|---|
| MULTI_AGENT | 8 | 8/8 | 13915 | 14407 | 7005 | 4959 | 0.00240 | 0.00104 | 0.00344 | 24423/9122/1478/136 |
| MA_COMPOSER_MEDIUM | 8 | 8/8 | 17668 | 17016 | 11104 | 4386 | 0.00267 | 0.00104 | 0.00371 | 23342/10026/1534/1189 |

## Failed / withheld / retried turns

None.

## Per-turn wall ms

| Turn | VANILLA | EXP_RAG | MULTI_AGENT | MA_MEDIUM | MA_LOW | MA_COMPOSER_MEDIUM |
|---|---|---|---|---|
| t2-fit#1 | — | — | 13695 ($0.0032) | — | — | 16701 ($0.0037) |
| t3-pathway#1 | — | — | 15699 ($0.0042) | — | — | 17782 ($0.0043) |
| t4-company#1 | — | — | 14134 ($0.0036) | — | — | 19371 ($0.0040) |
| t5-discovery#1 | — | — | 13411 ($0.0030) | — | — | 15122 ($0.0032) |
| t7-missing#1 | — | — | 11591 ($0.0026) | — | — | 9719 ($0.0018) |
| s4-change#1 | — | — | 17202 ($0.0045) | — | — | 21950 ($0.0053) |
| m1-multi#1 | — | — | 15960 ($0.0026) | — | — | 17933 ($0.0034) |
| m1-multi#2 | — | — | 13566 ($0.0039) | — | — | 17553 ($0.0040) |

## MULTI_AGENT agent timelines

Times are ms from request start (server clock). Agents whose [start,end] intervals overlap ran in parallel.

### t2-fit#1 MA_COMPOSER_MEDIUM — level 2, state completed, wall 16701 ms, answer-start 5081 ms, aux $0.00091
Understood: Your question about UX designer needs profile, jobs and skills checks. · classifier rules · parallel: PROFILE, SKILLS, JOBS

| Agent | Exec | Status | Start | End | Duration | $ | Summary |
|---|---|---|---|---|---|---|---|
| PROFILE | analysis | completed | 48 | 2768 | 2720 | 0.00014 | Found user self-reporting as a cafe supervisor with Figma skills. |
| SKILLS | analysis | completed | 2768 | 4957 | 2189 | 0.00031 | Found user skills in Figma and supervision alongside UX job and unit requirements. |
| JOBS | analysis | completed | 49 | 5077 | 5028 | 0.00032 | Found 6 job records and multiple design opportunities matching the user's focus. |

Merge: confidence 0.7, conflicts 0, failed none, facts 6, findings 8, dupes removed 0, missing 4 · next actions: Which of these jobs fit me?; Close my top skill gap; Add your missing details

### t2-fit#1 MULTI_AGENT — level 2, state completed, wall 13695 ms, answer-start 5634 ms, aux $0.00091
Understood: Your question about UX designer needs profile, jobs and skills checks. · classifier rules · parallel: PROFILE, SKILLS, JOBS

| Agent | Exec | Status | Start | End | Duration | $ | Summary |
|---|---|---|---|---|---|---|---|
| PROFILE | analysis | completed | 21 | 2792 | 2771 | 0.00012 | Found user profile with cafe supervisor experience and self-taught Figma skills. |
| SKILLS | analysis | completed | 2792 | 5195 | 2403 | 0.00031 | Found user profile with cafe supervisor experience and self-taught Figma skills alongside UX job requirements. |
| JOBS | analysis | completed | 22 | 5633 | 5611 | 0.00035 | Found 6 job records and 6 adjacent role types relating to UX design. |

Merge: confidence 0.63, conflicts 0, failed none, facts 5, findings 5, dupes removed 2, missing 5 · next actions: Which of these jobs fit me?; Close my top skill gap; Add your missing details

### t3-pathway#1 MA_COMPOSER_MEDIUM — level 3, state completed, wall 17782 ms, answer-start 7659 ms, aux $0.00163
Understood: Your question about UX design needs profile, jobs, skills, market, learning and pathway checks. · classifier rules · parallel: PROFILE, MARKET, LEARNING, SKILLS, JOBS, PATHWAY

| Agent | Exec | Status | Start | End | Duration | $ | Summary |
|---|---|---|---|---|---|---|---|
| PROFILE | analysis | completed | 56 | 2766 | 2710 | 0.00009 | Found 1 user statement regarding career transition. |
| MARKET | analysis | completed | 57 | 5726 | 5668 | 0.00016 | Found no specific UX design market records or trends in the available evidence. |
| LEARNING | analysis | completed | 57 | 6328 | 6271 | 0.00028 | Found 4 single subjects and 2 bachelor degrees for UX design. |
| SKILLS | analysis | completed | 2766 | 6386 | 3620 | 0.00025 | Found UX design units and requirements, showing critical skill gaps for the user. |
| JOBS | analysis | completed | 57 | 6468 | 6411 | 0.00025 | Found 0 job records and 6 adjacent role types for design careers. |
| PATHWAY | analysis | completed | 2766 | 7656 | 4890 | 0.00046 | Found pathways to UX design using short courses and accredited qualifications from the evidence catalogue. |

Merge: confidence 0.49, conflicts 0, failed none, facts 6, findings 7, dupes removed 2, missing 8 · next actions: Compare UX short courses; Build this pathway; Close my top skill gap; Add your missing details

### t3-pathway#1 MULTI_AGENT — level 3, state completed, wall 15699 ms, answer-start 8011 ms, aux $0.00171
Understood: Your question about UX design needs profile, jobs, skills, market, learning and pathway checks. · classifier rules · parallel: PROFILE, MARKET, SKILLS, JOBS, LEARNING, PATHWAY

| Agent | Exec | Status | Start | End | Duration | $ | Summary |
|---|---|---|---|---|---|---|---|
| PROFILE | analysis | completed | 40 | 2787 | 2747 | 0.00009 | Found user statement expressing desire to transition from hospitality to UX design. |
| MARKET | analysis | completed | 40 | 6220 | 6180 | 0.00024 | No direct UX design vacancy records or demand projections were found in the provided evidence. |
| SKILLS | analysis | completed | 2787 | 6830 | 4043 | 0.00025 | Found UX design units and career requirements to evaluate the transition from hospitality. |
| JOBS | analysis | completed | 40 | 6892 | 6852 | 0.00024 | Found 0 job records and 6 adjacent role types for design career exploration. |
| LEARNING | analysis | completed | 40 | 7185 | 7144 | 0.00034 | Found UX design learning options including skill sets, units, and postgraduate certificates. |
| PATHWAY | analysis | completed | 2788 | 8009 | 5221 | 0.00040 | Found UX design qualifications and short courses to transition from hospitality. |

Merge: confidence 0.48, conflicts 0, failed none, facts 8, findings 8, dupes removed 2, missing 8 · next actions: Compare UX courses; Build this pathway; Close my top skill gap; Add your missing details

### t4-company#1 MA_COMPOSER_MEDIUM — level 3, state completed, wall 19371 ms, answer-start 4127 ms, aux $0.00100
Understood: Your question about product needs profile, jobs, company, skills and learning checks. · classifier rules · parallel: COMPANY, JOBS, SKILLS, LEARNING

| Agent | Exec | Status | Start | End | Duration | $ | Summary |
|---|---|---|---|---|---|---|---|
| PROFILE | analysis | completed | 31 | 31 | 0 | 0.00000 | No saved profile details yet, so I am working from this message only |
| COMPANY | analysis | completed | 31 | 1807 | 1776 | 0.00000 | No records naming Canva in Yuzee's data |
| JOBS | analysis | completed | 31 | 3859 | 3828 | 0.00029 | Found product and production management roles and requirements from current evidence. |
| SKILLS | analysis | completed | 31 | 3914 | 3883 | 0.00031 | Found product and production management requirements to identify skill gaps. |
| LEARNING | analysis | completed | 31 | 4124 | 4093 | 0.00026 | Found 3 course options and 3 competency units for product management skills. |

Merge: confidence 0.42, conflicts 0, failed none, facts 6, findings 6, dupes removed 0, missing 8 · next actions: Compare learning options; Which of these jobs fit me?; Close my top skill gap; Add your missing details

### t4-company#1 MULTI_AGENT — level 3, state completed, wall 14134 ms, answer-start 4959 ms, aux $0.00100
Understood: Your question about product needs profile, jobs, company, skills and learning checks. · classifier rules · parallel: PROFILE, COMPANY, SKILLS, JOBS, LEARNING

| Agent | Exec | Status | Start | End | Duration | $ | Summary |
|---|---|---|---|---|---|---|---|
| PROFILE | analysis | completed | 34 | 35 | 0 | 0.00000 | No saved profile details yet, so I am working from this message only |
| COMPANY | analysis | completed | 34 | 2317 | 2283 | 0.00000 | No records naming Canva in Yuzee's data |
| SKILLS | analysis | completed | 35 | 4252 | 4217 | 0.00027 | Found product and production management roles with required skills for comparison against the profile. |
| JOBS | analysis | completed | 34 | 4607 | 4573 | 0.00032 | Found product and production management job records, but no specific listings or data for Canva. |
| LEARNING | analysis | completed | 34 | 4958 | 4924 | 0.00027 | Found 3 learning options and 3 competency units related to product management skills. |

Merge: confidence 0.41, conflicts 0, failed none, facts 4, findings 4, dupes removed 0, missing 8 · next actions: Compare learning options; Close my top skill gap; Add your missing details

### t5-discovery#1 MA_COMPOSER_MEDIUM — level 2, state completed, wall 15122 ms, answer-start 4208 ms, aux $0.00065
Understood: Your question about teaching assistant needs profile, jobs and opportunities checks. · classifier rules · parallel: JOBS, OPPORTUNITY

| Agent | Exec | Status | Start | End | Duration | $ | Summary |
|---|---|---|---|---|---|---|---|
| PROFILE | analysis | completed | 51 | 52 | 1 | 0.00000 | No saved profile details yet, so I am working from this message only |
| JOBS | analysis | completed | 52 | 4186 | 4134 | 0.00025 | Found 0 job records and 5 adjacent role types for teaching assistant roles. |
| OPPORTUNITY | analysis | completed | 53 | 4206 | 4153 | 0.00028 | Found 1 matching teaching assistant role and 4 adjacent training qualifications in education. |

Merge: confidence 0.5, conflicts 0, failed none, facts 5, findings 5, dupes removed 0, missing 8 · next actions: Explore Graduate Teaching Assistant; Add your missing details

### t5-discovery#1 MULTI_AGENT — level 2, state completed, wall 13411 ms, answer-start 3458 ms, aux $0.00057
Understood: Your question about teaching assistant needs profile, jobs and opportunities checks. · classifier rules · parallel: JOBS, OPPORTUNITY

| Agent | Exec | Status | Start | End | Duration | $ | Summary |
|---|---|---|---|---|---|---|---|
| PROFILE | analysis | completed | 16 | 16 | 0 | 0.00000 | No saved profile details yet, so I am working from this message only |
| JOBS | analysis | completed | 16 | 3382 | 3366 | 0.00021 | Found 0 job records and 5 adjacent role types for teaching assistant. |
| OPPORTUNITY | analysis | completed | 16 | 3456 | 3440 | 0.00024 | Found 1 matching graduate teaching assistant role and related qualifications. |

Merge: confidence 0.47, conflicts 0, failed none, facts 4, findings 4, dupes removed 0, missing 6 · next actions: Explore Graduate Teaching Assistant; Add your missing details

### t7-missing#1 MA_COMPOSER_MEDIUM — level 2, state completed, wall 9719 ms, answer-start 3581 ms, aux $0.00051
Understood: Your question needs profile, jobs and opportunities checks. · classifier rules · parallel: PROFILE, JOBS, OPPORTUNITY

| Agent | Exec | Status | Start | End | Duration | $ | Summary |
|---|---|---|---|---|---|---|---|
| PROFILE | analysis | completed | 20 | 21 | 1 | 0.00000 | No saved profile details yet, so I am working from this message only |
| JOBS | analysis | completed | 20 | 3108 | 3088 | 0.00019 | Found no job records or target roles in the user profile. |
| OPPORTUNITY | analysis | completed | 22 | 3579 | 3557 | 0.00020 | Found 5 potential occupations and missing user profile data. |

Merge: confidence 0.23, conflicts 0, failed none, facts 2, findings 2, dupes removed 0, missing 5 · next actions: Explore Credit Checker; Add your missing details

### t7-missing#1 MULTI_AGENT — level 2, state completed, wall 11591 ms, answer-start 3696 ms, aux $0.00047
Understood: Your question needs profile, jobs and opportunities checks. · classifier rules · parallel: PROFILE, OPPORTUNITY, JOBS

| Agent | Exec | Status | Start | End | Duration | $ | Summary |
|---|---|---|---|---|---|---|---|
| PROFILE | analysis | completed | 52 | 53 | 1 | 0.00000 | No saved profile details yet, so I am working from this message only |
| OPPORTUNITY | analysis | completed | 53 | 3661 | 3608 | 0.00020 | Found 5 potential occupations since no specific user profile details were provided. |
| JOBS | analysis | completed | 52 | 3695 | 3643 | 0.00016 | Found no job records or target roles matching the user's request. |

Merge: confidence 0.2, conflicts 0, failed none, facts 2, findings 2, dupes removed 0, missing 5 · next actions: Explore Credit Checker; Add your missing details

### s4-change#1 MA_COMPOSER_MEDIUM — level 3, state completed, wall 21950 ms, answer-start 7845 ms, aux $0.00190
Understood: Your question needs profile, jobs, skills, market, learning and pathway checks. · classifier rules · parallel: PROFILE, JOBS, SKILLS, MARKET, LEARNING, PATHWAY

| Agent | Exec | Status | Start | End | Duration | $ | Summary |
|---|---|---|---|---|---|---|---|
| PROFILE | analysis | completed | 45 | 1610 | 1565 | 0.00010 | Found 1 user profile statement detailing 20 years of retail management experience. |
| JOBS | analysis | completed | 45 | 7047 | 7002 | 0.00025 | Found 3 HR occupation profiles and 2 adjacent management roles with strong projected growth. |
| SKILLS | analysis | completed | 1610 | 7055 | 5445 | 0.00031 | Found 20 years of retail management experience mapped to human resources roles and competencies. |
| MARKET | analysis | completed | 45 | 7381 | 7336 | 0.00033 | National employment projections show positive 5-year growth across human resource management and professional roles. |
| LEARNING | analysis | completed | 45 | 7447 | 7402 | 0.00034 | Found 5 HR courses and 1 retail management skill set matching the transition goal. |
| PATHWAY | analysis | completed | 1610 | 7843 | 6233 | 0.00042 | Found multiple HR qualifications and roles leveraging your retail management background. |

Merge: confidence 0.74, conflicts 0, failed none, facts 10, findings 13, dupes removed 2, missing 8 · next actions: Compare HR qualifications; Build this pathway; Close my top skill gap; Add your missing details

### s4-change#1 MULTI_AGENT — level 3, state completed, wall 17202 ms, answer-start 7122 ms, aux $0.00188
Understood: Your question needs profile, jobs, skills, market, learning and pathway checks. · classifier rules · parallel: PROFILE, JOBS, SKILLS, LEARNING, MARKET, PATHWAY

| Agent | Exec | Status | Start | End | Duration | $ | Summary |
|---|---|---|---|---|---|---|---|
| PROFILE | analysis | completed | 65 | 1803 | 1738 | 0.00010 | Found 1 user profile statement detailing 20 years of retail management experience. |
| JOBS | analysis | completed | 66 | 6119 | 6052 | 0.00025 | Found multiple human resources roles and occupations suitable for exploring a career transition. |
| SKILLS | analysis | completed | 1803 | 6254 | 4451 | 0.00029 | Found 20 years of retail management experience and multiple recurring HR requirements. |
| LEARNING | analysis | completed | 66 | 6515 | 6449 | 0.00033 | Found HR qualifications and relevant skill sets suited to retail management experience. |
| MARKET | analysis | completed | 66 | 6874 | 6808 | 0.00034 | Found national employment projections for human resource managers, professionals, and clerks. |
| PATHWAY | analysis | completed | 1803 | 7121 | 5318 | 0.00042 | Found 3 career paths, 2 qualifications, and strong employment growth projections for human resources. |

Merge: confidence 0.73, conflicts 0, failed none, facts 11, findings 12, dupes removed 1, missing 8 · next actions: Compare HR Courses; Build this pathway; Close my top skill gap; Add your missing details

### m1-multi#2 MA_COMPOSER_MEDIUM — level 3, state completed, wall 17553 ms, answer-start 4386 ms, aux $0.00154
Understood: Your question about with regular business hours needs profile, jobs, skills, market, learning and pathway checks. · classifier rules · parallel: PROFILE, MARKET, SKILLS, JOBS, LEARNING, PATHWAY

| Agent | Exec | Status | Start | End | Duration | $ | Summary |
|---|---|---|---|---|---|---|---|
| PROFILE | analysis | completed | 7 | 1777 | 1770 | 0.00012 | Found registered nurse profile indicating shift work burnout. |
| MARKET | analysis | completed | 7 | 3564 | 3557 | 0.00020 | Found national employment projections for health and welfare services managers with positive growth. |
| SKILLS | analysis | completed | 1777 | 3860 | 2083 | 0.00023 | Found nursing background and management requirements for business hour healthcare roles. |
| JOBS | analysis | completed | 7 | 3883 | 3876 | 0.00022 | Found 6 occupation profiles and related management roles in healthcare administration. |
| LEARNING | analysis | completed | 7 | 3968 | 3961 | 0.00029 | Found postgraduate healthcare management and administration courses suitable for regular business hours. |
| PATHWAY | analysis | completed | 1777 | 4385 | 2608 | 0.00033 | Found management and community service roles and relevant short courses. |

Merge: confidence 0.7, conflicts 0, failed none, facts 10, findings 10, dupes removed 0, missing 8 · next actions: Explore management roles; Compare learning options; Close my top skill gap; Add your missing details

### m1-multi#2 MULTI_AGENT — level 3, state completed, wall 13566 ms, answer-start 4719 ms, aux $0.00161
Understood: Your question about with regular business hours needs profile, jobs, skills, market, learning and pathway checks. · classifier rules · parallel: PROFILE, MARKET, JOBS, SKILLS, PATHWAY, LEARNING

| Agent | Exec | Status | Start | End | Duration | $ | Summary |
|---|---|---|---|---|---|---|---|
| PROFILE | analysis | completed | 6 | 1863 | 1857 | 0.00010 | Found 1 nursing profile record regarding shift work burnout in Brisbane. |
| MARKET | analysis | completed | 7 | 3755 | 3748 | 0.00019 | Found six general occupation profiles with no specific vacancy or salary data available. |
| JOBS | analysis | completed | 7 | 4228 | 4221 | 0.00026 | Found 6 occupation records with no direct job vacancies listed in the evidence. |
| SKILLS | analysis | completed | 1863 | 4254 | 2391 | 0.00023 | Found 1 nursing profile and 1 adjacent office role requiring healthcare knowledge. |
| PATHWAY | analysis | completed | 1863 | 4703 | 2840 | 0.00032 | Found registered nurse profile and healthcare learning options for exploring business hours alternatives. |
| LEARNING | analysis | completed | 7 | 4718 | 4711 | 0.00037 | Found multiple health and community services qualifications and units linked to various providers. |

Merge: confidence 0.53, conflicts 0, failed none, facts 13, findings 13, dupes removed 1, missing 8 · next actions: Build community health pathway; Compare learning options; Close my top skill gap; Add your missing details

**Total Gemini cost for this collection: $0.0572** (16 turns; main + auxiliary).