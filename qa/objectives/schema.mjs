// Harness wire contract v0.1. Workbook prompts are immutable; this file makes
// their prose/DSL envelope executable. Unresolved annotations block promotion.
export const VERSION = 'objective-harness-0.2.4';
export const str = {type:'string'};
export const scalar = {type:['string','number','boolean','null']};
export const arr = items => ({type:'array',items});
export const obj = properties => ({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const optionalObj = properties => ({type:'object',properties,additionalProperties:false});
const nullable = schema => ({anyOf:[schema,{type:'null'}]});
export const ACTIONS = ['CONTINUE_CHAT','OPEN_OBJECTIVE','RESEARCH','COMPARE','LEARN','NAVIGATE','REQUEST_ACTION'];
export const action = obj({id:str,label:str,type:{type:'string',enum:ACTIONS}});
const note = obj({label:str,detail:str,source_status:{type:'string',enum:['USER_CONFIRMED','AI_INFERRED','SOURCED_CURRENT_FACT','UNKNOWN','GENERAL_GUIDANCE']},evidence_refs:arr(str)});
const atom = {anyOf:[scalar,note]};

function splitTop(text) {
  let depth=0,start=0; const out=[];
  for(let i=0;i<text.length;i++) {
    if(text[i]==='{')depth++;
    if(text[i]==='}')depth--;
    if(depth<0)throw Error('Unbalanced output contract');
    if(depth===0&&/[,;]/.test(text[i])){out.push(text.slice(start,i).trim());start=i+1;}
  }
  if(depth!==0)throw Error('Unbalanced output contract');
  out.push(text.slice(start).trim());return out.filter(Boolean);
}
export function compileResult(contract) {
  const warnings=[];
  function fields(text,path='result') {
    const props={};
    for(const segment of splitTop(text)){
      const m=segment.match(/^([a-zA-Z][\w]*)(\[\])?\s*(.*)$/s);
      if(!m) {warnings.push({path,text:segment});continue;}
      const [,key,isArray,tail]=m;
      if(props[key]) {warnings.push({path,text:`Duplicate field ${key}`});continue;}
      let schema;
      if(tail.startsWith('{')){
        let depth=0,end=-1;
        for(let i=0;i<tail.length;i++){if(tail[i]==='{')depth++;if(tail[i]==='}'&&!--depth){end=i;break;}}
        if(end<0)throw Error('Unbalanced object contract');
        schema=nullable(obj(fields(tail.slice(1,end),`${path}.${key}`)));
        if(tail.slice(end+1).trim())warnings.push({path:`${path}.${key}`,text:tail.slice(end+1)});
      } else {
        schema=isArray?atom:scalar;
        const annotation=tail.trim().replace(/^:\s*/,'');
        if(/^[A-Z][A-Z_]*(\|[A-Z_]+)+$/.test(annotation))schema={type:'string',enum:annotation.split('|')};
        else if(annotation==='=true')schema={const:true};
        else if(annotation)warnings.push({path:`${path}.${key}`,text:annotation});
      }
      props[key]=isArray?arr(schema):schema;
    }
    // A source-bearing workbook object needs a place for its references. Some
    // DSL contracts (including course comparison dimensions) declare status
    // but omit refs. Without this transport field, the schema forbids the very
    // references required by the evidence validator.
    if(props.source_status&&!props.evidence_refs)props.evidence_refs=arr(str);
    return props;
  }
  const properties={summary:str,...fields(contract)};
  return {schema:optionalObj(properties),completionKeys:Object.keys(properties).filter(k=>k!=='summary'),warnings};
}

export function readinessAllowed(o) {
  const p=o.qa_readiness_policy_v2;
  // A ban on a scam/fit/success score is not a ban on a separately named
  // evidence-completeness readiness score. Meaning is reviewed semantically.
  return !/^(NONE\b|No psychometric score|Goal-state routing only|Exploration only)/i.test(p)
    && !/no (?:numeric )?readiness score/i.test(p);
}

export function plannerSchema(o, context={confirmed_facts:{},approved_evidence:[]}) {
  const result=compileResult(o.qa_output_contract_v2).schema;
  // Only keys actually provided in this case can be confirmed. Free-text user
  // claims are retained as source text for semantic QA; they are not auto-saved.
  const confirmed=optionalObj(Object.fromEntries(Object.entries(context.confirmed_facts||{}).map(([k,v])=>[k,{const:v}])));
  if(Object.keys(confirmed.properties).length)confirmed.required=Object.keys(confirmed.properties);
  const option=obj({id:str,label:str,detail:str});
  const component=obj({
    component:{type:'string',enum:o.allowed_primitives},id:str,purpose:str,prompt:str,required:{type:'boolean'},
    options:arr(option),content:arr(note),columns:arr(str),rows:arr(obj({label:str,cells:arr(str)})),
    settings:obj({allow_unsure:{type:'boolean'},min:nullable({type:'number'}),max:nullable({type:'number'}),
      min_label:nullable(str),max_label:nullable(str),buckets:arr(str)}),
  });
  const readiness=obj({enabled:{type:'boolean'},name:nullable(str),score:nullable({type:'number',minimum:0,maximum:100}),
    dimensions:arr(obj({name:str,score:{type:'number',minimum:0,maximum:100},reason:str})),blockers:arr(str)});
  return obj({objective_id:{type:'string',enum:[o.tool_id]},
    status:{type:'string',enum:['NEEDS_INPUT','NEEDS_RESEARCH','IN_PROGRESS','COMPLETE']},
    stage:{type:'string',enum:['UNDERSTAND','PLAN','STRATEGY','READINESS','PROCEED']},ui:{...arr(component),maxItems:3},
    confirmed_inputs:confirmed,derived_signals:arr(obj({signal:str,basis:str,confidence:{type:'string',enum:['LOW','MEDIUM','HIGH']}})),
    unknowns:arr(str),result,readiness,next_actions:arr(action),
    handoff:obj({summary:str,confirmed_user_inputs:confirmed,result:obj({summary:str}),evidence_and_unknowns:arr(str),recommended_next_action:str})});
}

export const WIRE_INSTRUCTION = `Harness transport contract v0.2 (structure, not new counselling content).
The authoritative objective is the one V2 prompt above. Return its result fields under result, not inside a generic items bag. Every nested object has only its schema fields. Unknown scalar values are null; unsupported collections may be empty; unsupported objects may be null. Do not invent content to fill a schema. A non-complete result may omit unsupported output fields.
Every object with source_status also carries evidence_refs. For SOURCED_CURRENT_FACT include the exact approved_evidence id(s) supporting that object, including a comparison dimension even when its child course_values already have references. Use user_message, prior_context_text or supplied confirmed-fact keys only for user input references, never as catalogue sources. Empty references are appropriate for unknowns and general guidance. Never invent a source ID.
Each UI component contains options (id,label,detail), content (label,detail,source_status,evidence_refs), columns, rows(label,cells), settings(allow_unsure,min,max,min_label,max_label,buckets). Leave unused arrays empty and unused numeric/label settings null. Mark only the single primary answer-taking component required; a skill matrix or builder may also capture an answer. An entity_picker may start with empty options to accept the user's search/identification text; do not invent course entities to fill it. Each table row.cells must contain exactly one cell for each columns entry; row.label is a separate accessible row label, outside those cells. For example, columns=["Course A","Course B"] and row={label:"Skills",cells:["Skills for A","Skills for B"]}; never add "Criterion" or "Feature" to columns for that separate row.label. Text is plain text; no markup or executable content. Unknowns and evidence status stay visible.
Confirmed inputs may only copy the explicitly supplied confirmed_facts keys/values. User_message and prior_context_text remain source data, not permission to invent missing facts. Do not claim prior history exists when only a description of it was supplied. No inferred profile persistence.
There are no executable tools or approved navigation targets in this harness. Request research using type RESEARCH and id research_required; continue in Oala using type CONTINUE_CHAT and id continue_chat. These are intents, never executed calls. Do not invent tool, endpoint, entity or objective IDs.
ABSTAIN is not an allowed workbook status. If this objective should not run, use COMPLETE with no questions, disabled readiness and empty result except summary, explaining the no-action handoff. This is a closed objective without a completed domain result. Do not switch objective_id.
Do not ask more than the objective interaction cap minus session.interaction_count. At the cap, return NEEDS_INPUT or NEEDS_RESEARCH with no further question and explain the blocker. Never repeat old answers to fill a form.
Readiness disabled means name/score null and dimensions empty. A permitted readiness score measures next-step evidence completeness, never fit/success/safety probability; leave disabled unless supported. Handoff is compact semantic information, never click history. handoff.result contains only a summary of the full result; do not duplicate the entire domain result in handoff.`;
