/** Local social responses only. Meaningful messages and follow-ups go to Gemini. */
export function bypassCopy(kind:'greeting'|'farewell'|'idle'|'rubbish'):string {
 switch(kind){
  case 'greeting': return "Hi, I'm Oala. I can help you explore courses, skills and career options. What would you like help with?";
  case 'farewell': return "You're welcome. You can return whenever you want to explore your next step.";
  case 'idle': return 'I can help with courses, skills, career choices and Yuzee services. What would you like to explore?';
  case 'rubbish': return "I couldn't tell what you meant from that message. You can use a few words, such as ‘course quality’, ‘study costs’ or ‘finding a job’. What would you like help with?";
 }
}
