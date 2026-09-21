import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {resolveCandidate} from './context-candidate';
const examples=[
 ['JOB','Tell me about cybersecurity analyst roles.','What skills do I need?','JOB_004'],
 ['COMPANY','Tell me about Deloitte.','What roles do they hire?','COMP_002'],
 ['SKILL','I want to learn Python.','What jobs use it?','SKILL_011'],
 ['COURSE','I am considering the nursing course at Deakin.','What about cost?','COURSE_011'],
 ['QUALIFICATION','I am considering a Bachelor of Nursing at Deakin.','What about cost?','COURSE_011'],
 ['INSTITUTION','Tell me about Deakin University.','What courses do they offer?','INST_002'],
 ['INDUSTRY','I want to explore the construction industry.','What skills are needed?','IND_006'],
 ['CAREER','I want a career in accounting.','What are the levels?','CAREER_002'],
 ['PATHWAY','I am planning a pathway from retail to IT support.','What is the next step?',null],
] as const;
const rows=[];
for(const [type,content,request,expectedSkill]of examples){const result=resolveCandidate(request,[{role:'user',content}]);assert.equal(result.status,'resolved');assert.equal(result.entity?.type,type);assert.equal(result.entity?.evidence,content);rows.push({type,content,request,expectedSkill,result});}
const blocked=[
 {request:'What about that one?',history:[{role:'user',content:'Tell me about Deloitte.'}]},
 {request:'What skills do I need?',history:[{role:'assistant',content:'Tell me about cybersecurity analyst roles.'}]},
 {request:'What about cost?',history:[{role:'user',content:'I am considering a Bachelor of Nursing and a Diploma of Design.'}]},
 {request:'What jobs use it?',history:[{role:'user',content:'I want to learn Python.'},{role:'user',content:'Actually, forget that and stop.'}]},
 {request:'What roles do they hire?',history:[{role:'user',content:'Tell me about Deloitte.'},{role:'user',content:'Tell me about the mysterious planet.'}]},
 {request:'What jobs use it?',history:[{role:'user',content:'I want to learn Python or Java.'}]},
 {request:'What roles do they hire?',history:[{role:'user',content:'Tell me about Fizzlebop.'}]},
 {request:'Please stop suggesting skills',history:[{role:'user',content:'Tell me about cybersecurity analyst roles.'}]},
 {request:'What skills do I need?',history:[{role:'user',content:'I am not interested in cybersecurity analyst roles.'}]},
 {request:'Compare them',history:[{role:'user',content:'Tell me about Deloitte.'}]},
 {request:'What skills do I need?',history:[{role:'user',content:'Tell me about cybersecurity analyst roles.'+' x'.repeat(400)}]},
];
for(const row of blocked)assert.equal(resolveCandidate(row.request,row.history).status,'abstained');
await fs.writeFile('output/bge-audit/context-candidate-tests.json',JSON.stringify({candidateOnly:true,positive:rows,negative:blocked.map(r=>({...r,result:resolveCandidate(r.request,r.history)})),note:'Resolver tests only; resolving context does not guarantee a correct embedding route. Synthetic author-labelled development cases.'},null,2));
console.log('PASS 9 entity types and 11 ambiguity, correction, provenance and length boundaries. Candidate is not live.');
