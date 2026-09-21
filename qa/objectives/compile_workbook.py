"""Read-only workbook compiler. No workbook authoring and no production imports."""
import argparse, collections, csv, hashlib, json, pathlib, re
import openpyxl

def compile_workbook(path):
    w = openpyxl.load_workbook(path, read_only=True, data_only=False)
    def records(sheet):
        rows = list(w[sheet].values)
        return [dict(zip(rows[0], row), source_row=i) for i, row in enumerate(rows[1:], 2) if any(v is not None for v in row)]
    objectives = records('Objective Prompts')
    tests = records('Gemini Test Cases')
    primitives = records('UI Primitive Registry')
    rules = {row[0]:row[1] for row in w['Global Rules'].values if row[0] and row[1]}
    errors = []
    allowed = {p['primitive'] for p in primitives}
    ids = [o['tool_id'] for o in objectives]
    if len(ids) != 316 or len(set(ids)) != 316: errors.append('Expected 316 unique objectives')
    if len(allowed) != 20: errors.append('Expected 20 unique primitives')
    tids = [t['test_id'] for t in tests]
    if len(tids) != 3140 or len(set(tids)) != 3140: errors.append('Expected 3140 unique tests')
    for o in objectives:
        for key in ['qa_prompt_v2','qa_allowed_primitives_v2','qa_output_contract_v2','qa_readiness_policy_v2']:
            if not o.get(key): errors.append(f"{o['tool_id']}: missing {key}")
        if o['patch_applied'] != 'YES_V2_PROMPT': errors.append(f"{o['tool_id']}: version selection requires review")
        o['allowed_primitives'] = [p.strip() for p in o['qa_allowed_primitives_v2'].split('|')]
        o['max_interactions'] = int(o['qa_max_interactions_v2'])
        if not 1 <= o['max_interactions'] <= 6: errors.append(f"{o['tool_id']}: interaction limit")
        if set(o['allowed_primitives']) - allowed: errors.append(f"{o['tool_id']}: unknown primitive")
        o['prompt_sha256'] = hashlib.sha256(o['qa_prompt_v2'].encode()).hexdigest()
    for t in tests:
        if t['tool_id'] not in ids: errors.append(f"{t['test_id']}: orphan test")
    if errors: raise ValueError('\n'.join(errors))
    return dict(source_file=path.name, source_sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                objectives=objectives, tests=tests, primitives=primitives, global_rules=rules,
                qa_rubric=list(w['QA Rubric'].values)[1:], runbook=list(w['Codex Gemini Runbook'].values)[1:])

if __name__ == '__main__':
    p=argparse.ArgumentParser(); p.add_argument('workbook',type=pathlib.Path); p.add_argument('--out',type=pathlib.Path,required=True)
    args=p.parse_args(); r=compile_workbook(args.workbook)
    args.out.parent.mkdir(parents=True,exist_ok=True); args.out.write_text(json.dumps(r,indent=2,ensure_ascii=False)+'\n')
    print(json.dumps({'objectives':len(r['objectives']),'tests':len(r['tests']),'primitives':len(r['primitives']),'source_sha256':r['source_sha256']}))
