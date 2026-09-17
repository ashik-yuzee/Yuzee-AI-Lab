import type {YuzeeResponseV13} from '../types';

/** Keep table relationships intact; CSS stacks rows when the report is narrow.
 * The shared renderer omits table.text, so promote it to a visible introduction.
 * Stored JSON, cell values and row order remain unchanged.
 */
export function miniPathwayPanelResponse(response:YuzeeResponseV13):YuzeeResponseV13 {
 return {...response,content_blocks:response.content_blocks.flatMap(block=>{
  if(!['table','comparison'].includes(block.type)||!block.text)return [block];
  return [
   {...block,id:block.id+'-intro',type:'text' as const,title:'',columns:[],rows:[],items:[]},
   {...block,text:''},
  ];
 })};
}
