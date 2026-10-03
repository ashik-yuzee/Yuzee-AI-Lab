"""Accept an already reconciled candidate for explicitly pinned Java readers.

Does not move WarehousePointer/current or deploy Java. The deployment process must
verify the immutable forecast artifact and canary before routing users to it.
"""
import argparse,json,os,re
from pathlib import Path
from common import read_bundle,bundle_identity,digest,now,write_json
from forecast_contract import validate_forecast
from graph import connection,q,writer_lease,reconcile,key,projection_version


def accept(bundle,report_path,forecast_path=None):
    manifest=read_bundle(bundle);content='none';artifact='none'
    if forecast_path:
        forecast=json.loads(Path(forecast_path).read_text())
        validate_forecast(forecast,bundle,manifest)
        content=forecast['content_sha256'];artifact=digest(forecast_path)
    generation=key(projection_version(manifest),bundle_identity(manifest),content)
    if os.getenv('NEO4J_AUTH') and not os.getenv('NEO4J_PASSWORD'):
        user,separator,password=os.environ['NEO4J_AUTH'].partition('/')
        if not separator or not password:raise ValueError('Invalid graph authentication reference')
        os.environ.update(NEO4J_USER=user,NEO4J_PASSWORD=password)
    with connection() as driver,driver.session(database=os.getenv('NEO4J_DATABASE','neo4j')) as session:
        driver.verify_connectivity()
        with writer_lease(session) as mutate:
            existing=q(session,"""MATCH(r:WarehouseRelease {id:$g})
                WHERE r.status IN ['STAGED','READY'] RETURN r.status AS status,r.sourceRelease AS release,
                r.forecastContentSha AS content,r.reportJson AS report""",g=generation).single()
            if not existing:raise ValueError('No reconciled candidate for these exact inputs')
            report=json.loads(existing['report'])
            if (existing['release']!=manifest['source_release'] or existing['content']!=content
                or report.get('generation')!=generation or report.get('input_content_sha256')!=bundle_identity(manifest)
                or report.get('forecast_content_sha256')!=content):
                raise ValueError('Graph candidate identity mismatch')
            reconcile(session,generation,report['facts_by_table'])
            accepted_at=now()
            if existing['status']=='STAGED':
                report.update(status='READY',accepted_at=accepted_at,acceptance_mode='PINNED_READER')
                rows=mutate("""MATCH(r:WarehouseRelease {id:$g,status:'STAGED'})
                    SET r.status='READY',r.acceptedAt=$at,r.reportJson=$report RETURN r.id AS generation""",
                    g=generation,at=accepted_at,report=json.dumps(report))
                if not rows:raise ValueError('Candidate changed before acceptance')
    receipt={'status':'ACCEPTED_FOR_PINNED_READER','generation':generation,
             'source_release':manifest['source_release'],'forecast_sha256':artifact,
             'forecast_content_sha256':content,'checked_at':now(),'serving_pointer_changed':False,
             'java_deployment_verified':False}
    write_json(report_path,receipt);return receipt


def activate(bundle,report_path,forecast_path,expected_current):
    """Explicit compare-and-swap for legacy readers, after Java canary acceptance.

    Caller must supply the observed old generation; 'none' is only for first use.
    This operation does not certify that a Java rollout has happened.
    """
    if expected_current!='none' and not re.fullmatch('[a-f0-9]{64}',expected_current):
        raise ValueError('Expected current generation must be an observed fingerprint or none')
    receipt=accept(bundle,Path(report_path).with_suffix('.accepted.json'),forecast_path)
    generation=receipt['generation'];prior=None if expected_current=='none' else expected_current
    with connection() as driver,driver.session(database=os.getenv('NEO4J_DATABASE','neo4j')) as session:
        with writer_lease(session) as mutate:
            updated=mutate("""MERGE(p:WarehousePointer {id:'current'}) SET p.lock=coalesce(p.lock,0)+1
                WITH p WHERE coalesce(p.generation,'')=coalesce($prior,'')
                MATCH(r:WarehouseRelease {id:$g,status:'READY'})
                SET p.generation=$g,p.sourceRelease=r.sourceRelease,p.updatedAt=$at RETURN p.generation AS generation""",
                prior=prior,g=generation,at=now())
            if not updated:raise ValueError('Serving generation changed; inspect it before activation')
    receipt.update(status='SERVING_POINTER_ACTIVATED',previous_generation=prior,serving_pointer_changed=prior!=generation)
    write_json(report_path,receipt);return receipt


def main():
    p=argparse.ArgumentParser();p.add_argument('--bundle',required=True);p.add_argument('--report',required=True)
    p.add_argument('--forecasts');p.add_argument('--activate',action='store_true')
    p.add_argument('--expected-current');a=p.parse_args();os.umask(0o077)
    if a.activate != bool(a.expected_current):p.error('--activate requires --expected-current and vice versa')
    print(json.dumps(activate(a.bundle,a.report,a.forecasts,a.expected_current) if a.activate else accept(a.bundle,a.report,a.forecasts)))

if __name__=='__main__':main()
