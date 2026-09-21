// Deliberately separate from the production adapter. Never archive credentials.
export function extractText(body){
  if(!body)return '';
  if(typeof body.output_text==='string')return body.output_text;
  if(body.steps)return body.steps.filter(s=>s.type==='model_output').flatMap(s=>s.content||[]).filter(c=>c.type==='text').map(c=>c.text||'').join('');
  return (body.outputs||[]).filter(c=>c.type==='text').map(c=>c.text||'').join('');
}
export function shouldRetry(output,validation,attempt){
  if(attempt>=2)return false;
  return !!((output.error&&(output.http_status===null||output.http_status===429||output.http_status>=500))||validation.failures.some(f=>f.code==='JSON_PARSE'));
}
// Gemini's supported schema subset needs a typed singleton enum instead of an
// untyped JSON Schema const. Local AJV validation still checks the original const.
export function geminiSchema(node){
  if(!node||typeof node!=='object')return node;
  if(Object.hasOwn(node,'const')){
    if(node.const===null)return {type:'null'};
    if(['string','number','boolean'].includes(typeof node.const))return {type:typeof node.const,enum:[node.const]};
    throw Error('Structured confirmed facts require an explicit typed fixture mapping');
  }
  return Array.isArray(node)?node.map(geminiSchema):Object.fromEntries(Object.entries(node).map(([k,v])=>[k,geminiSchema(v)]));
}
