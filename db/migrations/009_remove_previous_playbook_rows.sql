-- 009 Remove the rows the Development Playbook showed before the weekly feed: invented rows, the 23 Jul and 7 Oct source observations
-- and the REA land listings. Approved in chat by the project owner on 2026-10-09: the page now shows only the Developer_playbook sheet.
-- Targeted by is_sample, site_kind and source, so rows written by the weekly feed (source "NSW Planning Portal") are never touched.
-- Stage history for these rows goes with them (pipeline_events cascades). Idempotent: a second run deletes nothing.

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
