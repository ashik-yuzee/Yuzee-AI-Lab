from pathlib import Path
import hashlib,json,zipfile
root=Path('../deliverables/Yuzee-Account-Handover-2026-09-20');project=root/'project/Yuzee-AI-Lab'
required=['src/protocol/v1.3/Yuzee_Quiz_Counsellor_Training_v1.11.md','qa/objectives/source/Yuzee_316_Executable_Mini_Prompts_QA_Batch32_FINAL.xlsx','data/minilm-cache/Xenova/bge-small-en-v1.5/ea104dacec62c0de699686887e3f920caeb4f3e3/onnx/model_quantized.onnx','output/prompt-pack-40/2026-09-20/summary.json','package-lock.json']
for f in required:assert (project/f).is_file(),f
for f in ['.env','data/conversations.json','data/objective-preview','data/warehouse','node_modules']:assert not (project/f).exists(),f
manifest=json.loads((root/'PACKAGE-MANIFEST.json').read_text());manifest['build']='Passed npm run build on source snapshot; bundle size warnings remain';manifest['regression']='85 passed, zero failed';manifest['testStatus']='141 baseline executions completed; 82 PASS, 28 FAIL, 31 NOT FULLY TESTED';(root/'PACKAGE-MANIFEST.json').write_text(json.dumps(manifest,indent=2))
files=[f for f in sorted(root.rglob('*')) if f.is_file() and f.name!='FILE_HASHES.json']
hashes={str(f.relative_to(root)):hashlib.sha256(f.read_bytes()).hexdigest() for f in files};(root/'FILE_HASHES.json').write_text(json.dumps(hashes,indent=2))
zpath=root.with_suffix('.zip')
with zipfile.ZipFile(zpath,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for f in sorted(root.rglob('*')):
  if f.is_file():z.write(f,str(Path(root.name)/f.relative_to(root)))
with zipfile.ZipFile(zpath) as z:
 assert z.testzip() is None
 for name,expected in hashes.items():assert hashlib.sha256(z.read(root.name+'/'+name)).hexdigest()==expected,name
checksum=hashlib.sha256(zpath.read_bytes()).hexdigest();zpath.with_suffix('.zip.sha256').write_text(checksum+'  '+zpath.name+'\n')
checks={'archive':str(zpath.resolve()),'files':len(hashes)+1,'bytes':zpath.stat().st_size,'sha256':checksum,'zipIntegrity':'PASS','allFileHashes':'PASS','requiredFiles':'PASS','privateRuntimeExclusions':'PASS','configuredSecretMatches':manifest['secretScan']['matches']};(root.parent/'Yuzee-Account-Handover-2026-09-20.checks.json').write_text(json.dumps(checks,indent=2));print(json.dumps(checks,indent=2))
