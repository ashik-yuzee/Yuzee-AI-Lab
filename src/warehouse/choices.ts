import type {ExplorationChoice,WarehousePack} from './types';
export function explorationChoice(pack:WarehousePack|undefined,value:any):{choice:ExplorationChoice;text:string}{
 const e=pack?.connected?.exploration;
 if(!e||!value||!Array.isArray(value.roleIds)||!Array.isArray(value.skills)||value.roleIds.length>3||value.skills.length>12)throw Error('Choose roles and skills shown in this workspace.');
 if(new Set(value.roleIds).size!==value.roleIds.length||new Set(value.skills.map((s:any)=>s?.id)).size!==value.skills.length)throw Error('Choose each role or skill once.');
 const roles=value.roleIds.map((id:any)=>{const r=e.roles.find(r=>r.id===id);if(!r)throw Error('Choose a role shown in this workspace.');return r;});
 const skills=value.skills.map((s:any)=>{const skill=e.skills.find(k=>k.id===s?.id);if(!skill||!['HAVE','LEARN','UNSURE'].includes(s.state))throw Error('Choose a skill shown in this workspace.');return {id:skill.id,name:skill.name,state:s.state} as ExplorationChoice['skills'][number];});
 const choice={roleIds:roles.map(r=>r.id),skills};
 const phrases=[roles.length?`I want to explore these roles: ${roles.map(r=>r.title).join('; ')}.`:'I have not selected a target role yet.'];
 for(const [state,label] of [['HAVE','I say I have experience using'],['LEARN','I want to learn'],['UNSURE','I am unsure about my experience with']]){const names=skills.filter(s=>s.state===state).map(s=>s.name);if(names.length)phrases.push(label+': '+names.join('; ')+'.');}
 return {choice,text:phrases.join(' ')+' These replace my previous workspace skill selections. Unmarked skills remain unknown. My reported skills are not verified competence. Help me connect the work, relevant learning options and the recorded demand in my area.'};
}
export function workspaceCourses(pack?:WarehousePack){
 return [...(pack?.courses||[]),...(pack?.connected?.exploration?.learning||[]).flatMap(l=>l.courses)];
}
