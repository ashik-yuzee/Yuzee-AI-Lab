"""Compare supplied sources without modifying any source workbook."""
import pathlib,json,csv,hashlib,collections,shutil
import openpyxl
BASE=pathlib.Path('/Users/freshfuturesaustralia/Dropbox/13 Ado/04 Yuzee/16 Yuzee/08 IT/128 Prompts/Oala Tools/Tools')
OUT=pathlib.Path('qa/objectives/source');OUT.mkdir(parents=True,exist_ok=True)
final=BASE/'Yuzee_316_Executable_Mini_Prompts_QA_Batch32_FINAL.xlsx'
prior=BASE/'Yuzee_316_Executable_Mini_Prompts_QA_Batch31.xlsx'
csvfile=BASE/'Yuzee_316_Executable_Mini_Prompts_QA_Batch32_FINAL_ObjectivePrompts.csv'
static=BASE/'Yuzee_316_FINAL_static_validation.json'
instructions=pathlib.Path('/Users/freshfuturesaustralia/Downloads/Yuzee_Codex_Instructions_316_Objective_Runtime_and_Gemini_Validation.md')
def rows(p):
    w=openpyxl.load_workbook(p,read_only=True,data_only=False); rr=list(w['Objective Prompts'].values)
    return {r[1]:dict(zip(rr[0],r)) for r in rr[1:]}
a,b=rows(final),rows(prior)
c={r['tool_id']:r for r in csv.DictReader(csvfile.open(encoding='utf-8-sig'))}
diff=[]
for k,row in a.items():
    for field,v in row.items():
        if str(v if v is not None else '')!=str(c.get(k,{}).get(field,'')):diff.append([k,field])
report={'primary_source':final.name,'objective_count':len(a),'csv_rows':len(c),'csv_differences':diff,
        'changed_objectives_since_batch31':[k for k in a if a[k]!=b.get(k)],
        'input_hashes':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [final,prior,csvfile,static,instructions]},
        'static_summary':json.loads(static.read_text())}
for p in [final,csvfile,static,instructions]:
    target=OUT/p.name
    if not target.exists():shutil.copy2(p,target)
    elif target.read_bytes()!=p.read_bytes():raise ValueError('Snapshot already exists with different content')
(OUT/'source-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:report[k] for k in ['objective_count','csv_rows','csv_differences','changed_objectives_since_batch31']}))
