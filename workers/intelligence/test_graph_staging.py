"""Opt-in acceptance on an isolated loopback Neo4j, never the original graph."""
import hashlib,json,os,tempfile,unittest,uuid
from pathlib import Path
from unittest.mock import patch
from common import digest,write_json
from schema import TABLES
from graph import project
from accept_graph import accept,activate

@unittest.skipUnless(os.getenv('IVI_TEST_NEO4J_PORT'),'disposable Neo4j fixture not requested')
class GraphStagingAcceptance(unittest.TestCase):
    def test_staging_retry_and_failure_preserve_live_release(self):
        from neo4j import GraphDatabase
        def driver():return GraphDatabase.driver('bolt://127.0.0.1:'+os.environ['IVI_TEST_NEO4J_PORT'],auth=None)
        def pointer():
            with driver() as d,d.session() as s:
                return s.run("MATCH(p:WarehousePointer {id:'current'}) RETURN p.generation AS g").single()['g']
        def bundle(root,rid):
            root.mkdir();m={'format':'yuzee-intelligence-input-v1','status':'COMPLETE','source_release':rid,'tables':{}}
            for table,fields in TABLES.items():
                file=root/(table+'.jsonl');file.write_text('');count=0
                if table=='course_skill_edge':
                    row={f:None for f in fields}|{'source_ordinal':1,'national_code':'TEST001','skill_id':'skill1','skill_name':'Fixture skill'}
                    file.write_text(json.dumps(row)+'\n');count=1
                m['tables'][table]={'fields':fields,'sha256':digest(file),'rows':count}
            write_json(root/'manifest.json',m);return root
        with tempfile.TemporaryDirectory() as temp,patch('graph.connection',side_effect=driver):
            root=Path(temp)
            first=bundle(root/'first',hashlib.sha256(uuid.uuid4().bytes).hexdigest())
            second=bundle(root/'second',hashlib.sha256(uuid.uuid4().bytes).hexdigest())
            live=project(first,root/'live.json');self.assertEqual(pointer(),live['generation'])
            staged=project(second,root/'candidate.json',stage_only=True)
            self.assertEqual(staged['status'],'STAGED');self.assertEqual(staged['facts'],1)
            self.assertEqual(pointer(),live['generation'])
            with patch('graph.reconcile',side_effect=ValueError('simulated mismatch')):
                with self.assertRaises(ValueError):project(second,root/'failed.json',stage_only=True)
            self.assertEqual(pointer(),live['generation'])
            repeat=project(second,root/'repeat.json',stage_only=True)
            self.assertEqual(repeat['generation'],staged['generation']);self.assertEqual(pointer(),live['generation'])
            with patch('accept_graph.connection',side_effect=driver):
                accepted=accept(second,root/'accepted.json')
                self.assertEqual(accepted['status'],'ACCEPTED_FOR_PINNED_READER')
                self.assertEqual(pointer(),live['generation'])
                accept(second,root/'accepted-again.json')
                with patch('accept_graph.reconcile',side_effect=ValueError('broken endpoints')):
                    with self.assertRaises(ValueError):accept(second,root/'bad.json')
                self.assertEqual(pointer(),live['generation'])
            # Accepted candidates require explicit serving activation, never implicit rollback.
            with self.assertRaises(ValueError):project(second,root/'implicit-promotion.json')
            with patch('accept_graph.connection',side_effect=driver):
                with self.assertRaises(ValueError):activate(second,root/'wrong-current.json',None,'0'*64)
                self.assertEqual(pointer(),live['generation'])
                promoted=activate(second,root/'promoted.json',None,live['generation'])
            self.assertEqual(promoted['status'],'SERVING_POINTER_ACTIVATED')
            self.assertEqual(pointer(),promoted['generation'])
            project(first,root/'old-staged.json',stage_only=True)
            self.assertEqual(pointer(),promoted['generation'])
            with self.assertRaises(ValueError):project(first,root/'rollback.json')

if __name__=='__main__':unittest.main()
