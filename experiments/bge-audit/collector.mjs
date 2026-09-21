import http from 'node:http';
import fs from 'node:fs/promises';
const allowed=new Set(['browser-inapp','browser-safari','browser-chrome','browser-extra']);
http.createServer(async(req,res)=>{
 if(req.headers.origin!=='http://localhost:3000'){res.writeHead(403).end();return;}
 res.setHeader('Access-Control-Allow-Origin','http://localhost:3000');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
 if(req.method==='OPTIONS'){res.writeHead(204).end();return;}
 const name=req.url?.replace('/record/','');
 if(req.method!=='POST'||!allowed.has(name)){res.writeHead(404).end();return;}
 try{const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>20_000_000)throw Error('Too large');chunks.push(chunk);}
  const obj=JSON.parse(Buffer.concat(chunks).toString());if(obj.model?.id!=='Xenova/bge-small-en-v1.5'||(name!=='browser-extra'&&obj.queries?.length!==103))throw Error('Invalid audit');
  await fs.writeFile(`output/bge-audit/${name}.json`,JSON.stringify(obj,null,2));res.writeHead(200).end('Saved');console.log('Saved '+name);
 }catch(e){res.writeHead(400).end(String(e));}
}).listen(3001,'127.0.0.1',()=>console.log('Synthetic BGE audit collector on localhost:3001'));
