export default function Loading() {
  return (
    <div role="status" aria-label="Loading buyer" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="skel" style={{ height: 28, width: 320 }} />
      <div className="skel" style={{ height: 120 }} />
      <div className="skel" style={{ height: 260 }} />
    </div>
  );
}
