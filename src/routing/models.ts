// Public ONNX models pinned to the revisions evaluated in September 2026.
// These are embedding encoders. Gemini still writes the counselling response.
export const ROUTER_MODEL_KEY='oala-router-model';
export const ROUTER_MODELS=[
 {id:'Xenova/all-MiniLM-L6-v2',label:'MiniLM-L6',revision:'751bff37182d3f1213fa05d7196b954e230abad9',pooling:'mean',tokenBudget:256,description:'Historical benchmark only'},
 {id:'Xenova/all-MiniLM-L12-v2',label:'MiniLM-L12',revision:'beeb2e4b69e95f188a15cc2e90d09fd035dac229',pooling:'mean',tokenBudget:256,description:'Historical benchmark only'},
 {id:'Xenova/bge-small-en-v1.5',label:'BGE-small',revision:'ea104dacec62c0de699686887e3f920caeb4f3e3',pooling:'cls',tokenBudget:512,description:'Calibrated skill matching · 512-token input window'},
] as const;
export const DEFAULT_ROUTER_MODEL=ROUTER_MODELS[2].id;
export type RouterModelId=typeof ROUTER_MODELS[number]['id'];
export function routerModel(value:unknown){return ROUTER_MODELS.find(m=>m.id===value)||ROUTER_MODELS[2];}

// Legacy models remain available to offline comparison scripts only.
export const RUNTIME_ROUTER_MODELS=[ROUTER_MODELS[2]] as const;
