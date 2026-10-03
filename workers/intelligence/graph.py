"""Non-destructive RDS projection. Existing labels/relationships are never changed.

A fact preserves one source row, its subject and object, including scope and period.
Readers follow the READY release pointer. Interrupted builds can be replayed.
"""
import argparse
import collections
import hashlib
import json
import os
import uuid
from contextlib import contextmanager
from pathlib import Path
from common import digest, now, read_bundle, records, write_json, bundle_identity
from forecast_contract import validate_forecast

VERSION = "warehouse-graph-v2"
EXTENDED_VERSION = "warehouse-graph-v3"
SOC_VERSION = "warehouse-graph-v4"

def projection_version(manifest):
    return {"yuzee-intelligence-input-v1":VERSION,"yuzee-intelligence-input-v2":EXTENDED_VERSION,
            "yuzee-intelligence-input-v3":SOC_VERSION}[manifest['format']]


def supplemental_endpoints(table, row):
    """Keep vocabulary namespaces separate; a crosswalk is evidence, not identity."""
    if table == "course_occupation_map":
        if row["status"] != "MAPPED":
            raise ValueError("UNMAPPED_COURSE")
        return "MAPS_TO_OCCUPATION", entity("Qualification", row["qualification_code"]), entity("Occupation", row["occupation_code"], row["occupation_label"] or row["occupation_name"])
    if table == "region_spine":
        return "WITHIN_REGION", entity("RegionKey", row["region_key"], row["name"]), entity("RegionKey", row["parent_key"])
    if table == "onet_anzsco_crosswalk":
        return "CROSSWALKS_TO", entity("ONetOccupation", row["job_id"]), entity("Occupation", row["anzsco_code"], row["anzsco_title"])
    if table == "occupation_related":
        if row["resolved_kind"] not in ("ONET_ROLE", "ANZSCO") or not row["resolved_to"]:
            raise ValueError("UNRESOLVED_RELATED_OCCUPATION")
        return "RELATED_OCCUPATION", entity("ONetOccupation", row["from_job_id"]), entity("ONetOccupation" if row["resolved_kind"] == "ONET_ROLE" else "Occupation", row["resolved_to"], row["to_occupation_ref"])
    if table in ("onet_job_skill", "onet_job_subject"):
        field = "skill" if table == "onet_job_skill" else "subject"
        name = row[field + "_name"]
        if not name or not name.strip():
            raise ValueError("MISSING_VOCABULARY_NAME")
        target = entity("ONetSkill" if field == "skill" else "ONetSubject", key("onet", field, name.strip().casefold()), name)
        return "USES_ONET_SKILL" if field == "skill" else "USES_ONET_SUBJECT", entity("ONetOccupation", row["job_id"]), target
    raise ValueError("Unsupported supplemental table")


def key(*parts):
    return hashlib.sha256(json.dumps(parts, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()


def entity(kind, source_id, name=None):
    if source_id is None or not str(source_id).strip():
        raise ValueError("MISSING_ENTITY_KEY")
    return {"entityType": kind, "sourceId": str(source_id), "name": str(name or source_id)}


def source_properties(properties):
    # A source table's ordinary `id` must never replace the graph's namespaced ID.
    result = {k: v for k, v in properties.items() if v is not None and k != "id"}
    if properties.get("id") is not None:
        result["sourceRecordId"] = properties["id"]
    return result


def edge_endpoints(table, row):
    if table == "provider_course_edge":
        return "OFFERS_QUALIFICATION", entity("ProviderRegistration", row["rto_code"]), entity("Qualification", row["national_code"])
    if table == "course_skill_edge":
        return "REQUIRES_SKILL", entity("Qualification", row["national_code"]), entity("Skill", row["skill_id"], row["skill_name"])
    if table == "course_occupation_edge":
        return "MAPS_TO_OCCUPATION", entity("Qualification", row["national_code"]), entity("Occupation", row["anzsco_code"], row["anzsco_title"])
    if table == "employer_job_edge":
        # These rows do not carry an authoritative company ID. Do not claim a canonical company.
        name = row["employer_name"]
        if not name:
            raise ValueError("MISSING_EMPLOYER_NAME")
        mention = key(row["source_name"], row["state_code"], name)
        target = entity("Occupation", row["anzsco_code"]) if row["anzsco_code"] else entity("JobArchetype", row["archetype_name"])
        return "OBSERVED_EMPLOYER_DEMAND", entity("EmployerMention", mention, name), target
    if table == "region_demand_edge":
        return "OBSERVED_REGIONAL_DEMAND", entity("RegionKey", row["region_key"]), entity("Occupation", row["anzsco_code"])
    if table == "course_job_match_edge":
        target = entity("Occupation", row["anzsco_code"]) if row["anzsco_code"] else entity("HistoricalJobReference", row["job_id"])
        return "MATCHES_WORK", entity("Qualification", row["national_code"]), target
    if table == "provider_competitor_edge":
        return "OVERLAPS_OFFERINGS", entity("ProviderRegistration", row["rto_code_a"]), entity("ProviderRegistration", row["rto_code_b"])
    raise ValueError("Unsupported relationship table")


def connection():
    from neo4j import GraphDatabase
    return GraphDatabase.driver(os.environ["NEO4J_URI"], auth=(os.environ["NEO4J_USER"], os.environ["NEO4J_PASSWORD"]),
                                connection_timeout=10, max_transaction_retry_time=15, max_connection_pool_size=2)


def q(session, query, **params):
    from neo4j import Query
    return session.run(Query(query, timeout=60), **params)


@contextmanager
def writer_lease(session):
    """One database writer; every write rechecks ownership inside its transaction."""
    token = str(uuid.uuid4())
    lease = q(session, """MERGE(l:WarehouseBuildLock {id:'projection'})
        SET l.tick=coalesce(l.tick,0)+1 WITH l
        WHERE l.owner IS NULL OR l.expiresAt < timestamp()
        SET l.owner=$token,l.expiresAt=timestamp()+900000 RETURN l.owner AS owner""", token=token).single()
    if not lease:
        raise ValueError("Another graph writer holds the lease")
    def mutate(query, **params):
        with session.begin_transaction(timeout=60) as tx:
            owned = tx.run("""MATCH(l:WarehouseBuildLock {id:'projection'})
                SET l.tick=coalesce(l.tick,0)+1 WITH l
                WHERE l.owner=$token AND l.expiresAt>=timestamp()
                SET l.expiresAt=timestamp()+900000 RETURN l.owner AS owner""", token=token).single()
            if not owned:
                raise ValueError("Graph writer lease expired or was replaced")
            rows = [r.data() for r in tx.run(query, **params)]
            tx.commit()
            return rows
    try:
        yield mutate
    finally:
        q(session, "MATCH(l:WarehouseBuildLock {id:'projection'}) WHERE l.owner=$token REMOVE l.owner,l.expiresAt", token=token).consume()


def reconcile(session, generation, expected):
    expected = {table: count for table, count in expected.items() if count}
    actual = {r["table"]: r["n"] for r in q(session,
        "MATCH(f:WarehouseFact {generation:$g}) RETURN f.sourceTable AS table,count(*) AS n", g=generation)}
    if actual != dict(expected):
        raise ValueError("Graph source-row counts do not reconcile")
    bad = q(session, """MATCH(f:WarehouseFact {generation:$g})
        OPTIONAL MATCH(f)-[:WH_SUBJECT]->(a) WITH f,count(a) AS subjects
        OPTIONAL MATCH(f)-[:WH_OBJECT]->(b) WITH f,subjects,count(b) AS objects
        WHERE subjects<>1 OR objects<>1 RETURN count(*) AS n""", g=generation).single()["n"]
    if bad:
        raise ValueError("Incomplete graph fact endpoints")
    return 2 * sum(expected.values())


def project(bundle, report_path, forecast_path=None, *, stage_only=False):
    manifest = read_bundle(bundle)
    forecast = None
    forecast_sha = "none"
    if forecast_path:
        forecast = json.loads(Path(forecast_path).read_text())
        validate_forecast(forecast, bundle, manifest)
        forecast_sha = digest(forecast_path)
    version = projection_version(manifest)
    generation = key(version, bundle_identity(manifest), forecast["content_sha256"] if forecast else "none")
    report = {"generation": generation, "source_release": manifest["source_release"], "version": version,
              "input_content_sha256": bundle_identity(manifest),
              "forecast_content_sha256": forecast["content_sha256"] if forecast else "none",
              "forecast_artifact_sha256": forecast_sha, "started_at": now(), "status": "BUILDING", "facts_by_table": {}, "quarantine": {},
              "excluded_legacy_forecasts": True, "original_graph_modified": False}
    driver = connection()
    pending, expected, rejected = [], collections.Counter(), collections.Counter()
    with driver, driver.session(database=os.getenv("NEO4J_DATABASE", "neo4j")) as session:
        driver.verify_connectivity()
        for label in ("WarehouseEntity", "WarehouseFact", "WarehouseRelease", "WarehousePointer", "WarehouseBuildLock"):
            q(session, f"CREATE CONSTRAINT {label.lower()}_id IF NOT EXISTS FOR (n:{label}) REQUIRE n.id IS UNIQUE").consume()
        q(session, "CREATE INDEX warehouse_entity_lookup IF NOT EXISTS FOR (n:WarehouseEntity) ON (n.generation,n.entityType,n.sourceId)").consume()
        q(session, "CREATE INDEX warehouse_fact_generation IF NOT EXISTS FOR (n:WarehouseFact) ON (n.generation)").consume()
        with writer_lease(session) as mutate:
            pointer = q(session, ("MATCH" if stage_only else "MERGE") + "(p:WarehousePointer {id:'current'}) RETURN p.generation AS generation").single()
            prior = pointer["generation"] if pointer else None
            existing = q(session, "MATCH(r:WarehouseRelease {id:$g,status:'READY'}) RETURN r.reportJson AS report", g=generation).single()
            if existing:
                if prior != generation and not stage_only:
                    raise ValueError("This input is an older READY generation; use an explicit operator rollback")
                saved = json.loads(existing["report"])
                reconcile(session, generation, saved["facts_by_table"])
                saved |= {"reused": True, "checked_at": now(), "requested_forecast_artifact_sha256": forecast_sha}
                write_json(report_path, saved)
                return saved

            mutate("MERGE (r:WarehouseRelease {id:$generation}) ON CREATE SET r.status='BUILDING',r.sourceRelease=$release,r.startedAt=$started",
              generation=generation, release=manifest["source_release"], started=report["started_at"])

            def add_id(e):
                return e | {"id": key(generation, e["entityType"], e["sourceId"]), "generation": generation}

            def flush():
                if not pending:
                    return
                mutate("""UNWIND $rows AS row
                  MERGE (a:WarehouseEntity {id:row.a.id}) ON CREATE SET a += row.a
                  MERGE (b:WarehouseEntity {id:row.b.id}) ON CREATE SET b += row.b
                  MERGE (f:WarehouseFact {id:row.id}) SET f += row.properties
                  MERGE (f)-[:WH_SUBJECT]->(a) MERGE (f)-[:WH_OBJECT]->(b)""", rows=pending)
                pending.clear()

            def add_fact(table, ordinal, relation, a, b, properties):
                pending.append({"id": key(generation, table, ordinal), "a": add_id(a), "b": add_id(b),
                                "properties": source_properties(properties) |
                                 {"generation": generation, "sourceTable": table, "sourceOrdinal": ordinal,
                                  "relation": relation, "sourceRelease": manifest["source_release"]}})
                expected[table] += 1
                if len(pending) >= 500:
                    flush()

            def seed(items):
                for start in range(0, len(items), 500):
                    mutate("UNWIND $rows AS row MERGE(n:WarehouseEntity {id:row.id}) SET n += row",
                      rows=[add_id(e) for e in items[start:start+500]])

            institutions = list(records(bundle, "live_institutions"))
            seed([entity("Institution", r["id"], r["legal_name"]) for r in institutions])
            seed([entity("ProviderRegistration", r["rto_code"], r["legal_name"]) for r in institutions if r["rto_code"]])
            for r in institutions:
                if r["rto_code"]:
                    add_fact("institution_registration", r["source_ordinal"], "REGISTERED_AS", entity("Institution",r["id"]),
                             entity("ProviderRegistration",r["rto_code"]), {"state": r["state"], "city": r["city"]})
            seed([entity("Occupation", r["anzsco_code"], r["anzsco_title"]) for r in records(bundle,"canonical_occupation")])
            # Keep university/provider-specific course offerings distinct from shared national qualifications.
            known_institutions = {str(r["id"]) for r in institutions}
            courses = list(records(bundle, "live_courses"))
            seed([entity("CourseOffering",r["id"],r["course_name"]) for r in courses])
            for r in courses:
                offering = entity("CourseOffering", r["id"], r["course_name"])
                if r["national_code"]:
                    add_fact("course_qualification",r["source_ordinal"],"LEADS_TO",offering,
                             entity("Qualification",r["national_code"],r["course_name"]),{"course_type":r["course_type"]})
                if str(r["institution_id"]) in known_institutions:
                    add_fact("course_institution",r["source_ordinal"],"DELIVERED_BY",offering,entity("Institution",r["institution_id"]),{})
            flush()
            print("Course and institution identities projected", flush=True)
            if manifest["format"] in ("yuzee-intelligence-input-v2", "yuzee-intelligence-input-v3"):
                regions = list(records(bundle, "region_spine"))
                region_keys = {r["region_key"] for r in regions}
                seed([entity("RegionKey", r["region_key"], r["name"]) | {k: r[k] for k in ("tier", "state") if r[k] is not None} for r in regions])
                occupations = list(records(bundle, "onet_occupation"))
                onet_ids = {r["job_id"] for r in occupations}
                seed([entity("ONetOccupation", r["job_id"], r["job_title"]) for r in occupations])
                if manifest['format'] == 'yuzee-intelligence-input-v3':
                    from occupation_identity import title_links
                    import re
                    archetypes = list(records(bundle, 'dim_archetype'))
                    seed([entity('SOCOccupation',r['soc_code'],r['title']) | {'source':r['source'] or 'unknown'}
                          for r in archetypes if isinstance(r['soc_code'],str) and re.fullmatch(r'\d{2}-\d{4}\.\d{2}',r['soc_code'])])
                    links, unmapped = title_links(archetypes, occupations)
                    for link in links:
                        add_fact('soc_onet_title_link',link['source_ordinal'],'TITLE_MATCHES_ONET',
                                 entity('SOCOccupation',link['soc_code']),entity('ONetOccupation',link['job_id']),
                                 {'method':link['method'],'source_name':link['source'],
                                  'scope':'occupational descriptions; derived title link, not verified identity equivalence'})
                    report['soc_identity'] = {'source_rows':len(archetypes),'derived_title_links':len(links),
                                              'unlinked':len(unmapped),'identity_merges':0}
                for table in ("course_occupation_map", "region_spine", "onet_job_skill", "onet_job_subject", "onet_anzsco_crosswalk", "occupation_related"):
                    for row in records(bundle, table):
                        if table == "region_spine" and not row["parent_key"]:
                            continue  # The national root has no parent; it is still seeded.
                        try:
                            if table == "region_spine" and row["parent_key"] not in region_keys:
                                raise ValueError("UNKNOWN_PARENT_REGION")
                            if table.startswith("onet_") and row["job_id"] not in onet_ids:
                                raise ValueError("UNKNOWN_ONET_OCCUPATION")
                            if table == "occupation_related" and (row["from_job_id"] not in onet_ids or
                                (row["resolved_kind"] == "ONET_ROLE" and row["resolved_to"] not in onet_ids)):
                                raise ValueError("UNKNOWN_ONET_OCCUPATION")
                            relation, a, b = supplemental_endpoints(table, row)
                        except ValueError as exc:
                            rejected[table + ":" + str(exc)] += 1
                            continue
                        evidence = row | {"method": row.get("match_method", row.get("method", "SOURCE_MAPPING")),
                            "confidence_score": row.get("match_confidence", row.get("confidence")),
                            "source_name": row.get("source", "region_spine" if table == "region_spine" else table),
                            "scope": "QUALIFICATION" if table == "course_occupation_map" else row["tier"] if table == "region_spine" else "VOCABULARY",
                            "period": row.get("mapped_at", row.get("created_at")), "historicalEvidence": False}
                        add_fact(table, row["source_ordinal"], relation, a, b, evidence)
                    flush()
                    print(f"Projected {table}: {expected[table]}", flush=True)
            for table in manifest["tables"]:
                if not table.endswith("_edge"):
                    continue
                for row in records(bundle, table):
                    try:
                        relation, a, b = edge_endpoints(table, row)
                    except ValueError as exc:
                        rejected[table + ":" + str(exc)] += 1
                        continue
                    # Past demand is evidence with its original period, never a current vacancy claim.
                    add_fact(table,row["source_ordinal"],relation,a,b,row | {"historicalEvidence": True})
                flush()
                print(f"Projected {table}: {expected[table]}", flush=True)
            if forecast:
                for i, row in enumerate(sorted(forecast["results"], key=lambda r: r["series_id"])):
                    add_fact("forecast_run", i + 1, "HAS_FORECAST", entity("StateOrNation", row["geography"]),
                             entity("ForecastSeries", row["series_id"]),
                             {"method": row["method"], "scope": row["scope"], "metric": row["metric"],
                              "period": row["last_period"], "freshness": row["freshness"],
                              "currentAdviceEligible": row["current_advice_eligible"], "forecastRunSha": forecast_sha,
                              "forecastContentSha": forecast["content_sha256"],
                              "forecastThrough": row["forecast_points"][-1]["period"],
                              "modelId": forecast["model"]["model_id"], "modelRevision": forecast["model"]["model_revision"],
                              "forecastJson": json.dumps(row, allow_nan=False)})
                flush()
            links = reconcile(session, generation, expected)
            report |= {"status":"STAGED" if stage_only else "READY", "completed_at":now(), "facts_by_table":dict(expected),
                       "facts":sum(expected.values()), "endpoint_links":links, "quarantine":dict(rejected)}
            if stage_only:
                # Reconcile a candidate without changing the release served by Java.
                mutate("""MATCH(r:WarehouseRelease {id:$g}) SET r.status='STAGED',
                    r.completedAt=$completed,r.facts=$facts,r.forecastContentSha=$forecastContent,
                    r.reportJson=$report RETURN r.id AS generation""",
                    g=generation,completed=report["completed_at"],facts=report["facts"],
                    forecastContent=report["forecast_content_sha256"],report=json.dumps(report))
                write_json(report_path,report)
                return report
            # One atomic pointer update only after the whole candidate has reconciled.
            published = mutate( """MATCH(p:WarehousePointer {id:'current'}) SET p.lock=coalesce(p.lock,0)+1
                WITH p WHERE coalesce(p.generation,'')=coalesce($prior,'') OR p.generation=$g
                MATCH(r:WarehouseRelease {id:$g}) SET r.status='READY',r.completedAt=$completed,r.facts=$facts,
                    r.forecastContentSha=$forecastContent,r.reportJson=$report
                SET p.generation=$g,p.sourceRelease=$release,p.updatedAt=$completed RETURN r.id AS generation""",
              prior=prior,g=generation,completed=report["completed_at"],facts=report["facts"],release=manifest["source_release"],forecastContent=report["forecast_content_sha256"],report=json.dumps(report))
            if not published:
                raise ValueError("A different graph was published during this build; refusing to replace it")
            write_json(report_path, report)

    return report


def course_connections(code, limit=20):
    if not code or len(code)>80 or not 1<=limit<=50:
        raise ValueError("Invalid query bounds")
    with connection() as driver, driver.session(database=os.getenv("NEO4J_DATABASE","neo4j"),default_access_mode="READ") as s:
        pointer = q(s,"MATCH(p:WarehousePointer {id:'current'}) MATCH(r:WarehouseRelease {id:p.generation,status:'READY'}) RETURN r.id AS generation,r.sourceRelease AS release").single()
        if not pointer:
            return {"status":"NOT_READY", "connections":[]}
        generation=pointer["generation"]
        rows = q(s,"""MATCH(c:WarehouseEntity {id:$id})<-[:WH_SUBJECT|WH_OBJECT]-(f:WarehouseFact)
            MATCH(f)-[:WH_SUBJECT|WH_OBJECT]->(other:WarehouseEntity) WHERE other.id<>c.id
            RETURN f.relation AS relation,other.entityType AS entityType,other.sourceId AS sourceId,other.name AS name,
                   f.scope AS scope,f.period AS period,f.method AS method,f.confidence_score AS sourceConfidence,
                   f.region_key AS regionKey,coalesce(f.state_code,f.delivery_state) AS state,
                   f.sourceOrdinal AS sourceOrdinal,f.historicalEvidence AS historicalEvidence
            ORDER BY relation,entityType,sourceId,sourceOrdinal LIMIT $limit""",id=key(generation,"Qualification",code),limit=limit)
        return {"status":"READY","source_release":pointer["release"],"generation":generation,
                "connections":[r.data() for r in rows]}


if __name__ == "__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--bundle")
    p.add_argument("--report")
    p.add_argument("--forecasts")
    p.add_argument("--course")
    p.add_argument("--stage-only",action="store_true",help="Reconcile candidate; preserve the currently served graph")
    a=p.parse_args()
    if a.course:
        print(json.dumps(course_connections(a.course),indent=2))
    elif a.bundle and a.report:
        project(a.bundle,a.report,a.forecasts,stage_only=a.stage_only)
    else:
        p.error("Provide --course or --bundle and --report")
