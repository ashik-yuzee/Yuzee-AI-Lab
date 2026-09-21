/** Repair legacy prose containing literal bullet glyphs without changing its words.
 * Structured list blocks remain the preferred output. Code is left untouched. */
export function readableMarkdown(input:string):string{
 return input.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g).map((part,i)=>{
  if(i%2)return part;
  return part.split('\n').map(line=>{
   if(!/^[ \t]*[•●]\s/.test(line)&&(line.match(/\s[•●]\s/g)||[]).length<2)return line;
   return line.replace(/(^|\s+)[•●]\s+/g,'\n\n- ').trimStart();
  }).join('\n');
 }).join('');
}
