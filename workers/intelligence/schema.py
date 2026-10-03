"""Versioned allowlist for the intelligence export; never arbitrary warehouse columns."""
EVIDENCE = "confidence_score method source_name scope period".split()
TABLES = {
    "timesfm_series_observation": "series_id period value source_table quality_score".split(),
    "live_courses": "id course_name national_code institution_id course_type".split(),
    "live_institutions": "id rto_code legal_name state city home_region_key".split(),
    "canonical_occupation": "anzsco_code anzsco_title".split(),
    "provider_course_edge": "edge_id rto_code national_code delivery_state delivery_mode is_active".split() + EVIDENCE,
    "course_occupation_edge": "edge_id national_code anzsco_code anzsco_title".split() + EVIDENCE,
    "course_skill_edge": "edge_id national_code skill_id skill_name skill_type unit_code".split() + EVIDENCE,
    "employer_job_edge": "edge_id job_id employer_name anzsco_code archetype_name region_key state_code posted_at is_active".split() + EVIDENCE,
    "region_demand_edge": "edge_id region_key anzsco_code active_jobs new_jobs_30d employer_count".split() + EVIDENCE,
    "course_job_match_edge": "edge_id national_code job_id anzsco_code overlap_score region_key state_code".split() + EVIDENCE,
    "provider_competitor_edge": "edge_id rto_code_a rto_code_b overlap_count distance_km overlap_pct".split() + EVIDENCE,
}

# V1 remains readable so previously accepted exports are not silently reinterpreted.
# V2 restores the source warehouse's curated mappings and named regional/O*NET paths.
TABLES_V2 = TABLES | {
    "course_occupation_map": "id qualification_code occupation_code occupation_name occupation_label match_method match_confidence is_primary shared_occupation shared_across_course_count status evidence source mapped_at".split(),
    "region_spine": "region_key tier name parent_key state".split(),
    "onet_occupation": "job_id job_title career_category description source".split(),
    "onet_job_skill": "id job_id skill_name skill_desc enrichment_status source confidence".split(),
    "onet_job_subject": "id job_id subject_name subject_desc source".split(),
    "onet_anzsco_crosswalk": "job_id anzsco_code anzsco_title method confidence created_at".split(),
    "occupation_related": "id from_job_id to_occupation_ref resolved_to resolved_kind method confidence".split(),
}
# Explicit SOC identities are separate from the legacy named O*NET identities.
TABLES_V3 = TABLES_V2 | {"dim_archetype": "soc_code title source".split()}
CONTRACTS = {"yuzee-intelligence-input-v1": TABLES, "yuzee-intelligence-input-v2": TABLES_V2,
             "yuzee-intelligence-input-v3": TABLES_V3}
