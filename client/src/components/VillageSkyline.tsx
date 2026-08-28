/** Flat village/castle silhouette shared by the Night and Day scene banners — same buildings,
 * recolored per phase via CSS `currentColor` on the wrapping `.skyline-svg` class. */
export function VillageSkyline() {
  return (
    <svg className="skyline-svg" viewBox="0 0 800 140" preserveAspectRatio="none" aria-hidden="true">
      <rect x="30" y="90" width="60" height="50" />
      <path d="M25 90 L60 55 L95 90 Z" />

      <rect x="130" y="75" width="80" height="65" />
      <path d="M122 75 L170 35 L218 75 Z" />
      <rect x="190" y="40" width="10" height="35" />

      <rect x="320" y="40" width="40" height="100" />
      <path d="M315 40 L340 10 L365 40 Z" />
      <rect x="440" y="40" width="40" height="100" />
      <path d="M435 40 L460 10 L485 40 Z" />
      <rect x="360" y="68" width="80" height="72" />
      <rect x="362" y="58" width="12" height="12" />
      <rect x="386" y="58" width="12" height="12" />
      <rect x="410" y="58" width="12" height="12" />
      <rect x="426" y="58" width="12" height="12" />

      <rect x="520" y="80" width="70" height="60" />
      <path d="M512 80 L555 45 L598 80 Z" />

      <rect x="655" y="95" width="55" height="45" />
      <path d="M650 95 L682 65 L714 95 Z" />
    </svg>
  );
}
