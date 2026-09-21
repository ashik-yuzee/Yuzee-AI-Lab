import registry from './service-registry.json';
export {registry as serviceRegistry};

/** Product labels, protocol classifications and executable actions are different namespaces. */
export function serviceForIntent(intent:string) {
  return registry.routes.find(route=>route.intent===intent) ?? null;
}

export function serviceRegistryPrompt():string {
  return `Canonical product catalogue (informational descriptions, not connected actions):\n${registry.products.map(p=>[p.id,p.icon,p.name,p.benefit,p.delivery].join(' | ')).join('\n')}

CANONICAL SEMANTIC MAPPING
intent | product_id | primary_requested_service
${registry.routes.map(r=>[r.intent,r.product_id,r.protocol_id].join(' | ')).join('\n')}
Allowed primary_requested_service values: ${registry.protocol_ids.join('|')}.
Select by the user's immediate goal, never their life-stage label alone. A recent graduate seeking an ordinary entry-level job maps to JOB_MATCH_RMO. GRAD_PROGRAM_RMO is only for an explicitly structured graduate program; graduation alone does not imply it. If the distinction matters and is unclear, ask one focused question. Apprenticeship and traineeship, and internship and required work placement, are distinct protocol values even where a shared product supports both.
Product IDs are never executable action IDs. Only trusted runtime action IDs may be executed. Workspace activity IDs are a separate catalogue; do not place them in service_trigger.actions. NONE is normal when no service is relevant. Never invent or emit a legacy RMO alias.`;
}
