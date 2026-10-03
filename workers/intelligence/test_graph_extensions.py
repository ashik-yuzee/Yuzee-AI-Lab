"""Acceptance contracts for restored warehouse paths, independent of live credentials."""
import json
import tempfile
import unittest
from pathlib import Path
from common import digest, read_bundle, write_json
from schema import CONTRACTS
from graph import supplemental_endpoints, source_properties

class GraphExtensionsTests(unittest.TestCase):
    def test_source_primary_key_cannot_replace_graph_identity(self):
        self.assertEqual(source_properties({'id':1,'method':'OFFICIAL','missing':None}),{'sourceRecordId':1,'method':'OFFICIAL'})

    def test_v1_and_v2_are_strict_separate_contracts(self):
        for version, tables in CONTRACTS.items():
            with tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp)
                entries = {}
                for table, fields in tables.items():
                    f = root / (table + '.jsonl'); f.write_text('')
                    entries[table] = dict(fields=fields, rows=0, sha256=digest(f))
                manifest = dict(format=version,status='COMPLETE',source_release='a'*64,tables=entries)
                write_json(root/'manifest.json', manifest)
                self.assertEqual(read_bundle(root)['format'], version)
                manifest['format'] = next(v for v in CONTRACTS if v != version)
                write_json(root/'manifest.json', manifest)
                with self.assertRaisesRegex(ValueError, 'tables'): read_bundle(root)

    def test_curated_mapping_and_unmapped_row(self):
        row = dict(status='MAPPED',qualification_code='CPC30220',occupation_code='331212',occupation_label='Carpenter',occupation_name='Carpenters')
        relation, qualification, occupation = supplemental_endpoints('course_occupation_map',row)
        self.assertEqual((relation,qualification['sourceId'],occupation['name']),('MAPS_TO_OCCUPATION','CPC30220','Carpenter'))
        with self.assertRaisesRegex(ValueError,'UNMAPPED'): supplemental_endpoints('course_occupation_map',row|{'status':'DATA_INCOMPLETE'})

    def test_local_region_identity_is_not_replaced_with_state(self):
        relation, child, parent = supplemental_endpoints('region_spine',dict(region_key='215011388',name='Horsham',parent_key='21501',state='VIC'))
        self.assertEqual((relation,child['sourceId'],parent['sourceId']),('WITHIN_REGION','215011388','21501'))

    def test_onet_is_separate_from_anzsco(self):
        relation, onet, occupation = supplemental_endpoints('onet_anzsco_crosswalk',dict(job_id='carpenters',anzsco_code='331212',anzsco_title='Carpenter'))
        self.assertEqual((relation,onet['entityType'],occupation['entityType']),('CROSSWALKS_TO','ONetOccupation','Occupation'))

    def test_related_occupation_requires_resolved_taxonomy(self):
        row=dict(from_job_id='carpenters',resolved_to='plumbers',resolved_kind='ONET_ROLE',to_occupation_ref='Plumbers')
        relation,a,b=supplemental_endpoints('occupation_related',row)
        self.assertEqual((relation,b['entityType']),('RELATED_OCCUPATION','ONetOccupation'))
        with self.assertRaisesRegex(ValueError,'UNRESOLVED'):supplemental_endpoints('occupation_related',row|{'resolved_kind':None})

    def test_shared_onet_skill_identity_preserves_vocabulary_boundary(self):
        a = supplemental_endpoints('onet_job_skill',dict(job_id='one',skill_name='Active Listening'))
        b = supplemental_endpoints('onet_job_skill',dict(job_id='two',skill_name=' active listening '))
        self.assertEqual(a[2]['sourceId'],b[2]['sourceId'])
        self.assertEqual(a[2]['entityType'],'ONetSkill')
        with self.assertRaisesRegex(ValueError,'NAME'): supplemental_endpoints('onet_job_skill',dict(job_id='one',skill_name=' '))

if __name__ == '__main__': unittest.main()
