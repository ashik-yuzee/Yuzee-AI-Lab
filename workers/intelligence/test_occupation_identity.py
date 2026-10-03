import unittest
from occupation_identity import title_links
class IdentityTests(unittest.TestCase):
    def setUp(self):
        self.soc=[dict(soc_code='35-2014.00',title='Cooks, Restaurant',source='ONET_28.0',source_ordinal=1)]
        self.onet=[dict(job_id='cooks_restaurant',job_title='Cooks, Restaurant')]
    def test_identity_preserved(self):
        links,rejected=title_links(self.soc,self.onet)
        self.assertEqual(links[0]['job_id'],'cooks_restaurant');self.assertEqual(rejected,[])
        self.assertFalse(links[0]['identity_equivalence'])
    def test_ambiguous_title_has_no_link(self):self.assertEqual(title_links(self.soc,self.onet*2)[0],[])
    def test_ambiguous_code_has_no_link(self):self.assertEqual(title_links(self.soc*2,self.onet)[0],[])
    def test_fuzzy_title_does_not_match(self):self.assertEqual(title_links(self.soc,[self.onet[0]|{'job_title':'Cook'}])[0],[])
    def test_code_is_not_an_anzsco_code(self):self.assertEqual(title_links([self.soc[0]|{'soc_code':'351411'}],self.onet)[0],[])
if __name__=='__main__':unittest.main()
