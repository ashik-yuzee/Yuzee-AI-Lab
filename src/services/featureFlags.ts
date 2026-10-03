/** Per-browser chat feature switches, sent with every chat turn. The server's env kill switches still win. */
export type RagEmbedderChoice='default'|'bge'|'gemini';
export interface FeatureFlags{graph:boolean;forecasts:boolean;ragEmbedder:RagEmbedderChoice}
const KEY='yuzee_features';
const DEFAULTS:FeatureFlags={graph:true,forecasts:true,ragEmbedder:'default'};

export function loadFeatures():FeatureFlags{
  try{
    const v=JSON.parse(localStorage.getItem(KEY)||'{}');
    return {graph:v.graph!==false,forecasts:v.forecasts!==false,ragEmbedder:v.ragEmbedder==='bge'||v.ragEmbedder==='gemini'?v.ragEmbedder:'default'};
  }catch{return {...DEFAULTS};}
}
export function saveFeatures(next:FeatureFlags){try{localStorage.setItem(KEY,JSON.stringify(next));}catch{/* private mode: session-only */}}
/** Request payload: 'default' is omitted so the server's EXP_RAG_EMBEDDER applies. */
export function featurePayload(){const f=loadFeatures();return {graph:f.graph,forecasts:f.forecasts,...(f.ragEmbedder==='default'?{}:{ragEmbedder:f.ragEmbedder})};}
