/**
 * EXP-RAG guidance manifest.
 *
 * PARTITION is an ordered, exhaustive split of the v1.11 counsellor prompt. Each entry starts a
 * region at the first line (after the previous region) that begins with `anchor`; the region runs
 * to the next entry. Every region is assigned to the cached core prompt, to one or more retrievable
 * modules, or to both. scripts/build-rag-guidance.ts extracts module text verbatim from the source,
 * so retrieved rules are never paraphrased, and fails the build if an anchor drifts.
 *
 * 'core'  = carried by src/rag/guidance/core-prompt.md (condensed or verbatim).
 * 'meta'  = YAML/module metadata with no behavioural content.
 */
export type Trigger =
  | 'firstTurn' | 'shortReply' | 'correction' | 'overwhelm' | 'returning' | 'compare'
  | 'serviceIntent' | 'activeHandoff' | 'draft' | 'jurisdiction' | 'cost' | 'university'
  | 'studyLoad' | 'returnToWork' | 'courseQuality' | 'warehouse' | 'rtoComparison' | 'local'
  | 'localFigures' | 'skillsJobs' | 'workspace' | 'research' | 'offTopic' | 'yuzeeServices' | 'format' | 'statedPlace' | 'nearbyProviders' | 'placeUnsure' | 'experience';

export interface ModuleSpec {
  title: string;
  /** 'core-module' = original v1.x module; 'application' = later application clarification (higher precedence). */
  layer: 'core-module' | 'application';
  /** Higher wins when the guidance budget is tight. 1..5 */
  priority: number;
  /** 'evidence' modules govern how retrieved records are used and draw on a separate budget. */
  family?: 'evidence';
  triggers?: Trigger[];
  /** Retrieval key: the situations this module governs, written the way the need shows up in a conversation. */
  when: string;
  /** Representative user turns. Each is embedded separately (multi-vector max-sim). */
  examples: string[];
}

type Assign = 'core' | 'meta' | string | string[];
export const PARTITION: Array<[anchor: string, assign: Assign]> = [
  ['# Yuzee Quiz Counsellor & Training v1.11', 'meta'],
  ['<SNIPPET id="11_SECURITY_CORE">', 'core'],
  ['---', 'meta'],
  ['<SNIPPET id="00_MASTER_CORE">', 'core'],
  ['---', 'meta'],
  ['<SNIPPET id="01_USER_STATE">', 'core'],
  ['---', 'meta'],
  ['<SNIPPET id="01B_CONVERSATION_STATE">', 'core'],
  ['---', 'meta'],
  ['<SNIPPET id="01C_DOMAIN_SCOPE_GATE">', 'core'],
  ['B. ADJACENT_CONTEXT', ['core', 'scope.adjacent-unrelated']],
  ['---', 'meta'],
  ['<SNIPPET id="02_COUNSELLOR_ENGINE">', ['core', 'counsel.engine']],
  ['---', 'meta'],
  ['<SNIPPET id="02B_CONVERSATION_CONTROLLER">', 'core'],
  ['---', 'meta'],
  ['<SNIPPET id="02C_COUNSELLOR_UNDERSTANDING_ENGINE">', ['core', 'understanding.topic-map']],
  ['D. UNDERSTANDING SCORE', ['core', 'understanding.scores']],
  ['SERVICE TIMING — TWO PATHS', 'core'],
  ['I. SCORE STABILITY', ['core', 'understanding.scores']],
  ['---', 'meta'],
  ['<SNIPPET id="03_RMO_ROUTER">', ['core', 'rmo.routing']],
  ['---', 'meta'],
  ['<SNIPPET id="03B_RMO_STATE_MANAGER">', 'rmo.routing'],
  ['---', 'meta'],
  ['<SNIPPET id="04A_PATHWAY_CORE">', 'pathway.route-design'],
  ['---', 'meta'],
  ['<SNIPPET id="04B_CONVERSATION_GUIDANCE_ENGINE">', 'meta'],
  ['<04D_HUMAN_COUNSELLOR_VOICE>', ['core', 'voice.counsellor']],
  ['</04D_HUMAN_COUNSELLOR_VOICE>', 'meta'],
  ['PURPOSE', 'guide.orientation'],
  ['A. TURN PROGRESSION — HARD', 'core'],
  ['B. USER ORIENTATION CONTRACT — HARD', 'guide.orientation'],
  ['C. PATHWAY CHANGE COMMUNICATION — HARD', 'guide.change-correction'],
  ['D. CURRENT VS NEXT — HARD', 'guide.current-next'],
  ['F. COGNITIVE LOAD / OVERWHELM RULE', 'guide.overwhelm'],
  ['G. WAITING AND NO-ACTION STATES', 'guide.waiting-parallel'],
  ['I. COMPLETION AND TRANSITION', 'guide.completion-return'],
  ['K. CORRECTION / CONVERSATION REPAIR', 'guide.change-correction'],
  ['L. CONVERSATION CHECKPOINTS', 'guide.checkpoints-style'],
  ['N. TURN COMPLETION CHECK — HARD', ['core', 'guide.checkpoints-style']],
  ['---', 'meta'],
  ['<SNIPPET id="05A_SERVICE_ROUTER">', 'service.router'],
  ['---', 'meta'],
  ['<SNIPPET id="05B_SERVICE_REGISTRY">', 'service.registry'],
  ['---', 'meta'],
  ['<SNIPPET id="05C_YUZEE_ACTION_LAYER">', 'service.action-layer'],
  ['---', 'meta'],
  ['<SNIPPET id="05D_PROVIDER_AND_LOCAL_GATE">', ['core', 'provider.local-gate']],
  ['JURISDICTION-SENSITIVE FACTS — HARD', ['core', 'jurisdiction.facts']],
  ['04C_UNIVERSAL_GUIDANCE_AND_TEACHING', 'core'],
  ['## TEACHING DEPTH CONTROLLER — HARD', 'teach.depth-presentation'],
  ['### COMPARE QUALITY CONTRACT', 'compare.two-route'],
  ['## STATE-BASED USER VARIABILITY', 'teach.depth-presentation'],
  ['<YUZEE_UNIVERSAL_GUIDANCE_HARD_RULES_V1>', 'compare.two-route'],
  ['2. TEACH THE GAP, NOT THE TOPIC', 'teach.gap-first-turn'],
  ['4. TWO-ROUTE COMPARISON RULE', 'compare.two-route'],
  ['5. FRAMEWORK COHERENCE', 'framework.peer-status'],
  ['6. USER CONFIDENCE DETERMINISM', 'core'],
  ['8. JURISDICTION-SENSITIVE FACT GATE', 'jurisdiction.facts'],
  ['10. DISCOVERY QUESTION QUALITY', 'questions.discovery-quality'],
  ['11. CAREER CHANGE RULE', 'routes.change-options'],
  ['13. PRESENTATION GRAMMAR', 'core'],
  ['15. PRE-OUTPUT HARD CHECK', ['core', 'quality.validator']],
  ['USER IS OVERWHELMED', ['guide.overwhelm', 'visual.counselling']],
  ['USER HAS MISUNDERSTOOD SOMETHING', 'visual.counselling'],
  ['---', 'meta'],
  ['<SNIPPET id="07_RESPONSE_PLANNER">', 'planner.styles'],
  ['<YUZEE_FRAMEWORK_COHERENCE_V2>', 'framework.layers-a'],
  ['LAYER 6 — EMPLOYMENT / TRAINING ARRANGEMENT', 'framework.layers-b'],
  ['PEER OPTION RULE — HARD', 'framework.peer-status'],
  ['EDUCATION ROUTE RULE', 'framework.route-rules'],
  ['PRE-OUTPUT FRAMEWORK CHECK', 'framework.peer-status'],
  ['EARLY UNIVERSITY EXPLORATION — CONTENT QUALITY RULE', 'university.exploration-claims'],
  ['Choose one INTERNAL planner intent:', 'core'],
  ['OFF_TOPIC_REDIRECT', 'planner.styles'],
  ['WORDING / CLAIM PRECISION', 'university.exploration-claims'],
  ['ALTERNATIVES', 'planner.styles'],
  ['---', 'meta'],
  ['<SNIPPET id="07B_EXPERIENCE_GATE">', ['core', 'presentation.density']],
  ['---', 'meta'],
  ['<SNIPPET id="10_VALIDATOR">', 'quality.validator'],
  ['PROTOCOL v1.3 - HARD', 'core'],
  ['CONVERSATION GUIDANCE VALIDATION — HARD', 'quality.validator'],
  ['---', 'meta'],
  ['<SNIPPET id="01C_CONNECTED_CONTEXT_AND_QUESTION_OWNER">', 'connected.question-owner'],
  ['Connected capabilities come from application state.', 'connected.capabilities'],
  ['<SNIPPET id="01D_CONNECTED_COURSE_CATALOGUE">', 'warehouse.connected-guidance'],
  ['LOCAL CONTEXT', 'warehouse.local-quality-funding'],
  ['## Hidden activity routing context (state.activity_context)', 'core'],
  ['<APPLICATION_EXPERIENCE_RULES version="1.0">', 'app.scannable-presentation'],
  ['AUDIENCE AND PLAIN LANGUAGE', ['core', 'app.audience-teaching']],
  ['SHORT REPLIES AND CONTINUITY', ['core', 'app.short-replies']],
  ['EXPLAINING COURSE AND TRAINING QUALITY', 'app.course-quality'],
  ['SITUATIONS AND GOALS', 'app.situations'],
  ['ADVICE, EVIDENCE AND QUESTIONS', 'app.advice-evidence-questions'],
  ['TYPED LOCATION AND REQUEST DRAFTS', 'app.location-drafts'],
  ['BEFORE EMITTING', ['core', 'app.location-drafts']],
  ['<FINAL_WORDING_CHECK>', 'app.wording-acceptance'],
  ['<EARLY_EXPLORATION_CHECK>', 'app.early-exploration-low-effort'],
  ['<EDITING_A_DRAFT>', 'app.location-drafts'],
  ['<CONVERSATIONAL_FOLLOWUP>', 'app.followup-scope'],
  ['<COUNSELLING_ACCEPTANCE_EXAMPLES>', 'app.study-load-examples'],
  ['<LEARNING_AND_DECISION_VALUE version="1.0">', 'teach.learning-value'],
  ['<COURSE_TEACHING_GROUNDING_EXAMPLES>', 'teach.course-grounding'],
  ['<MEANINGFUL_VISUAL_STRUCTURE version="1.1">', ['core', 'presentation.visual-structure']],
  ['<STRUCTURED_TEACHING_CONTRACT version="4.0">', ['core', 'teach.contract']],
  ['OPTIONAL TOPIC INGREDIENTS', ['teach.req.skill', 'teach.req.course', 'teach.req.comparison', 'teach.req.requirements', 'teach.req.cost', 'teach.req.role', 'teach.req.skill-map', 'teach.req.plan', 'teach.req.market', 'teach.req.organisation', 'teach.req.opportunity', 'teach.req.evidence', 'teach.req.navigation']],
  ['SKILL REQUESTS', 'teach.req.skill'],
  ['COURSE REQUESTS', 'teach.req.course'],
  ['COMPARISON REQUESTS', 'teach.req.comparison'],
  ['REQUIREMENTS REQUESTS', 'teach.req.requirements'],
  ['COST REQUESTS', 'teach.req.cost'],
  ['ROLE REQUESTS', 'teach.req.role'],
  ['SKILL_MAP REQUESTS', 'teach.req.skill-map'],
  ['PLAN REQUESTS', 'teach.req.plan'],
  ['MARKET REQUESTS', 'teach.req.market'],
  ['ORGANISATION REQUESTS', 'teach.req.organisation'],
  ['OPPORTUNITY REQUESTS', 'teach.req.opportunity'],
  ['EVIDENCE REQUESTS', 'teach.req.evidence'],
  ['NAVIGATION REQUESTS', 'teach.req.navigation'],
  ['</STRUCTURED_TEACHING_CONTRACT>', 'meta'],
  ['<FINAL_TEACHING_EVIDENCE_CHECK>', 'teach.completion-evidence'],
  ['<SNIPPET id="01E_RTO_COURSE_COMPARISON">', 'warehouse.rto-comparison'],
  ['<SNIPPET id="01F_LOCAL_EXPLORATION">', 'local.first-steps'],
  ['When the user actually asks about jobs, numbers, demand', 'local.figures-scope'],
  ['<SNIPPET id="08_SEMANTIC_JSON_RENDERER">', 'core'],
  ['HANDOFF', ['core', 'protocol.service-handoff']],
  ['STATE CONTRACT', 'core'],
  ['---', 'meta'],
  ['<SNIPPET id="09_RESPONSE_PROTOCOL_V1_3">', 'core'],
  ['FINAL TASK', 'core'],
];

export const MODULES: Record<string, ModuleSpec> = {
  'scope.adjacent-unrelated': {
    title: 'Adjacent context, unrelated questions and mixed requests', layer: 'core-module', priority: 3, triggers: ['offTopic'],
    when: 'The user asks about a company, product, brand, car, sport, recipe, celebrity or general trivia; asks what a company does; mixes an off-topic question with a career question; or names a company while thinking about working there.',
    examples: ['What is Coca-Cola?', 'How fast is a Subaru WRX?', 'What does Atlassian do? I might want to work there', 'Tell me a fun fact about space', 'What is cloud computing? I am thinking about a cloud career'],
  },
  'counsel.engine': {
    title: 'Counsellor engine: goals, gaps, routes, RPL, experience and income', layer: 'core-module', priority: 3,
    when: 'Working out the strongest realistic route from the user\'s current position to a target career or study goal: goal type, current-to-target gap, route options, recommending versus preserving options, pathway detail, RPL, lack of experience, needing income, comparing roles.',
    examples: ['How do I become an electrician from where I am now?', 'I have worked in retail for 5 years, what are my options to move into IT?', 'Should I do a course or try to get a job first?', 'I need to keep earning while I retrain', 'Can my experience count towards a qualification?'],
  },
  'understanding.topic-map': {
    title: 'Understanding engine: topic map, status scale and evidence standard', layer: 'core-module', priority: 2,
    when: 'Judging whether the user has really understood the decision: the user agrees, says yes or sounds good, explains a trade-off in their own words, applies advice to their situation, or the conversation is moving toward a decision or a Yuzee service.',
    examples: ['Yes that sounds good', 'So the apprenticeship pays me while I learn but takes longer, which suits me because I need income', 'Ok I get it now', 'I think I understand the difference', 'That makes sense, what next?'],
  },
  'understanding.scores': {
    title: 'Understanding and counsellor confidence scores, readiness steps and score stability', layer: 'core-module', priority: 2,
    when: 'Deciding readiness to move from counselling to planning or a service offer, after several turns of discussion, when the user seems ready to act or when contradictions lower readiness.',
    examples: ['I am ready to start, what do I do?', 'Can you help me take the next step?', 'I have decided on nursing', 'Actually I am not sure anymore', 'Let us make a plan'],
  },
  'rmo.routing': {
    title: 'RMO routing principles and RMO/service state manager', layer: 'core-module', priority: 3, triggers: ['serviceIntent', 'activeHandoff'],
    when: 'Classifying which Yuzee service or RMO fits: course offers, job matching, apprenticeship versus traineeship, internship versus required placement, graduate program versus graduate job, RPL, Earn and Learn, better-paying job; moving between guidance, soft offer, scoping, ready and execution states.',
    examples: ['Can Yuzee find me an apprenticeship?', 'I just graduated and want a job', 'I want to join a graduate program', 'Find me a course offer', 'I need a required placement for my nursing course'],
  },
  'pathway.route-design': {
    title: 'Pathway core: qualification types, AQF levels, route design and education gate', layer: 'core-module', priority: 4,
    when: 'Explaining or choosing study and training routes: qualification levels, certificate versus diploma versus degree, AQF, licences and certifications, short courses and microcredentials, whether formal study is needed, employability and practical proof, duration and difficulty, degree accreditation and transfer claims.',
    examples: ['What is the difference between a Certificate IV and a Diploma?', 'Do I need a degree to become a data analyst?', 'Is a short course enough to get into web development?', 'Which qualification level should I start at?', 'Is a computer science degree accredited?'],
  },
  'voice.counsellor': {
    title: 'Human counsellor voice with examples', layer: 'core-module', priority: 2, triggers: ['firstTurn'],
    when: 'Opening a counselling conversation about a career interest or goal; making the answer sound like a person speaking rather than an encyclopedia, report or intake form; plain-language rewriting; question tone.',
    examples: ['I want to become a plumber', 'I am thinking about nursing', 'I like computers, what jobs are there?', 'I want to work with animals', 'What should I do after school?'],
  },
  'guide.orientation': {
    title: 'Conversation guidance purpose and user orientation contract', layer: 'core-module', priority: 2,
    when: 'The user may be unsure where they are in the journey, what changed, what matters now, whether they need to do anything, or what happens next; making current, next, later, alternative, parallel and completed items clear.',
    examples: ['Where am I up to?', 'What do I actually need to do now?', 'Has anything changed?', 'So what happens next?', 'Is this my plan now or just an option?'],
  },
  'guide.change-correction': {
    title: 'Pathway change communication and correction / conversation repair', layer: 'core-module', priority: 4, triggers: ['correction'],
    when: 'New evidence changes or might seem to change the pathway; the user corrects a wrong assumption Oala made; contradicts earlier information; says something was misunderstood.',
    examples: ['Actually I can\'t study full time, I need to work', 'No, I said I don\'t want university', 'That\'s wrong, I already have a Certificate III', 'I did some work experience and loved backend coding', 'You misunderstood me'],
  },
  'guide.current-next': {
    title: 'Current vs next and progressive conversation', layer: 'core-module', priority: 3,
    when: 'Separating the current task from future stages; early exploration that should not reveal the whole pathway at once; the user asks what to do now; pacing how much pathway detail to reveal as understanding grows.',
    examples: ['What am I supposed to do now?', 'Give me the whole roadmap', 'What comes after I finish year 12?', 'I am just starting to think about this', 'Should I worry about university already?'],
  },
  'guide.overwhelm': {
    title: 'Cognitive load and overwhelm rule', layer: 'core-module', priority: 5, triggers: ['overwhelm'],
    when: 'The user signals confusion, overload or inability to follow: too much information, does not understand, feels lost, asks to simplify, repeated misunderstanding.',
    examples: ['This is too much', 'I don\'t understand any of this', 'I\'m confused', 'Can you make it simpler?', 'I feel overwhelmed and lost'],
  },
  'guide.waiting-parallel': {
    title: 'Waiting/no-action states and parallel activities', layer: 'core-module', priority: 3,
    when: 'Progress depends on an external outcome such as an application result, interview, offer or provider response; or two activities happen at the same time such as school plus work experience or study plus a job.',
    examples: ['I applied and I am waiting to hear back', 'I have an interview next week', 'I am doing year 11 and a part-time job', 'I am studying and doing an internship at the same time', 'Nothing has happened yet with my application'],
  },
  'guide.completion-return': {
    title: 'Completion and transition, returning user re-orientation', layer: 'core-module', priority: 3, triggers: ['returning'],
    when: 'A stage, milestone, course, placement or topic is finished; the user returns after a gap or says they are back; capturing what was learned and moving to the next stage.',
    examples: ['I finished my placement', 'I completed the course!', 'I\'m back, it has been a few weeks', 'I got the job', 'I passed my exams, what now?'],
  },
  'guide.checkpoints-style': {
    title: 'Checkpoints, counsellor speaking style and turn completion check', layer: 'core-module', priority: 2,
    when: 'Summarising progress at a major decision point or when several pieces of evidence have accumulated; the user asks for a recap; keeping the speaking style personal and plain.',
    examples: ['Can you summarise what we have worked out?', 'Recap please', 'Where are we at with all this?', 'What do we know so far?', 'Let us review before I decide'],
  },
  'service.router': {
    title: 'Service router: recommendation vs execution, service classification confidence and service claims', layer: 'core-module', priority: 4, triggers: ['serviceIntent', 'activeHandoff', 'yuzeeServices'],
    when: 'The user asks Yuzee to find, start, request or do something; distinguishing informational questions about a service from action intent; service visibility; claims about outcomes, guarantees, submissions or bookings.',
    examples: ['Can you apply for me?', 'Find me jobs in Brisbane', 'How does the course offer service work?', 'Sign me up', 'Will Yuzee get me a job?'],
  },
  'service.registry': {
    title: 'Yuzee product catalogue and canonical semantic mapping', layer: 'core-module', priority: 4, triggers: ['yuzeeServices'],
    when: 'The user asks what Yuzee or Oala can do, which services exist, what a Yuzee service such as Career Pathway, Get a course offer, Jobs, Apprenticeship and Traineeship, Internship, Fresh-grad job, Earn and Learn, Upskilling, RPL or Better-paying job means.',
    examples: ['What can Yuzee help me with?', 'What services do you offer?', 'What is Earn and Learn?', 'What does the RPL service do?', '@Oala how can you help me?'],
  },
  'service.action-layer': {
    title: 'Yuzee action layer and service capability map', layer: 'core-module', priority: 3, triggers: ['serviceIntent', 'activeHandoff'],
    when: 'Turning a well-understood decision into optional Yuzee help; soft offers and action-ready states; what each Yuzee service can actually do.',
    examples: ['Yes, help me find a course offer', 'Can Yuzee help me with RPL?', 'I want help getting a better-paying job', 'Ok let us do the career pathway', 'Can you match me with apprenticeships?'],
  },
  'provider.local-gate': {
    title: 'Provider and local data gate, early-exploration location rule', layer: 'core-module', priority: 4, triggers: ['local', 'nearbyProviders'],
    when: 'The user asks for providers, campuses, nearby courses, intakes, fees, open days or local options; mentions a postcode or city; or location could be wrongly treated as a missing input during early exploration.',
    examples: ['Which TAFEs near me offer nursing?', 'I live in 3000, what courses are close?', 'When is the next intake?', 'Best uni in Sydney for engineering?', 'Are there open days soon?'],
  },
  'jurisdiction.facts': {
    title: 'Jurisdiction-sensitive facts, verification gate and study transfer safety', layer: 'core-module', priority: 5, triggers: ['jurisdiction'],
    when: 'Statements about qualification titles, school-leaving rules, ATAR, VCE, TAFE, RTO, apprenticeship durations, wages, licensing, registration, funding, subsidies, credit transfer, RPL, visas or whether previous study will count.',
    examples: ['Can I leave school after year 10?', 'Does VCE give me an ATAR?', 'Will my diploma credit transfer to a degree?', 'How long is an electrical apprenticeship?', 'Do I need a licence to be a plumber?'],
  },
  'teach.depth-presentation': {
    title: 'Teaching depth controller, presentation grammar, user variability and semantic self-check', layer: 'core-module', priority: 3,
    when: 'Deciding how deeply to explain (explain, illustrate, contrast, apply, extend) and which block type fits; avoiding re-teaching what the user already understands; using golden examples.',
    examples: ['Explain what an apprenticeship is', 'I already know what a diploma is, just tell me the difference', 'Can you give me an example?', 'What does that mean for me?', 'Explain it in more depth'],
  },
  'compare.two-route': {
    title: 'Intent determinism, compare quality contract and two-route comparison rule', layer: 'core-module', priority: 5, triggers: ['compare'],
    when: 'The user cannot decide, is torn between, asks X or Y, wants the differences between two or more live options, or a comparison of routes, careers, courses or qualifications.',
    examples: ['Should I do an apprenticeship or go to uni?', 'Nursing or paramedicine?', 'What is the difference between TAFE and university for IT?', 'I am torn between two courses', 'Compare these two options for me'],
  },
  'teach.gap-first-turn': {
    title: 'Teach the gap and first-turn cognitive load', layer: 'core-module', priority: 4, triggers: ['firstTurn'],
    when: 'Early in a conversation with little evidence about the user; correcting a misconception or false binary before expanding options; avoiding a complete pathway tree or an intake questionnaire on the first response.',
    examples: ['I want to go to university but don\'t know what to study', 'Is it uni or nothing?', 'I have no idea what to do after school', 'Tell me everything about becoming a doctor', 'Help me choose a career'],
  },
  'framework.peer-status': {
    title: 'Framework coherence: peer option rule, combination rule, user-status rule and framework check', layer: 'core-module', priority: 3,
    when: 'Presenting options side by side that might mix different kinds of things (current situation, goal, route, qualification, provider, employment arrangement, outcome, Yuzee service); combined pathways such as school-based apprenticeships; employed or unemployed users.',
    examples: ['What options do I have?', 'Uni, apprenticeship or just work?', 'I am unemployed, what should I do?', 'I have a job but want something better', 'Can I do school and an apprenticeship together?'],
  },
  'questions.discovery-quality': {
    title: 'Discovery question quality', layer: 'core-module', priority: 3,
    when: 'Asking a discovery question about interests, enjoyed subjects, projects or tasks; avoiding category menus and double questions.',
    examples: ['I don\'t know what I like', 'Help me figure out what suits me', 'What careers would fit me?', 'I am not sure what I am interested in', 'Ask me questions to work out my direction'],
  },
  'routes.change-options': {
    title: 'Career change rule and option preservation', layer: 'core-module', priority: 4, triggers: ['returnToWork'],
    when: 'A career changer or experienced worker wants a different field; deciding whether retraining is needed; keeping options alive during exploration and explaining what evidence would change a conclusion.',
    examples: ['I am 35 and want to change careers into tech', 'Do I need to go back to uni to switch careers?', 'I have been an accountant for 10 years and want something new', 'Which of these should I pick?', 'Is it too late to start over?'],
  },
  'visual.counselling': {
    title: 'Visual counselling principle and situation-to-visual mapping', layer: 'core-module', priority: 2,
    when: 'Choosing visual structure for an overwhelmed user, a misunderstanding, a changed direction, something the user must read, two routes, multiple pathways, parallel activity, a capability gap or a complex concept.',
    examples: ['Can you show me visually?', 'Draw it out for me', 'Lay out my options', 'Show the steps', 'Map out the pathway'],
  },
  'planner.styles': {
    title: 'Response planner: decision pack, content blueprint, planner intent styles and next action', layer: 'core-module', priority: 2,
    when: 'Planning the shape of a response: direct answer, pathway guidance, comparison, exploration with 2-4 live options, clarification, service explanation, counselling flow; explanatory frameworks versus answer options; alternatives and one next action.',
    examples: ['Just answer the question', 'Give me a plan', 'What are my options?', 'Explain how Yuzee works', 'What should I do first?'],
  },
  'framework.layers-a': {
    title: 'Framework layers 1-5: life state, goal, route, program, provider', layer: 'core-module', priority: 2,
    when: 'Distinguishing who the user is now from their goal, the route, the education program and the provider; university versus degree versus career outcome.',
    examples: ['Is university a career?', 'I want a degree to get a job', 'Is TAFE a qualification?', 'What is the difference between a course and a pathway?', 'I am a year 12 student, what route?'],
  },
  'framework.layers-b': {
    title: 'Framework layers 6-10: employment/training arrangements, experience, job outcomes, Yuzee services, criteria', layer: 'core-module', priority: 2,
    when: 'Apprenticeships, traineeships, internships, placements, graduate programs and employment arrangements; experience-building such as volunteering and portfolios; job outcomes versus training; Yuzee services versus real routes; decision criteria.',
    examples: ['Is an internship a job?', 'Is an apprenticeship a course or a job?', 'Does volunteering count as experience?', 'What is a graduate program?', 'Salary matters most to me'],
  },
  'framework.route-rules': {
    title: 'Education, employment, unemployment, Earn and Learn and RMO separation rules', layer: 'core-module', priority: 4,
    when: 'Recommending formal study; an unemployed or job-seeking user; looking for work; earning while learning; deciding whether a Yuzee service is useful versus the real-world route.',
    examples: ['I am unemployed and need a job', 'Should I go back to study?', 'I want to earn while I learn', 'I am looking for work', 'What is Earn and Learn?'],
  },
  'university.exploration-claims': {
    title: 'Early university exploration and wording/claim precision', layer: 'core-module', priority: 4, triggers: ['university'],
    when: 'University is the goal but the field is unclear; claims about degrees, majors, electives, transfers, credit, accreditation, professional registration for nursing, engineering, teaching, physiotherapy or law.',
    examples: ['I want to go to uni but don\'t know what to study', 'Can I change my major later?', 'Is engineering accredited?', 'Do broad degrees let me explore?', 'Will a psychology degree make me a psychologist?'],
  },
  'presentation.density': {
    title: 'Experience gate: presentation density and experience modes', layer: 'core-module', priority: 3, triggers: ['format'],
    when: 'Deciding whether ordinary chat should stay as prose and lists or become a structured report with headings, tables, comparisons and steps; the user asks for a report, table, breakdown or detailed view; Quick, Explain, Explore, Decide or Detail modes.',
    examples: ['Give me a detailed breakdown', 'Can you put it in a table?', 'Just a quick answer please', 'Make it a report', 'Short version'],
  },
  'quality.validator': {
    title: 'Validator: counselling, routing, presentation and conversation-guidance checks', layer: 'core-module', priority: 1,
    when: 'Final checks on route realism, formal study bias, recommendation justification, service timing, provider and jurisdiction claims, presentation density, category preservation and conversation orientation.',
    examples: ['Is this the right route for me?', 'Are you sure about that?', 'Double check that', 'Is that true everywhere?', 'Are there other options?'],
  },
  'connected.question-owner': {
    title: 'Connected context, shared user contributions, workspace question owner and score meanings', layer: 'core-module', priority: 5, triggers: ['workspace'], family: 'evidence',
    when: 'A right-side workspace activity is visible or saved; shared conversation context with workspace answers or corrections; deciding whether chat or the workspace owns the next question; distinguishing user confidence, decision readiness, evidence status and retrieval relevance.',
    examples: ['I answered the questions on the right', 'I filled in the workspace', 'I changed my answer in the activity', 'The comparison on the side updated', 'What did the activity find?'],
  },
  'connected.capabilities': {
    title: 'Connected capabilities, details-in-use and conversational quality check', layer: 'core-module', priority: 3, triggers: ['workspace'], family: 'evidence',
    when: 'Using connected capabilities such as warehouse data, workspace results and research evidence; not claiming saves, searches or lookups that did not happen; one piece of information per question; no unsupported numeric defaults for hours, loads or durations.',
    examples: ['Did you save that?', 'Can you look this up?', 'How many hours a week is study?', 'How long are graduate programs?', 'What does my degree prove I can do?'],
  },
  'warehouse.connected-guidance': {
    title: 'Connected course catalogue: connected guidance and skills, work and learning evidence', layer: 'core-module', priority: 5, triggers: ['warehouse', 'skillsJobs'], family: 'evidence',
    when: 'Warehouse records are supplied: courses, course intelligence, mapped careers, industries, occupational skills, public job advertisement records, qualification skill and unit links; jobs I could do from my skills; what to learn; HAVE, LEARN and UNSURE skill choices.',
    examples: ['What jobs could I do with my skills?', 'What should I learn to become a data analyst?', 'Which courses teach welding?', 'What careers does this course lead to?', 'Are there jobs for this in my area?'],
  },
  'warehouse.local-quality-funding': {
    title: 'Connected course catalogue: local context, course quality comparison, missing information, funding and workspace', layer: 'core-module', priority: 5, triggers: ['warehouse'], family: 'evidence',
    when: 'Warehouse records include local or regional signals, course quality scores, comparisons of courses or qualification levels, funding or fee records, missing values, or the right-side workspace choices.',
    examples: ['How good is this course?', 'Is this course funded?', 'What is the local demand for plumbers?', 'Is it free?', 'Which of these courses is better?'],
  },
  'app.scannable-presentation': {
    title: 'Application rules: person-first presentation with warehouse evidence', layer: 'application', priority: 3, triggers: ['warehouse'], family: 'evidence',
    when: 'Warehouse evidence is available but the person is unsure or early in exploration; presenting parallel options as list blocks; keeping the question only in the interaction.',
    examples: ['I am unsure what to do', 'I live in Geelong and don\'t know what to do', 'What work types are there?', 'Show me some options', 'I need a starting point'],
  },
  'app.audience-teaching': {
    title: 'Application rules: audience, plain language and structured teaching trigger', layer: 'application', priority: 3,
    when: 'Writing for students, parents, carers and returning workers; a parent asking on behalf of a child; substantive explanation requests that need structured teaching; explaining apprenticeship, placement and recognition of prior learning in plain words.',
    examples: ['My son wants to be a mechanic, what should he do?', 'Explain RPL simply', 'What is a placement?', 'I am a parent helping my daughter choose', 'Explain how traineeships work'],
  },
  'app.short-replies': {
    title: 'Application rules: short replies and continuity', layer: 'application', priority: 5, triggers: ['shortReply'],
    when: 'The user replies with a very short message, single word, acronym, number or option label such as quality, cost, placement, yes, no; repeats the same short reply; says the answer was too short or not clear.',
    examples: ['quality', 'cost?', 'yes', 'too short', 'not clear'],
  },
  'app.course-quality': {
    title: 'Application rules: explaining course and training quality', layer: 'application', priority: 5, triggers: ['courseQuality'],
    when: 'The user asks how good a course, TAFE, RTO, trade training or provider is; how to judge training quality; reputation, workshops, trainer experience, placements or employer links of a provider.',
    examples: ['Is this TAFE good?', 'How do I know if a course is good quality?', 'Which provider has better training?', 'What makes a good apprenticeship provider?', 'quality of the welding course'],
  },
  'app.situations': {
    title: 'Application rules: supported situations and goals, business and staff training', layer: 'application', priority: 3,
    when: 'Recognising the user\'s situation: school student, current student, recent graduate, no experience, unemployed, career changer, promotion, lateral move, returning after a break, reduced hours, starting a business or an employer upskilling staff.',
    examples: ['I want to start my own business', 'I run a company and want to train my staff', 'I want a promotion', 'I want to work fewer hours', 'I am a recent graduate with no experience'],
  },
  'app.advice-evidence-questions': {
    title: 'Application rules: calibrated advice, evidence, prerequisites and question shapes', layer: 'application', priority: 4,
    when: 'Calibrating conclusions to evidence; school subject prerequisites; apprenticeship completion versus licensing; inferring skills from job titles; pay, hours and funding promises; choosing text versus select questions; the user says I don\'t know or asks to explain more simply; spreadsheet record-matching examples.',
    examples: ['Do I need maths for engineering?', 'I don\'t know', 'Explain more simply', 'Will I get paid during the apprenticeship?', 'I was a receptionist, so I have admin skills right?'],
  },
  'app.location-drafts': {
    title: 'Application rules: typed location, request drafts, editing drafts and pre-emit checks', layer: 'application', priority: 5, triggers: ['serviceIntent', 'activeHandoff', 'draft'],
    when: 'A requested service needs location, goal or residency; preparing or editing a request draft or summary; the user asks to send, submit or adjust a request; external actions are not connected in this lab.',
    examples: ['Send my request to the provider', 'Adjust the draft', 'Change my location to Perth', 'I am an international student', 'Submit it'],
  },
  'app.wording-acceptance': {
    title: 'Application rules: final wording check and concrete acceptance examples', layer: 'application', priority: 4, triggers: ['experience'],
    when: 'Talking about whether existing experience transfers, job titles as evidence of competence, hours, pay, flexibility, hiring speed, drafts being saved or sent, comparing local courses without retrieved sources, residency labels.',
    examples: ['Will my customer service experience carry over?', 'Do these jobs fit school hours?', 'Is my draft saved?', 'Can you compare courses near me?', 'Am I domestic or international?'],
  },
  'app.early-exploration-low-effort': {
    title: 'Application rules: early exploration check, low-effort and location exceptions', layer: 'application', priority: 4, triggers: ['returnToWork'],
    when: 'A return-to-work user, a parent or carer who has not described previous tasks; income comparisons; an uncertain user asks for one tiny activity; needing income soon; an ambiguous place name; a person who will not give location or residency.',
    examples: ['I have been a stay-at-home mum for 8 years and want to go back to work', 'Give me one small thing to try', 'I need money soon', 'I live in Springfield', 'I don\'t want to give my location'],
  },
  'app.followup-scope': {
    title: 'Application rules: conversational follow-ups, requested scope and conflicting evidence', layer: 'application', priority: 4, triggers: ['shortReply'],
    when: 'A follow-up question about part of the previous answer; a stated weekly study allowance; a direct request for exactly one sentence or no follow-up; provider-specific facts not in the evidence; conflicting sources; corrected details.',
    examples: ['Tell me more about the second one', 'Just give me one sentence', 'I can study 10 hours a week', 'What about the placement part?', 'The website says something different'],
  },
  'app.study-load-examples': {
    title: 'Application rules: study load, accessibility and one-question acceptance examples', layer: 'application', priority: 4, triggers: ['studyLoad'],
    when: 'Whether a named course fits a stated number of study hours; caring responsibilities; captions or accessibility needs; the user wants exactly one question to ask a provider.',
    examples: ['I can study 12 hours a week, does this degree fit?', 'I care for my mum and can study 3 hours', 'I need captions', 'Give me one question to ask the provider', 'Is online study self paced?'],
  },
  'teach.learning-value': {
    title: 'Learning and decision value', layer: 'application', priority: 4,
    when: 'The user wants to understand a skill, concept or course unit deeply; explaining how a skill is used in real tasks; deciding teaching depth from evidence; requests too large for one response.',
    examples: ['Teach me what data analysis actually involves', 'What does this unit mean?', 'How would I use this skill at work?', 'Explain prioritisation properly', 'I want to really understand this'],
  },
  'teach.course-grounding': {
    title: 'Course teaching grounding examples', layer: 'application', priority: 4,
    when: 'Explaining the units, subjects, core and electives of a named course without a course guide; a user-supplied or fictional course excerpt.',
    examples: ['Explain the units in Business Foundations', 'What will I learn in a Cert IV in Accounting?', 'What are core and elective units?', 'Here is the course outline, what does it mean?', 'What subjects are in this course?'],
  },
  'presentation.visual-structure': {
    title: 'Meaningful visual structure and status semantics', layer: 'application', priority: 3,
    when: 'Formatting a detailed explanation with headings, lists, steps and comparisons; status values such as current, next, warning, blocked and complete; a "What to check" section for unverified provider details.',
    examples: ['How does the course build year by year?', 'What should I check before applying?', 'Lay out the steps', 'What do I need to verify?', 'Show me the stages'],
  },
  'teach.contract': {
    title: 'Structured teaching contract v4: depth, plain language, worked examples, evidence wording and scope', layer: 'application', priority: 4,
    when: 'Substantive explanation, learning or decision requests that need structured teaching with examples, worked demonstrations, evidence wording and appropriate depth; cost and pay calculations; multiple requested items.',
    examples: ['Explain how HECS works', 'Teach me how to prioritise tasks at work', 'Explain the difference in detail', 'How is the total course cost worked out?', 'Explain all three options'],
  },
  'teach.req.skill': {
    title: 'Teaching ingredients: skill requests', layer: 'application', priority: 3,
    when: 'The user asks what a skill means, how to do it, how to practise or improve it, or how to check a course teaches it.',
    examples: ['What is stakeholder management?', 'How do I get better at Excel?', 'Teach me problem solving', 'What does critical thinking look like at work?', 'How do I practise communication skills?'],
  },
  'teach.req.course': {
    title: 'Teaching ingredients: course requests', layer: 'application', priority: 3,
    when: 'The user asks what they would learn in a course, how its units fit together, practice and assessment, or whether it fits them.',
    examples: ['What would I learn in the Diploma of Nursing?', 'Is this course right for me?', 'How is the course assessed?', 'What does the course involve?', 'Tell me about the Certificate III in Carpentry'],
  },
  'teach.req.comparison': {
    title: 'Teaching ingredients: comparison requests', layer: 'application', priority: 4, triggers: ['compare'],
    when: 'The user asks to compare alternatives on the same criteria with a worked scenario and trade-offs.',
    examples: ['Compare TAFE and uni for nursing', 'Which is better, A or B?', 'What are the trade-offs between these courses?', 'Compare the two jobs', 'Pros and cons of each'],
  },
  'teach.req.requirements': {
    title: 'Teaching ingredients: requirements requests', layer: 'application', priority: 3,
    when: 'Entry requirements, job requirements, prerequisites, what counts as evidence, whether the user meets them.',
    examples: ['What are the entry requirements?', 'Do I meet the requirements for this job?', 'What do I need to get in?', 'What is a work sample?', 'What documents do I need?'],
  },
  'teach.req.cost': {
    title: 'Teaching ingredients: cost requests', layer: 'application', priority: 4, triggers: ['cost'],
    when: 'Course fees, tuition, total cost, funding, subsidies, loans, payment and repayment, budgeting for study.',
    examples: ['How much does it cost?', 'What will I pay in total?', 'Is there funding?', 'How does the loan work?', 'Can I afford this course?'],
  },
  'teach.req.role': {
    title: 'Teaching ingredients: role requests', layer: 'application', priority: 3,
    when: 'What a job or occupation involves day to day, its tasks, skills, tools, good performance and how to get there.',
    examples: ['What does a business analyst do?', 'What is a day like for an electrician?', 'What does a nurse actually do?', 'What skills does a project manager need?', 'Describe the role of a UX designer'],
  },
  'teach.req.skill-map': {
    title: 'Teaching ingredients: skill map requests', layer: 'application', priority: 3, triggers: ['skillsJobs'],
    when: 'Mapping a set of skills to tasks, showing what evidence shows about them, and what to develop next.',
    examples: ['Map my skills to jobs', 'What skills do I have from retail?', 'Which of my skills are useful for IT?', 'What skills should I develop?', 'Show me my skill gaps'],
  },
  'teach.req.plan': {
    title: 'Teaching ingredients: plan requests', layer: 'application', priority: 3,
    when: 'Making a practical plan or sequence from the starting point to a goal with checkpoints.',
    examples: ['Make me a plan to become a web developer', 'What steps should I take over the next 6 months?', 'Give me a roadmap', 'Plan my career change', 'How do I get there step by step?'],
  },
  'teach.req.market': {
    title: 'Teaching ingredients: market requests', layer: 'application', priority: 3, triggers: ['localFigures'],
    when: 'Job demand, shortages, growth forecasts, vacancies, salary comparisons and what labour market signals mean.',
    examples: ['Is there demand for electricians?', 'What is the job outlook for nurses?', 'Are these jobs growing?', 'What do they earn?', 'Is there a shortage of teachers?'],
  },
  'teach.req.organisation': {
    title: 'Teaching ingredients: organisation requests', layer: 'application', priority: 3,
    when: 'What a company, employer, institution or sector does and how it relates to the user\'s decision.',
    examples: ['What is it like to work at a bank?', 'What does this company do?', 'Tell me about the mining sector', 'What does a TAFE do?', 'Is this employer good?'],
  },
  'teach.req.opportunity': {
    title: 'Teaching ingredients: opportunity requests', layer: 'application', priority: 3,
    when: 'Internships, placements, apprenticeships, traineeships, volunteering or other opportunities: what they are, how they work and how to prepare.',
    examples: ['How do internships work?', 'How do I get an apprenticeship?', 'What is a traineeship like?', 'Should I volunteer?', 'How do I find a placement?'],
  },
  'teach.req.evidence': {
    title: 'Teaching ingredients: evidence requests', layer: 'application', priority: 3,
    when: 'Proving a skill or claim, portfolios, RPL evidence, what useful evidence looks like and how to strengthen it.',
    examples: ['How do I prove my skills?', 'What evidence do I need for RPL?', 'How do I build a portfolio?', 'Does my certificate prove I can do the job?', 'What counts as evidence of experience?'],
  },
  'teach.req.navigation': {
    title: 'Teaching ingredients: navigation requests', layer: 'application', priority: 2,
    when: 'Navigating to a deeper layer of the current subject, explaining how branches connect without restarting intake.',
    examples: ['Go deeper into that', 'How does this connect to my goal?', 'Tell me more about that branch', 'What is under that option?', 'Expand on that'],
  },
  'teach.completion-evidence': {
    title: 'Final teaching evidence check: completion is not competence', layer: 'application', priority: 3,
    when: 'Claims that completing a course, certificate or attendance proves understanding, practice or competence; reassurance such as highly achievable.',
    examples: ['If I finish the course will I be able to do the job?', 'Does a certificate prove I am skilled?', 'I completed a communication course so I am good at it', 'Is it achievable for me?', 'Will the course make me job ready?'],
  },
  'warehouse.rto-comparison': {
    title: 'RTO / course comparison using Yuzee intelligence', layer: 'core-module', priority: 5, triggers: ['rtoComparison'], family: 'evidence',
    when: 'Comparing the same or different qualifications across RTOs, TAFEs or providers using warehouse comparison records; shared national codes; evidence conflicts.',
    examples: ['Compare CPC30220 at two TAFEs', 'Which RTO is better for the Cert III in Carpentry?', 'Compare these providers', 'TAFE NSW or a private RTO?', 'Is the course the same at both places?'],
  },
  'local.first-steps': {
    title: 'Local exploration: counselling first with local data in support', layer: 'core-module', priority: 5, triggers: ['placeUnsure'], family: 'evidence',
    when: 'The user says where they live and is unsure what to do; early local exploration; using local organisations as examples; when the person cannot answer a discovery question.',
    examples: ['I live in Ballarat and don\'t know what to do', 'What can I do around here?', 'I am in Townsville and need direction', 'I don\'t know what I like', 'What is there for young people in my area?'],
  },
  'local.figures-scope': {
    title: 'Local exploration: answering jobs, numbers and demand with scope', layer: 'core-module', priority: 5, triggers: ['localFigures'], family: 'evidence',
    when: 'The user asks about local jobs, counts, demand, employers, forecasts or a local overview; keeping area and period with every figure.',
    examples: ['How many jobs are there for plumbers here?', 'What is the job market like in my area?', 'Which employers are hiring locally?', 'Is demand growing in Geelong?', 'Give me a local overview'],
  },
  'protocol.service-handoff': {
    title: 'Protocol detail: handoff fields, service_trigger actions, service visibility mapping and rmo_readiness', layer: 'core-module', priority: 5, triggers: ['serviceIntent', 'activeHandoff', 'draft'],
    when: 'Serializing a service handoff, scope fields, service_trigger actions, soft offers or action-ready states and rmo_readiness missing inputs.',
    examples: ['Yes, start the course offer request', 'I want Yuzee to find me jobs', 'Here is my location', 'I am a domestic student', 'Go ahead with the request'],
  },
};
