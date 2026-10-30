/**
 * Pixel office for the MULTI_AGENT team window: a small Canvas 2D renderer adapted from
 * Pixel Agents (https://github.com/pixel-agents-hq/pixel-agents — MIT, © 2026 Pablo De Lucca, see ./LICENSE).
 * Characters are based on JIK-A-4's Metro City pack (CC0). Sprites in /public/pixel-agents.
 *
 * Poses only ever follow the real view model: queued = standing by the desk, running = typing with the
 * agent's own message, completed = seated with a brief ✓, failed = "!". Integer zoom, no smoothing.
 */
import {AGENT_DISPLAY,type AgentStatus,type AgentType,type OrchestrationState,type OrchestrationViewModel} from '../../../agents/contract';

const CELL_W=56, CELL_H=76, WALL=32, TOP=WALL+8, SIDE=8, WALK_MS=450, DONE_MS=2500;
// Sheets: char_0..5 Metro City, char_6..8 hue-shifted variants. Oala (the lead) gets her own.
const CHAR:Record<AgentType|'OALA',number>={OALA:1,PROFILE_SPECIALIST:0,SKILLS_SPECIALIST:3,JOBS_SPECIALIST:2,MARKET_SPECIALIST:4,COMPANY_SPECIALIST:5,LEARNING_SPECIALIST:6,PATHWAY_SPECIALIST:7,OPPORTUNITY_SPECIALIST:8};
const OALA_AT_WORK:OrchestrationState[]=['understanding_request','planning','merging','composing'];

const FILES=['floor','desk','bench','pc-off','pc-on-1','pc-on-2','pc-on-3','whiteboard','bookshelf','clock','plant','char_0','char_1','char_2','char_3','char_4','char_5','char_6','char_7','char_8'];
export type Sprites=Record<string,HTMLImageElement>;
let loading:Promise<Sprites>|null=null;
export function loadOffice():Promise<Sprites>{
  return loading??=Promise.all(FILES.map(f=>new Promise<[string,HTMLImageElement]>((ok,fail)=>{
    const img=new Image(); img.onload=()=>ok([f,img]); img.onerror=fail; img.src=`/pixel-agents/${f}.png`;
  }))).then(Object.fromEntries,e=>{loading=null;throw e;});
}

// 11×12 bubbles from Pixel Agents (waiting ✓ / permission "...") plus a "!" variant. B border, F fill, X mark.
const BUBBLES={
  done:{mark:'#44BB66',rows:['_BBBBBBBBB_','BFFFFFFFFFB','BFFFFFFFFFB','BFFFFFFFXFB','BFFFFFFXFFB','BFFXFFXFFFB','BFFFXXFFFFB','BFFFFFFFFFB','BFFFFFFFFFB','_BBBBBBBBB_','____BBB____','_____B_____']},
  wait:{mark:'#CCA700',rows:['BBBBBBBBBBB','BFFFFFFFFFB','BFFFFFFFFFB','BFFFFFFFFFB','BFFFFFFFFFB','BFFXFXFXFFB','BFFFFFFFFFB','BFFFFFFFFFB','BFFFFFFFFFB','BBBBBBBBBBB','____BBB____','_____B_____']},
  fail:{mark:'#D9364C',rows:['BBBBBBBBBBB','BFFFFFFFFFB','BFFFFXFFFFB','BFFFFXFFFFB','BFFFFXFFFFB','BFFFFXFFFFB','BFFFFFFFFFB','BFFFFXFFFFB','BFFFFFFFFFB','BBBBBBBBBBB','____BBB____','_____B_____']},
};

type DeskStatus=AgentStatus|'idle'|null; // null = this specialist was not called for the question: empty desk
export interface Desk{key:string;x:number;y:number;char:number;name:string;status:DeskStatus;message?:string;ran:boolean}

/** Every team member always has their own desk (Oala in the middle of the front row). Only specialists the plan really
 * called sit at their desk; the others stay empty, so the office never shows work that is not happening. */
const SEATS:Array<AgentType|'OALA'>=['PROFILE_SPECIALIST','JOBS_SPECIALIST','OALA','SKILLS_SPECIALIST','MARKET_SPECIALIST',
  'COMPANY_SPECIALIST','LEARNING_SPECIALIST','PATHWAY_SPECIALIST','OPPORTUNITY_SPECIALIST'];
const COLS=5;
export function layoutOffice(vm:OrchestrationViewModel|null){
  const desks:Desk[]=SEATS.map((seat,i)=>{
    const row=Math.floor(i/COLS), inRow=Math.min(COLS,SEATS.length-row*COLS), x=SIDE+(COLS-inRow)*CELL_W/2+(i%COLS)*CELL_W+4, y=TOP+row*CELL_H;
    if(seat==='OALA')return {key:'oala',x,y,char:CHAR.OALA,name:'Oala',ran:true,message:vm?.statusMessage,
      status:!vm?'idle':OALA_AT_WORK.includes(vm.state)?'running':vm.state==='completed'||vm.state==='partial_failure'?'completed':vm.state==='failed'?'failed':'idle'};
    const a=vm?.activities.find(x=>x.type===seat);
    return {key:a?.id??seat,x,y,char:CHAR[seat],name:AGENT_DISPLAY[seat].short,status:a?a.status as DeskStatus:null,message:a?.currentMessage,ran:a?.startedAt!=null};
  });
  return {w:COLS*CELL_W+2*SIDE,h:TOP+CELL_H+62,desks};
}

interface Seen{status:DeskStatus;prev?:DeskStatus;since:number}

/** Draws one frame; returns true while something is animating (typing, walking, a fresh ✓). */
export function drawOffice(ctx:CanvasRenderingContext2D,img:Sprites,vm:OrchestrationViewModel|null,seen:Map<string,Seen>,now:number,still:boolean,dpr:number):boolean{
  const {width:cw,height:ch}=ctx.canvas, L=layoutOffice(vm);
  const fit=Math.min(cw/L.w,ch/L.h), z=fit>=1?Math.floor(fit):fit; // ponytail: fractional only when even 1:1 device pixels won't fit
  const ox=Math.round((cw-L.w*z)/2), oy=Math.round((ch-L.h*z)/2);
  const X=(x:number)=>Math.round(ox+x*z), Y=(y:number)=>Math.round(oy+y*z);
  const put=(im:HTMLImageElement,x:number,y:number,sx=0,sy=0,sw=im.width,sh=im.height,flip=false)=>{
    const w=Math.round(sw*z),h=Math.round(sh*z);
    if(!flip){ctx.drawImage(im,sx,sy,sw,sh,X(x),Y(y),w,h);return;}
    ctx.save();ctx.translate(X(x)+w,Y(y));ctx.scale(-1,1);ctx.drawImage(im,sx,sy,sw,sh,0,0,w,h);ctx.restore();
  };
  ctx.imageSmoothingEnabled=false;
  ctx.clearRect(0,0,cw,ch);
  for(let ty=WALL;ty<L.h;ty+=16)for(let tx=0;tx<L.w;tx+=16)put(img.floor,tx,ty);
  ctx.fillStyle='#2c3554';ctx.fillRect(X(0),Y(0),Math.round(L.w*z),Math.round(WALL*z));
  ctx.fillStyle='#1d2338';ctx.fillRect(X(0),Y(WALL-2),Math.round(L.w*z),Math.round(2*z));
  put(img.bookshelf,SIDE,0);put(img.clock,L.w-44,0);put(img.plant,L.w-22,WALL-24);
  const lead=L.desks.find(d=>d.key==='oala')!;
  put(img.whiteboard,lead.x+8,0);

  // Text scales with the office zoom (whole steps), capped by the screen's pixel ratio: scaling it by the pixel ratio
  // alone cut names off at 2x displays, where the office still drew at zoom 2.
  const ts=Math.min(dpr,z*2/3);
  let animating=false;
  const bubbles:Array<()=>void>=[];
  for(const d of L.desks){
    const k=`${vm?.id}:${d.key}`; let s=seen.get(k);
    if(!s)seen.set(k,s={status:d.status,since:now});
    else if(s.status!==d.status)seen.set(k,s={status:d.status,prev:s.status,since:now});
    const t=now-s.since, typing=d.status==='running';
    const walking=typing&&s.prev==='queued'&&t<WALK_MS&&!still;
    const freshDone=d.status==='completed'&&!!s.prev&&s.prev!=='completed'&&t<DONE_MS;
    if(typing||(freshDone&&!still))animating=true;

    put(img.desk,d.x,d.y);
    put(typing?img[`pc-on-${still?1:1+Math.floor(now/200)%3}`]:img['pc-off'],d.x+16,d.y);
    put(img.bench,d.x+16,d.y+32);
    if(d.status===null){bubbles.push(()=>label(ctx,d.name,X(d.x+24),Y(d.y+47),CELL_W*z-2*ts,ts,true));continue;}

    // Sheet rows: 0 down, 1 up, 2 right (left = mirrored). Frames: 0-2 walk, 3-4 type, 5-6 read.
    const sheet=img[`char_${d.char}`], standing=d.status==='queued'||(d.status==='failed'&&!d.ran);
    if(walking){const p=t/WALK_MS;put(sheet,d.x+32-Math.round(16*p),d.y+8,[0,1,2,1][Math.floor(t/150)%4]*16,64,16,32,true);}
    else if(standing)put(sheet,d.x+32,d.y+8,16,0,16,32);
    else put(sheet,d.x+16,d.y+14,(typing?3+(still?0:Math.floor(now/300)%2):1)*16,32,16,32);

    const headX=standing||walking?d.x+32:d.x+16, headY=standing||walking?d.y+2:d.y+12;
    const kind=d.status==='queued'?'wait':d.status==='failed'?'fail':d.status==='completed'&&(still||freshDone)?'done':null;
    bubbles.push(()=>{
      label(ctx,d.name,X(d.x+24),Y(d.y+47),CELL_W*z-2*ts,ts);
      if(typing&&d.message)speech(ctx,d.message,X(d.x+24),Y(d.y)-Math.round(2*ts),CELL_W*z-4*ts,ts);
      else if(kind){const b=BUBBLES[kind];b.rows.forEach((r,ry)=>[...r].forEach((c,rx)=>{if(c==='_')return;
        ctx.fillStyle=c==='B'?'#555566':c==='F'?'#EEEEFF':b.mark;
        ctx.fillRect(X(headX+3+rx),Y(headY+ry),Math.ceil(z),Math.ceil(z));}));}
    });
  }
  bubbles.forEach(b=>b());
  return animating;
}

const font=(px:number,weight:number)=>`${weight} ${px}px ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif`;
function fitText(ctx:CanvasRenderingContext2D,text:string,max:number){
  let t=text.length>60?text.slice(0,59)+'…':text;
  while(t.length>2&&ctx.measureText(t).width>max){const cut=t.lastIndexOf(' ',t.length-3);t=(cut>0?t.slice(0,cut):t.slice(0,-2))+'…';} // whole words first
  return t;
}
function label(ctx:CanvasRenderingContext2D,name:string,cx:number,top:number,max:number,dpr:number,empty=false){
  ctx.font=font(Math.round(10.5*dpr),700);
  const t=fitText(ctx,name,max-6*dpr), w=Math.round(ctx.measureText(t).width+8*dpr), h=Math.round(15*dpr);
  ctx.fillStyle=empty?'rgba(20,24,40,.38)':'rgba(20,24,40,.78)';ctx.fillRect(Math.round(cx-w/2),top,w,h);
  ctx.fillStyle=empty?'rgba(255,255,255,.6)':'#fff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(t,cx,top+h/2);
}
function speech(ctx:CanvasRenderingContext2D,text:string,cx:number,bottom:number,max:number,dpr:number){
  ctx.font=font(Math.round(9*dpr),500);
  const pad=Math.round(4*dpr), t=fitText(ctx,text,max-pad*2), w=Math.round(ctx.measureText(t).width+pad*2), h=Math.round(14*dpr), tail=Math.round(3*dpr);
  const x=Math.max(0,Math.min(ctx.canvas.width-w,Math.round(cx-w/2))), y=bottom-tail-h, b=Math.max(1,Math.round(dpr));
  ctx.fillStyle='#555566';ctx.fillRect(x,y,w,h);ctx.fillRect(cx-tail,y+h,tail*2,b);ctx.fillRect(cx-b,y+h,b*2,tail);
  ctx.fillStyle='#EEEEFF';ctx.fillRect(x+b,y+b,w-2*b,h-2*b);
  ctx.fillStyle='#1c1f26';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(t,x+w/2,y+h/2);
}
