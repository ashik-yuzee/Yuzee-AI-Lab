/** Bounded recovery for the explanation review; never falls back to an unreviewed answer. */
export type ReviewFailureCode = 'TIMEOUT' | 'NETWORK' | 'RATE_LIMIT' | 'PROVIDER' | 'INVALID_RESPONSE' | 'CONFIGURATION' | 'CANCELLED' | 'UNKNOWN';
export type ReviewAudit = {attempts:number; failures:ReviewFailureCode[]};
export class ReviewFailure extends Error {
 constructor(public audit:ReviewAudit){super(`Explanation review failed: ${audit.failures.at(-1)}`);this.name='ReviewFailure';}
}
export function reviewFailureCode(error:any,signal?:AbortSignal):ReviewFailureCode {
 if(signal?.aborted)return 'CANCELLED';
 if((error?.name==='TimeoutError'||error?.name==='AbortError'))return 'TIMEOUT';
 const status=Number(error?.status ?? error?.code);
 if(status===429)return 'RATE_LIMIT';
 if(status>=500&&status<=599)return 'PROVIDER';
 if([400,401,403,404].includes(status))return 'CONFIGURATION';
 if(error?.name==='TypeError'&&/fetch|network/i.test(error.message||''))return 'NETWORK';
 if(error instanceof SyntaxError||/Incomplete teaching review|Empty teaching review|Review output limit/.test(error?.message||''))return 'INVALID_RESPONSE';
 return 'UNKNOWN';
}
export async function runReview<T>(attempt:()=>Promise<T>,signal:AbortSignal,delay:(ms:number)=>Promise<void> = ms=>new Promise(resolve=>setTimeout(resolve,ms))):Promise<{value:T;audit:ReviewAudit}> {
 const audit:ReviewAudit={attempts:0,failures:[]};
 for(let i=0;i<2;i++){
  if(signal.aborted){audit.failures.push('CANCELLED');throw new ReviewFailure(audit);}
  audit.attempts++;
  try{return {value:await attempt(),audit};}
  catch(error){const code=reviewFailureCode(error,signal);audit.failures.push(code);
   if(i===1||!['TIMEOUT','NETWORK','RATE_LIMIT','PROVIDER','INVALID_RESPONSE'].includes(code))throw new ReviewFailure(audit);
   await delay(800);
  }
 }
 throw new ReviewFailure(audit);
}

export function reviewFailureMessage(code?:string):string {
 if(code==='PROVIDER'||code==='RATE_LIMIT')return 'Gemini is temporarily unavailable or busy. Your message is saved. Please try again shortly.';
 if(code==='TIMEOUT'||code==='NETWORK')return 'The reply check could not finish because Gemini took too long or the connection failed. Your message is saved. Please try again.';
 return 'I couldn’t prepare a clear response. Please try again. Your answer has been kept.';
}
