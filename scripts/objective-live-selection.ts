import fs from 'node:fs/promises';
import dotenv from 'dotenv';
import {ObjectiveService} from '../src/objectives/service';
dotenv.config({quiet:true});
// Candidate IDs/scores captured from the real browser BGE smoke run on 18 Sept.
// Assistant responses below are synthetic selector fixtures, not generated chat.
const cases=[
 {id:'course-learning',text:'The diploma brochure has unit names but I cannot picture what I would actually learn or practise.',response:'We can translate the unit descriptions into practical examples and identify what still needs evidence.',expected:['STUDY_005'],candidates:[['STUDY_005',.7111516344803535],['RECOVERY_002',.7058301279531414],['SKILL_SIDE_004',.6995463599410682],['SCHOOL_012',.6961104544659072],['SCHOOL_004',.6958444169248443],['EMP_GROWTH_005',.6888911937121203],['GAP_003',.6805259715557876],['PATH_007',.6792252134430777]]},
 {id:'offers',text:'I have two written employment offers. One pays more but the other has better training. Help me weigh them up.',response:'Salary and training are both relevant. A structured comparison can make the trade-offs clearer.',expected:['JOB_DECIDE_004'],candidates:[['JOB_DECIDE_004',.8523197715739486],['EMP_COMPARE_002',.763896074071454],['JOB_COMPARE_001',.7626006297607637],['JOB_COMPARE_002',.7447100501304827],['VACANCY_003',.7402607800047086],['EMP_SKILL_002',.7395649108192911],['PROFILE_002',.7333757192411309],['EMP_ENTRY_004',.7294331513616273]]},
 {id:'scam',text:'A recruiter wants an upfront payment for equipment and my bank password before an interview. Can you check this offer?',response:'Do not pay or share your password. Those are serious red flags. The employer has not been verified; we can assess what is known and what needs checking.',expected:['EMP_SAFE_001','EMP_SAFE_002'],candidates:[['EMP_HIRING_001',.7152980856670782],['PATH_004',.6959231585945306],['VACANCY_004',.6938892511227001],['EMP_SAFE_002',.6913246221521014],['EMP_FIT_001',.6858999836357392],['EMP_SAFE_001',.6851713453838448],['JOB_DECIDE_004',.6844376374993654],['VACANCY_003',.6771035027166129]]},
 {id:'interests-missing-candidate',text:'I have never really thought about which activities I enjoy. Could we work that out first?',response:'We can begin with the activities you enjoy before choosing a career direction.',expected:['DISCOVER_001'],candidates:[['SCHOOL_006',.7676545952742702],['PROFILE_001',.7293983794024833],['IND_DISCOVER_002',.7128745751719472],['DISCOVER_007',.7125856586426302],['SCHOOL_004',.7028567132790217],['DISCOVER_003',.6953148579667566],['GOAL_002',.690585241171018]]},
 {id:'recipe',text:'How do I bake sourdough bread at home?',response:'You are asking about a home baking recipe.',expected:[],candidates:[['SCHOOL_026',.5966237407788582],['RECOVERY_006',.5656106100484916],['EMP_JOB_002',.56556617138671],['SKILL_SIDE_005',.5637438095777212],['IND_JOB_002',.5539185981619545],['SKILL_SIDE_007',.521492756356717],['EMP_CULTURE_002',.5184178093812172],['PATH_005',.5183019624510969]]},
 {id:'ambiguous',text:'that one please',response:'There is not enough context to identify what you mean.',expected:[],candidates:[['JOB_DISCOVER_007',.6846936160842787],['EMP_SAFE_001',.6733229025215044],['PATH_011',.6694322978212495],['EVIDENCE_002',.6591560094206652],['RECOVERY_004',.6546924628384124],['GOAL_002',.6389940713548034],['GOAL_005',.6372381968756574],['LEARN_006',.6301401012612582]]},
 {id:'thanks',text:'Thanks!',response:'You are welcome.',expected:[],candidates:[]},
 {id:'stop',text:'Stop suggesting tools',response:'Understood.',expected:[],candidates:[]},
 {id:'active-question',text:'Help me compare job offers.',response:JSON.stringify({interaction:{kind:'question',question:'Which offers are you comparing?'}}),expected:[],candidates:[['JOB_DECIDE_004',.85]]},
];
const root='qa/objectives/integration/selection-'+new Date().toISOString().replace(/[:.]/g,'-');
const service=new ObjectiveService(root),results:any[]=[];
console.log('Results: '+root);
for(const t of cases){
 const conv={id:'selector-'+t.id,messages:[{id:'u',role:'user',content:t.text},{id:'a',role:'assistant',content:t.response}]};
 try{const result=await service.select(conv,{sourceMessageId:'a',candidates:t.candidates.map(([id,score])=>({id,score}))},new AbortController().signal,()=>true);results.push({...t,result,exact_expected:t.expected.length?t.expected.includes(String(result.objective_id)):result.decision==='NONE'});}
 catch(e){results.push({...t,error:String(e),exact_expected:false});}
 await fs.mkdir(root,{recursive:true});await fs.writeFile(root+'/summary.json',JSON.stringify(results,null,2));
 console.log(JSON.stringify({id:t.id,...results.at(-1).result,error:results.at(-1).error,exact_expected:results.at(-1).exact_expected}));
}
