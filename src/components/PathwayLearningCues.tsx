import React from 'react';
import {learningTypesIn} from '../miniPathway/learningTypes';

export function PathwayLearningCues({text}:{text:string}){
 const types=learningTypesIn(text);
 if(!types.length)return null;
 return <div className="pathway-learning-cues" aria-label="Learning types mentioned">
  {types.map(type=><details key={type.id} className="pathway-learning-cue" data-learning-tone={type.tone}>
   <summary><span className="pathway-type-dot" aria-hidden="true"/>{type.label}{' '}<span className="pathway-level">{type.level}</span></summary>
   <div className="pathway-type-explanation"><p>{type.explanation}</p><p><strong>What to check:</strong> {type.check}</p></div>
  </details>)}
 </div>;
}
export function PathwayColourGuide(){
 return <details className="pathway-colour-guide">
  <summary>Course colours and levels <span>How to read your pathway</span></summary>
  <p>Colours identify learning types. The AQF label tells you the qualification level; it does not rank course quality or tell you which option is best for you.</p>
  <div className="pathway-colour-key">
   { [['level3','Certificates · AQF 1–4'],['level5','Diploma · AQF 5'],['level6','Advanced Diploma / Associate Degree · AQF 6'],['level7','Degrees · AQF 7'],['level8','Honours / graduate study · AQF 8'],['level9','Masters · AQF 9'],['level10','Doctoral study · AQF 10'],['short','Short courses · check recognition'],['micro','Microcredentials · level varies'],['route','Employment and training routes'] ].map(([tone,label])=><span key={tone} data-learning-tone={tone}><i className="pathway-type-dot" aria-hidden="true"/>{label}</span>)}
  </div>
  <p>Open a coloured label for an explanation. Labels describe names mentioned in the answer; they do not verify that a course is offered or accredited. An unlabelled step needs no assumed level.</p>
  <p>You do not have to complete every AQF level. Moving between courses depends on entry and credit rules. “Completed” and “Check this” describe progress or attention, separately from course type.</p>
  <a href="https://www.aqf.edu.au/framework/aqf-qualifications" target="_blank" rel="noreferrer">About qualification levels ↗</a>
 </details>;
}
