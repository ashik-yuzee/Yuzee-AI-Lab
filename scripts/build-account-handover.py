from pathlib import Path
import shutil,subprocess,json,hashlib,zipfile,re,datetime

repo=Path.cwd();dest=repo.parent/'deliverables';dest.mkdir(exist_ok=True)
root=dest/'Yuzee-Account-Handover-2026-09-20';root.mkdir(exist_ok=True)
project=root/'project/Yuzee-AI-Lab';project.mkdir(parents=True,exist_ok=True)
excluded=[];included=[]
def exclude(rel):
 parts=rel.parts
 if any(x in ['node_modules','.git','dist','tmp','__pycache__','.venv','target'] for x in parts):return 'Rebuildable dependency, build, Git internals or temporary files'
 if rel.name=='.DS_Store' or rel.name.endswith(('.pyc','.zip')):return 'Operating-system metadata or nested archive'
 if rel.name.startswith('.env') and rel.name!='.env.example':return 'Private environment configuration'
 if parts[0]=='data':
  if str(rel) in ['data','data/minilm-cache','data/minilm-cache/Xenova','data/minilm-cache/Xenova/bge-small-en-v1.5']:return None
  if str(rel).startswith('data/minilm-cache/Xenova/bge-small-en-v1.5/'):return None
  return 'Personal runtime state, private logs, derived warehouse index or historical model cache'
 if parts[:2]==('output','handover'):return 'Historical duplicate handover tree; selected narrative documents retained separately'
 if 'runtime' in parts and parts[0]=='output':return 'Temporary audit server and duplicate runtime state'
 if any(x in ['.claude','.codex'] for x in parts):return 'Machine-specific assistant configuration'
 return None
for base,dirs,files in __import__('os').walk(repo,followlinks=False):
 b=Path(base)
 for d in list(dirs):
  path=b/d;rel=path.relative_to(repo);why=exclude(rel)
  if path.is_symlink():why='Machine-specific symbolic link'
  if why:dirs.remove(d);excluded.append({'path':str(rel)+'/','reason':why})
 for f in files:
  src=b/f;rel=src.relative_to(repo);why=exclude(rel)
  if src.is_symlink():why='Machine-specific symbolic link'
  if why:excluded.append({'path':str(rel),'reason':why});continue
  target=project/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,target);included.append(str(rel))
shutil.copy2(repo/'docs/Account-Handover-2026-09-20.md',root/'START_HERE.md')
shutil.copy2(repo/'docs/NEXT_ACCOUNT_START.md',root/'NEXT_ACCOUNT_START.md')
history=root/'historical-handover-notes';history.mkdir(exist_ok=True)
for p in (repo/'output/handover').glob('*.md'):shutil.copy2(p,history/p.name)
for p in (repo/'output/handover').glob('*/README.md'):shutil.copy2(p,history/(p.parent.name+'-README.md'))
for p in (repo/'output/handover').glob('Yuzee-Mobile-BGE*/**/*'):
 if p.is_file() and p.suffix in ['.md','.html','.json']:q=history/'mobile-bge'/p.name;q.parent.mkdir(exist_ok=True);shutil.copy2(p,q)
git=lambda *args:subprocess.check_output(['git',*args],cwd=repo).decode()
(root/'GIT_STATE.txt').write_text('Working tree snapshot, not a commit-only export.\nBase commit: '+git('rev-parse','HEAD')+'\n'+git('status','--short'))
(root/'WORKING_TREE.patch').write_text(git('diff','--binary','--','.',':(exclude)data',':(exclude).env'))
# Private configuration is deliberately not copied. Scan every packaged file for
# actual configured secrets, without printing their values.
secrets=[]
for line in (repo/'.env').read_text().splitlines():
 m=re.match(r'\s*([A-Z_]+)\s*=\s*(.*)',line)
 if m and re.search(r'KEY|PASSWORD|SECRET|DATABASE_URL|TOKEN',m[1]):
  value=m[2].strip().strip('"\'')
  if len(value)>8 and value not in ['yuzeeadmin@2026','yuzee-lab-secret-2026']:secrets.append(value.encode())
hits=[]
for f in root.rglob('*'):
 if f.is_file():
  data=f.read_bytes()
  if any(s in data for s in secrets):hits.append(str(f.relative_to(root)))
if hits:raise RuntimeError('Private configuration found in package files; review before delivery: '+', '.join(hits))
manifest={'created':datetime.datetime.now(datetime.timezone.utc).isoformat(),'project':'Yuzee AI Lab','snapshot':'Current working tree including uncommitted and untracked source','baseCommit':git('rev-parse','HEAD').strip(),'entryDocument':'START_HERE.md','environmentTemplate':'CONFIGURATION.example.env','continuationBrief':'NEXT_ACCOUNT_START.md','sourceFilesCopied':len(included),'excluded':excluded,'secretScan':{'configuredSecretsChecked':len(secrets),'matches':0,'note':'Exact-value scan, not a guarantee against every possible unknown secret. Development default credentials remain in source and must be replaced by private environment configuration.'},'externalDependencies':['Warehouse database training_gov.db (not included)','Separate warehouse dashboard project (not included)','Receiving account Gemini API credentials/credits','Node and npm dependencies'],'testReport':'project/Yuzee-AI-Lab/output/prompt-pack-40/2026-09-20/RESULTS.md'}
(root/'PACKAGE-MANIFEST.json').write_text(json.dumps(manifest,indent=2))
print(json.dumps({'staging':str(root),'filesCopied':len(included),'excludedEntries':len(excluded),'secretMatches':len(hits)},indent=2))
