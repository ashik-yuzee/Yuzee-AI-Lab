// Application routing budget, including special tokens. This is not Gemini's output limit.
export const EMBEDDING_TOKEN_BUDGET = 256;
type Tokenizer = (text: string, options: {truncation: false; padding: false}) => {input_ids: {dims: number[]}};

/** Count the complete input before the pipeline's default truncation can hide a trailing instruction. */
export function checkEmbeddingInput(tokenizer: Tokenizer, text: string) {
  const result = tokenizer(text, {truncation:false, padding:false});
  const tokens = result.input_ids.dims.at(-1);
  if (!Number.isSafeInteger(tokens) || tokens! < 1) throw new Error('Invalid tokenizer result');
  return {tokens:tokens!, fits:tokens! <= EMBEDDING_TOKEN_BUDGET};
}
