delete from pipeline_sites
where is_sample = true
   or site_kind = 'listing'
   or source in ('PlanningAlerts', 'Planning Alerts (Penrith City Council)', 'REA');

-- These progress lines described data that is no longer loaded.
delete from progress_items
where project = 'Development Playbook'
  and text in (
    'Real DAs loaded into the pipeline',
    'Pipeline loaded with real DAs',
    'Real planning activity and land listings from the 7 Oct run loaded into the pipeline'
  );
