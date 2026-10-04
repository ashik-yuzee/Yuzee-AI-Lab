// node --import ./node_modules/tsx/dist/loader.mjs tests/pixel-agents.test.ts
import assert from 'node:assert/strict';
import {dockPosition,moveDock,snapDock} from '../src/components/agents/PixelAgentsWindow';
import {layoutOffice} from '../src/components/agents/pixel/office';
import type {AgentActivity,OrchestrationViewModel} from '../src/agents/contract';

// Snap: corners, edges, and the centre falls to the nearest edge.
assert.equal(snapDock(10,10,300,300,1200,900),0);
assert.equal(snapDock(880,580,300,300,1200,900),8);
assert.equal(snapDock(450,20,300,300,1200,900),1);
assert.equal(snapDock(900,300,300,300,1200,900),5);
assert.equal(snapDock(290,450,300,300,900,1200),3); // centre, slightly left → left edge
assert.equal(snapDock(450,300,300,300,1200,900),1); // centre of a wide screen → top
// Arrow keys hop over the centre and stop at the walls.
assert.equal(moveDock(3,'ArrowRight'),5);
assert.equal(moveDock(1,'ArrowDown'),7);
assert.equal(moveDock(0,'ArrowLeft'),0);
assert.equal(moveDock(2,'ArrowDown'),5);
assert.equal(moveDock(2,'Enter'),2);
// Docked windows stay inside the viewport, under the navbar at the top.
assert.deepEqual(dockPosition(2,384,380,1200,900),{x:800,y:72});
assert.deepEqual(dockPosition(8,384,380,1200,900),{x:800,y:504});
assert.deepEqual(dockPosition(8,384,380,300,200),{x:0,y:0});

// Office: a fixed desk per team member, Oala centred in row one.
// Every team member always has a desk; with no question yet only Oala is in, idle.
const quiet=layoutOffice(null).desks;
assert.equal(quiet.length,9);assert.deepEqual(quiet.filter(d=>d.status!==null).map(d=>[d.key,d.status]),[['oala','idle']]);
const act=(id:string,type:AgentActivity['type'],status:AgentActivity['status']):AgentActivity=>({id,type,displayName:id,status,dependsOn:[]});
const vm=(acts:AgentActivity[],state:OrchestrationViewModel['state']):OrchestrationViewModel=>({id:'o1',complexityLevel:3,state,understood:'',visible:true,activities:acts,completedCount:0,totalCount:acts.length,runningCount:0,nextActions:[]});
const types:AgentActivity['type'][]=['PROFILE_SPECIALIST','SKILLS_SPECIALIST','JOBS_SPECIALIST','MARKET_SPECIALIST','COMPANY_SPECIALIST','LEARNING_SPECIALIST','PATHWAY_SPECIALIST','OPPORTUNITY_SPECIALIST'];
// Only specialists the plan called sit at their (fixed) desk; the rest stay empty.
const two=layoutOffice(vm([act('j','JOBS_SPECIALIST','running'),act('p','PROFILE_SPECIALIST','completed')],'agents_running')).desks;
assert.equal(two.length,9);assert.deepEqual(two.filter(d=>d.key!=='oala'&&d.status!==null).map(d=>d.name).sort(),['Jobs','Profile']);
assert.deepEqual(two.map(d=>`${d.x},${d.y}`),quiet.map(d=>`${d.x},${d.y}`),'seats never move between questions');
const full=layoutOffice(vm(types.map((t,i)=>act('a'+i,t,'running')),'agents_running'));
assert.equal(full.desks.length,9);
assert.equal(full.desks[2].key,'oala');
assert.equal(full.desks[2].status,'idle'); // agents running → Oala waits, no fake work
assert.equal(new Set(full.desks.map(d=>`${d.x},${d.y}`)).size,9);
assert.equal(new Set(full.desks.map(d=>d.char)).size,9);
assert.ok(full.desks.every(d=>d.x>=0&&d.x+48<=full.w&&d.y+62<=full.h));
assert.equal(layoutOffice(vm([act('a','JOBS_SPECIALIST','completed')],'merging')).desks.find(d=>d.key==='oala')!.status,'running');
console.log('pixel-agents ok');
