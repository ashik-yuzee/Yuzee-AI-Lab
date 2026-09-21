import fs from 'node:fs';import path from 'node:path';import {parse} from 'dotenv';import {spawn} from 'node:child_process';
const repo=process.cwd(),root=path.resolve(process.env.PACK40_ROOT||'output/prompt-pack-40/2026-09-20'),conf=parse(fs.readFileSync('.env'));
const env={...process.env,NODE_ENV:'production',PORT:process.env.PACK40_PORT||'3011',DATABASE_URL:'',YUZEE_AUDIT_ROOT:root,YUZEE_AUDIT_PACK:repo+'/qa/prompt-pack-40/cases.json'};
for(const k of ['GEMINI_API_KEY','ADMIN_USERNAME','ADMIN_PASSWORD','AUTH_SECRET'])if(conf[k])env[k]=conf[k];
const child=spawn(process.execPath,['server.cjs'],{cwd:root+'/runtime',env,stdio:'inherit'});for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal));child.on('exit',code=>process.exit(code||0));
