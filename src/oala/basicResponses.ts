import type {YuzeeService} from './knowledge';
import {parseOalaMention} from './invocation';

export interface OalaBasicAnswer {
  text: string;
  services?: YuzeeService[];
}

/** Exact basic FAQs use product-owned copy. Personal requests and ambiguous questions stay with Gemini. */
export function oalaBasicAnswer(input: string, services: YuzeeService[]): OalaBasicAnswer | null {
  const mention = parseOalaMention(input);
  if (!mention.active) return null;
  const text = mention.message.trim().toLowerCase().replace(/[.!?]+$/g, '').trim();
  const intro = "Yuzee helps you explore study, skills and work options and plan your next step. I am Oala, its AI guidance assistant. I can explain our services, help you compare possible routes and work out what fits your goals, time and budget.";
  if (/^(hi|hello|hey)?$/.test(text)) return {text: intro + ' Tell me what you would like help with.'};
  if (/^(what is yuzee|who are you|what do you do)( and how can you help me)?([?.!] ?keep it simple)?$/.test(text)) return {text: intro};
  if (/^(what services (does yuzee|do you) (provide|offer)|list (all )?(yuzee |your )?services|show (me )?all (yuzee |your )?services)([?.!] ?please show all of them and explain how each helps)?$/.test(text) && services.length) {
    return {text: 'Yuzee helps with study, skills and work. These are our services and how each can help. In this chat, we can explain your options and prepare your next step. Live matching, applications and bookings are not connected in this preview.', services};
  }
  return null;
}
