import test from 'node:test';import assert from 'node:assert/strict';
import React from 'react';import Markdown from 'react-markdown';import {renderToStaticMarkup} from 'react-dom/server';
import {readableMarkdown} from '../src/components/readableMarkdown';
import {WorkspaceResult} from '../src/objectives/WorkspaceResult';
test('legacy inline bullet paragraphs become separated semantic list items',()=>{
 const prose='Start with types of work:\n• Hands-on and trades: practical tasks. • People and service: helping customers. • Office and digital: technical work. • Outdoor work: regional operations.';
 const html=renderToStaticMarkup(<Markdown>{readableMarkdown(prose)}</Markdown>);
 assert.equal((html.match(/<li>/g)||[]).length,4);assert.match(html,/<ul>/);assert.doesNotMatch(html,/•/);
 for(const label of ['Hands-on and trades','People and service','Office and digital','Outdoor work'])assert.ok(html.includes(label));
});
test('formatting repair leaves normal prose, dates, decimals and code unchanged',()=>{
 for(const text of ['The cost is $12.50. Start on 20.09.2026.','Horsham · VIC','Use `• one • two • three` literally.','```text\n• one • two\n```','- Existing list\n- Second item'])assert.equal(readableMarkdown(text),text);
});
test('the readable result does not repeat raw unknowns ahead of the question',()=>{
 const html=renderToStaticMarkup(<WorkspaceResult result={{summary:'Explore activities you enjoy.',interest_themes:[],unknowns:['Preferences not selected'],next_actions:[]}}/>);
 assert.match(html,/Explore activities/);assert.doesNotMatch(html,/unknowns|Preferences not selected|No details supplied/i);
});
