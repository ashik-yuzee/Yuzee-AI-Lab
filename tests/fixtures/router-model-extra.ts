export const boundaries=[
 'Hello','Thanks','Tell me more','Actually I have six hours, not twelve.','Stop suggesting courses.','Do not compare anything.','I am in an emergency and need help.',
 'What are the fees? Can you compare jobs too?','Quiero cambiar de carrera y estudiar enfermería.',
 'Give me a recipe for a chocolate cake.','Will it rain tomorrow in Melbourne?','Who won the football match yesterday?',
 'Write a bedtime story about a dragon.','How do I fix a leaking tap at home?','What is the capital city of Portugal?',
 'Book me a flight to Paris for next week.','Translate this restaurant menu into French.','Why do cats sleep so much?',
 'What is the best way to grow tomatoes on a balcony?','Help me calculate the area of a circle.',
];
export const needs:[string,'answer'|'clarify'|'research'][]=[
 ['What is an elective? Explain it simply.','answer'],['Teach me active listening with a short example.','answer'],['What does accreditation mean in general?','answer'],['Explain how a prerequisite differs from a corequisite.','answer'],['Tell me about Yuzee services.','answer'],['Help me practise giving useful feedback to a coworker.','answer'],
 ['I work nights and look after two children. Could I manage study as well?','clarify'],['I have no idea which career fits me and I need help deciding.','clarify'],['How can I balance university classes with a changing work schedule?','clarify'],['I like several fields and cannot decide what to study.','clarify'],
 ['Check the 2027 tuition fees for the Bachelor of Nursing at Deakin University.','research'],['What are the entry requirements for the Bachelor of Nursing at Deakin University?','research'],['Find the application deadline for the Bachelor of Nursing at Deakin University.','research'],['Check the official unit list for the Bachelor of Nursing at Deakin University.','research'],['Which clinical placements are required for the Bachelor of Nursing at Deakin University?','research'],['Find the timetable attendance rules for the Bachelor of Nursing at Deakin University.','research'],
];
export const pathways:[string,boolean][]=[
 ['I want to move from retail into IT but I do not know the route to take.',true],['Help me compare an apprenticeship, university and starting work before I choose.',true],['I am certain I want to become a nurse. Map how I can get there.',true],['I feel stuck in my job and need to explore other career directions.',true],['Plan the stages from my first coding course to my first software job.',true],['I am finishing school and want to compare possible study and career paths.',true],['I have decided on IT support. Show the next stages towards my first support job.',true],['I am returning to work after raising children. Help me explore possible routes.',true],
 ['Explain what an elective is.',false],['What are the fees for a nursing course?',false],['Teach me how to write a spreadsheet formula.',false],['What does Yuzee do?',false],['Thanks for explaining that.',false],['Give me a recipe for pasta.',false],['How are student loan repayments calculated?',false],['What documents are required for this application?',false],
];
export const suggestions:{text:string;allowed:string[]}[]=[
 {text:'Tuition is only one part of the study budget. Placement travel, uniforms, screening and time away from paid work can also affect what you can afford.',allowed:['COURSE_011','COURSE_012']},
 {text:'Core units are required subjects. Electives are choices within the degree. Some advanced units require an earlier subject to be passed first.',allowed:['COURSE_004','COURSE_005','CORE_007']},
 {text:'The degree includes laboratory classes and practical rotations. A part-time enrolment may still involve full-time placement weeks, which need checking against work and family commitments.',allowed:['COURSE_012','COURSE_004','COURSE_011']},
 {text:'Your retail examples show communication and dealing with upset customers. Those abilities may transfer into help-desk work, while troubleshooting experience still needs development.',allowed:['SKILL_004','SKILL_003','CAREER_005']},
 {text:'You could demonstrate spreadsheet skills with an anonymised project showing how you cleaned data, checked errors and explained a useful finding.',allowed:['PROVE_001','SKILL_002','SKILL_009']},
 {text:'Prior learning recognition depends on matching your work evidence to the qualification outcomes. A provider decides whether that evidence earns credit.',allowed:['RPL_001','CORE_010']},
 {text:'Compare the actual job advertisement with examples of work you have completed. Separate requirements you can demonstrate from those still needing evidence.',allowed:['CAND_002','COMP_008','SKILL_003','JOB_002','JOB_001']},
 {text:'An apprenticeship combines paid work and formal learning. Employer availability, training rules and local eligibility need to be checked.',allowed:['APP_001','COURSE_016','EXPERIENCE_001']},
 {text:'A company can build capability through internal training or recruitment. The deadline, current team skills and available supervision affect which approach is practical.',allowed:['COMP_010','COMP_011']},
 {text:'This curriculum teaches theory but needs more realistic practice linked to the target occupation. Assessment design should close the identified gaps.',allowed:['INST_007','INST_005','COURSE_013','INST_004']},
 {text:'Salary comparisons need the same occupation level, region, period and hours basis. A single job advert cannot establish a market trend.',allowed:['TREND_007','CORE_010']},
 {text:'AI may automate parts of invoice entry while people still resolve unusual cases and communicate with clients. That is a change in tasks, not proof the occupation will disappear.',allowed:['JOB_008','IND_010','TREND_003','SKILL_007']},
 {text:'Before relying on this estimate, check the date, the original source and whether it covers the correct course, student category and intake.',allowed:['CORE_010','COURSE_011','COURSE_010']},
 {text:'Graduate roles can lead to specialist practice or supervision. Your next career move depends on the responsibilities you want and the experience you can demonstrate.',allowed:['CAREER_004','CAREER_002','CAREER_003']},
 {text:'Kubernetes helps coordinate containers across machines. It can restart failed workloads and scale applications, but adds operational complexity.',allowed:['TECH_001','JOB_005','CORE_007']},
 {text:'Power BI can combine data sources and build interactive reports. Practising with a small public dataset is a useful way to learn.',allowed:['TECH_001','SKILL_009','PROVE_001']},
];
