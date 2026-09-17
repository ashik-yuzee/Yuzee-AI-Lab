import {eligibleTools,indexText,type Candidate} from './policy';
// Separate recommendation index: input routing retains its evaluated original descriptors.
const examples:Record<string,string[]>={
 COURSE_011:[
  'HECS-HELP repayment rules. Explain student loan repayments, repayment income, thresholds, employer tax withholding and indexation with a worked example.',
  'Plan a clinical placement budget. Travel, accommodation, equipment, uniforms, screening costs and lost earnings during unpaid placement blocks.',
  'Tuition and government support. Commonwealth Supported Places, student contribution fees, subsidies, grants, scholarships, payment options and out-of-pocket expenses.',
 ],
 COURSE_012:[
  'Clinical placement requirements and timelines. Practical training shifts, attendance, assessments, placement hours and fitting full-time study around work and family.',
  'How do I manage study workload, practical rotations and caring responsibilities? Compare part-time and full-time commitments.',
 ],
 CAREER_004:['Graduate nurse program entry. Transition from a nursing degree into a graduate program and registered nursing work. Application timeline, milestones and career progression.'],
 COURSE_010:['Check university admissions, VTAC and direct entry requirements, English language standards and prerequisite subjects.'],
 COURSE_004:['Understand the degree structure, compulsory core units, electives, credit points and prerequisite sequencing.'],
 CORE_010:['Check whether claims about fees, student loans, repayment rates, eligibility or course requirements have current official sources. Identify outdated or unsupported information.'],
};
export const suggestionIndex=eligibleTools.flatMap(t=>[
 {toolId:t.id,text:indexText(t)},
 {toolId:t.id,text:`${t.name}. ${t.purpose} ${t.mini_prompt.match(/Output emphasis: ([\s\S]*?)These are content priorities/)?.[1]||t.use_when}`},
 ...(examples[t.id]||[]).map(text=>({toolId:t.id,text})),
]);
export function rankSuggestions(query:Float32Array,vectors:Float32Array[]):Candidate[]{
 const scores=new Map<string,number>();
 vectors.forEach((v,i)=>{const score=v.reduce((sum,n,j)=>sum+n*query[j],0),id=suggestionIndex[i].toolId;scores.set(id,Math.max(scores.get(id)??-1,score));});
 return [...scores].map(([toolId,score])=>({toolId,score})).sort((a,b)=>b.score-a.score).slice(0,4);
}
