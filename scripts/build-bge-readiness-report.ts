import fs from 'node:fs/promises';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
const markdown=await fs.readFile('docs/BGE-Readiness-and-Test-Plan.md','utf8');
const body=renderToStaticMarkup(React.createElement(ReactMarkdown,{remarkPlugins:[remarkGfm],children:markdown}));
await fs.mkdir('output/html',{recursive:true});
await fs.writeFile('output/html/Yuzee-BGE-Readiness-and-Test-Plan.html',`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Yuzee BGE readiness and test plan</title><style>
*{box-sizing:border-box}body{margin:0;color:#253248;background:#fbfafc;font:17px/1.7 system-ui,-apple-system,sans-serif}main{max-width:1120px;margin:0 auto;padding:40px 32px 80px}h1,h2,h3{color:#1d2133;line-height:1.25}h1{font-size:38px;margin:0 0 20px}h2{font-size:27px;margin-top:44px;padding-top:22px;border-top:1px solid #dedbe6}h3{font-size:21px;margin-top:32px}p,li{max-width:90ch}p{margin:0 0 18px}li{margin:8px 0}a{color:#6538ad;text-underline-offset:3px}table{border-collapse:collapse;width:100%;font-size:15px;line-height:1.55;margin:24px 0}th,td{text-align:left;vertical-align:top;padding:12px 14px;border-bottom:1px solid #dedbe6}th{background:#eee8f7;color:#3e2a62}tr:nth-child(even) td{background:#f6f4f8}code{font:14px/1.6 ui-monospace,monospace;overflow-wrap:anywhere;background:#f0edf5;padding:2px 4px;border-radius:4px}footer{margin-top:40px;padding-top:18px;border-top:1px solid #ddd;color:#627086;font-size:14px}@media(max-width:650px){main{padding:24px 18px}h1{font-size:30px}table{display:block;overflow-x:auto}th,td{min-width:145px}body{font-size:16px}}@media print{body{background:white;font-size:11pt}main{padding:0}h2,h3{break-after:avoid}tr{break-inside:avoid}a{color:inherit}}
</style></head><body><main>${body}<footer>Evidence: <a href="../bge-readiness/audit.json">Readiness audit JSON</a>. The recorded browser benchmark and fresh CPU checks are identified separately. No runtime model or threshold was changed by this assessment.</footer></main></body></html>`);
console.log('Created output/html/Yuzee-BGE-Readiness-and-Test-Plan.html');
