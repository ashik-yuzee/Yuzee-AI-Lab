/** Repair only presentation details whose meaning is defined by the application. */
export function applyPresentationDefaults(response: any, turnId: string): string[] {
  const changes:string[]=[];
  const q=response?.interaction;
  if(q?.kind==='handoff' && q.input_type==='fields' && Array.isArray(q.fields) && q.fields.length){
    if(q.question_id===''){q.question_id=`request-details-${turnId}`;changes.push('Assigned a question ID to the request form.');}
    if(q.question===''){q.question='Add the missing details for your draft.';changes.push('Added the request form heading.');}
    for(const field of q.fields){
      if(field?.id==='location' && ['text','australian_location','single_select'].includes(field.input_type)){
        if(field.input_type!=='australian_location' || !Array.isArray(field.options) || field.options.length){
          field.input_type='australian_location';field.options=[];changes.push('Location is a user-entered text field.');
        }
      }
    }
  }
  return changes;
}
