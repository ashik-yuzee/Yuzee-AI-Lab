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
  // A list/table block whose content is in items/rows sometimes omits its optional intro text; "" means no intro.
  for(const b of Array.isArray(response?.content_blocks)?response.content_blocks:[]){
    if(b&&typeof b==='object'&&!('text' in b)&&[b.items,b.rows,b.columns].some(x=>Array.isArray(x)&&x.length)){b.text='';changes.push('Added an empty intro text to a list or table block.');}
  }
  return changes;
}
