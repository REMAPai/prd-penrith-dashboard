// Fail open: if the dashboard store is unreachable we still answer (the static-data guard
// upstream remains), but a confirmed duplicate claim stops the run.
const src = $('Safe to Proceed?').item.json;
const r = $json;
const status = r.statusCode;
const duplicate = status === 200 && r.body && r.body.claimed === false;
return {
  json: {
    ...src,
    claimed: !duplicate,
    claimVerified: status === 200,
    blockReasons: duplicate
      ? [...(src.blockReasons || []), 'Duplicate trigger: this message was already answered']
      : (src.blockReasons || [])
  }
};
