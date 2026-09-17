import artifact from './bgeArtifact.json';
import {BGE_RELEASE} from './bgeProfiles';
export function checkedBgeVector(values:ArrayLike<number>):Float32Array {
 if(values.length!==artifact.dimensions)throw Error('Unexpected embedding dimensions');
 let norm=0;for(const n of Array.from(values)){if(!Number.isFinite(n))throw Error('Nonfinite embedding');norm+=n*n;}
 if(Math.abs(Math.sqrt(norm)-1)>.002)throw Error('Embedding must be L2-normalized');
 return Float32Array.from(values);
}
export const bgeReadyContract={modelId:artifact.modelId,revision:artifact.revision,tokenBudget:artifact.maxTokens,pooling:artifact.pooling,dimensions:artifact.dimensions,dtype:artifact.dtype,artifact:artifact.artifact,release:BGE_RELEASE};
export function validBgeReady(value:unknown){const m=value as any;return !!m&&Object.entries(bgeReadyContract).every(([k,v])=>m[k]===v);}
