export type CourseQuality = {key:string;label:string;value:number;explanation:string};
export type WarehouseCourse = {
 id:string; evidenceId:string; name:string; provider:string; code:string|null; level:string|null; type:string|null;
 duration:string|null; delivery:string[]; locations:string[]; entry:string[]; description:string|null;
 fees:{domestic:string|null;international:string|null;details:string[]};
 skills:string[]; outcomes:string[]; assessments:string[]; bestFor:string[]; considerations:string[];
 quality:CourseQuality[]; qualityExplanation:string|null;
 evidenceIssues?:string[];
 intelligence?:Array<{key:string;label:string;items:string[]}>;
 providerId?:string;
 comparisonDetails?:{learning:string[];practice:string[];attendance:string[];credit:string[];strengths:string[];limitations:string[];outcome:string|null};
 source:{label:string;url:string|null;updatedAt:string|null;origin:'YUZEE_WAREHOUSE'};
};
export type WarehousePack = {
 status:'READY'|'NO_MATCH'|'NOT_NEEDED'|'UNAVAILABLE'|'PREPARING';
 queries:string[]; courses:WarehouseCourse[]; retrievedAt:string; message:string;
 sourcePolicy:'USER_APPROVED_CATALOGUE';
 connected?:WarehouseConnections;
 comparison?:WarehouseComparison;
};
export type ProviderMatch={query:string;status:'MATCHED'|'AMBIGUOUS'|'NOT_FOUND';providers:Array<{id:string;evidenceId:string;name:string;rtoCode:string|null;type:string|null;area:string;description:string|null;support:string[];updatedAt:string|null;scope:string}>};
export type WarehouseComparison={
 snippetId:'rto_course_comparison';title:string;baseline:string;notes?:string[];
 options:Array<{id:string;title:string;subtitle:string}>;
 rows:Array<{key:string;label:string;basis:'COURSE_RECORD'|'PROVIDER_RECORD'|'YUZEE_ANALYSIS';status:'SHARED'|'DIFFERENT_RECORDS'|'INCOMPLETE'|'UNKNOWN';values:string[][];meaning:string}>;
 providerMatches:ProviderMatch[];
 qualifications:Array<{code:string;evidenceId:string;units:Array<{code:string;title:string;type:string}>;scope:string}>;
};
export type WarehouseExploration={
 roles:Array<{id:string;evidenceId:string;title:string;description:string;tasks:string[];matchedSkills:string[];skills:Array<{id:string;name:string;description:string}>;mappings:Array<{anzsco_code:string;anzsco_title:string;method:string;confidence:number|null}>;source:string;scope:string;matchReason:string}>;
 skills:Array<{id:string;name:string;description:string;roleIds:string[]}>;
 learning:Array<{id:string;evidenceId:string;code:string;skill:string;kind:string;method:string;query:string;courses:Array<{id:string;name:string;provider:string}>;scope:string}>;
 jobs:Array<{id:string;evidenceId:string;title:string;company:string;area:string;skills:string[];requirements:string[];description:string;employmentType:string;workMode:string;salary:string;postedAt:string|null;updatedAt:string|null;url:string|null;source:string;availability:'NOT_CONFIRMED_CURRENT';geography:{scope:string;name:string;localMatch:boolean}}>;
 observedSkills:Array<{id:string;evidenceId:string;name:string;count:number;denominator:number;scope:string;geography:string}>;
 geography:{scope:string;name:string;localMatch:boolean}|null;
 coverage:{sampleSize:number;withStructuredSkills:number;returnedJobs:number;localSkillDemand:string;note:string};
};
export type ExplorationChoice={roleIds:string[];skills:Array<{id:string;name:string;state:'HAVE'|'LEARN'|'UNSURE'}>};
export type WarehouseConnections={
 localOverview?:{
  evidenceId:string;area:string;state:string;scope:string;ancestors:Array<{name:string;scope:string}>;
  profile:{area:string;scope:string;population:number|null;setting:string;period:string;source:string}|null;
  community:Array<{key:string;label:string;recordedCount:number;examples:Array<{name:string;type:string;source:string;updatedAt:string;area:string}>}>;
  limited:boolean;coverage:string;
 }|null;
 exploration?:WarehouseExploration|null;
 location:{requested:string;region:{key:string;name:string;tier:string;state:string}|null;candidates:Array<{key:string;name:string;tier:string;state:string}>};
 providers:Array<{id:string;evidenceId:string;name:string;type:string;higherEducationCode:string;city:string;state:string;campuses:Array<{name:string;town:string;state:string;postcode:string}>;support:string[];higherEducationFunding:any;funding:any[];courseIds:string[]}>;
 careers:Array<{id:string;evidenceId:string;title:string;description:string;tasks:string[];skills:string[];workStyles:string[];courseLinks:Array<{courseId:string;courseName:string;method:string;confidence:number|null}>;profileScope:string;profileSource:string;profileMethod:string;groupCode:string}>;
 industries:Array<{id:string;evidenceId:string;name:string;courseId?:string;careerId?:string;method:string;scope:string}>;
 signals:Array<{id:string;evidenceId:string;kind:string;careerId?:string;title:string;text:string;scope:string;region:string;period:string|null;source:string;method:string;localMatch:boolean;updatedAt?:string;metrics?:{advertisements?:number|null;employers?:number|null;growthPercent?:number|null;horizonYears?:number|null;baseYear?:number|null}}>;
 relationships:Array<{from:string;to:string;relation:string;method:string;confidence:number|null}>;scopeNote:string;
};
export const warehouseEvidence=(pack:WarehousePack)=>[...(pack.connected?.localOverview?[{id:pack.connected.localOverview.evidenceId,source:'USER_APPROVED_YUZEE_WAREHOUSE',record_path:'warehouse_data.connected.localOverview'}]:[]),...pack.courses.map((c,index)=>({id:c.evidenceId,source:'USER_APPROVED_YUZEE_CATALOGUE',record_path:`warehouse_data.courses[${index}]`})),...(pack.comparison?.qualifications||[]).map((q,i)=>({id:q.evidenceId,source:'USER_APPROVED_YUZEE_WAREHOUSE',record_path:`warehouse_data.comparison.qualifications[${i}]`})),...(pack.comparison?.providerMatches||[]).flatMap((m,i)=>m.providers.map((p,j)=>({id:p.evidenceId,source:'USER_APPROVED_YUZEE_WAREHOUSE',record_path:`warehouse_data.comparison.providerMatches[${i}].providers[${j}]`}))),...(['providers','careers','industries','signals'] as const).flatMap(key=>(pack.connected?.[key]||[]).map((r,index)=>({id:r.evidenceId,source:'USER_APPROVED_YUZEE_WAREHOUSE',record_path:`warehouse_data.connected.${key}[${index}]`}))),...(['roles','learning','jobs','observedSkills'] as const).flatMap(key=>(pack.connected?.exploration?.[key]||[]).map((r,index)=>({id:r.evidenceId,source:'USER_APPROVED_YUZEE_WAREHOUSE',record_path:`warehouse_data.connected.exploration.${key}[${index}]`})))];
export type WarehouseInput = {message:string;context?:string;selectedCourseIds?:string[];force?:boolean};
export type WarehouseRetriever = (input:WarehouseInput,signal?:AbortSignal)=>Promise<WarehousePack>;
