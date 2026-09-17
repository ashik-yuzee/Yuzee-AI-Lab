import type {ROUTER_MODELS} from './models';
/** Load both components from the same pinned revision. Construct the encoder explicitly so token validation has a tokenizer.
 * Offline evaluations use the downloaded revision directory to avoid metadata lookup. */
export async function loadEmbeddingModel(config:typeof ROUTER_MODELS[number],options:{device:'wasm'|'cpu';sourceDirectory?:string;local_files_only?:boolean;progress_callback?:(p:any)=>void;session_options?:any}){
 const {AutoModel,AutoTokenizer,FeatureExtractionPipeline}=await import('@huggingface/transformers');
 const common={revision:config.revision,local_files_only:options.local_files_only,progress_callback:options.progress_callback};
 const [model,tokenizer]=await Promise.all([
  AutoModel.from_pretrained(options.sourceDirectory||config.id,{...common,dtype:'q8',device:options.device,session_options:options.session_options}),
  AutoTokenizer.from_pretrained(options.sourceDirectory||config.id,common),
 ]);
 return new FeatureExtractionPipeline({task:'feature-extraction',model,tokenizer});
}
