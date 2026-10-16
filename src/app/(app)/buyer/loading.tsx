export default function Loading() {
  return (
    <div role="status" aria-label="Loading buyers" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="skel" style={{ height: 28, width: 260 }} />
      <div className="skel" style={{ height: 36, width: 420 }} />
      <div className="skel" style={{ height: 240 }} />
    </div>
  );
}
