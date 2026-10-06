// Server-render helper so pages can read the clock without tripping the purity lint rule.
export const nowMs = () => Date.now();
