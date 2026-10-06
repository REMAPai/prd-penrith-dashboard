-- The dashboard shows real data only. Remove the invented pipeline rows seeded earlier (events cascade).
delete from pipeline_sites where is_sample = true;
