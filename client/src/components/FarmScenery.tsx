/** Day-phase backdrop: a farmyard silhouette (fields, fence, barn, silo, haybales, scarecrow)
 * shown behind the table via GameScene. Unlike VillageSkyline (shared, recolored via
 * `currentColor`), this is day-only and fully self-colored, so no phase-swap layer is needed. */
export function FarmScenery() {
  return (
    <svg className="farm-svg" viewBox="0 0 800 260" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="farmFar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#aac988" />
          <stop offset="100%" stopColor="#8fae6a" />
        </linearGradient>
        <linearGradient id="farmMid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#84a85e" />
          <stop offset="100%" stopColor="#628040" />
        </linearGradient>
        <linearGradient id="farmNear" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#617f3f" />
          <stop offset="100%" stopColor="#425c29" />
        </linearGradient>
        <linearGradient id="farmBarn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c4503f" />
          <stop offset="100%" stopColor="#832a1f" />
        </linearGradient>
        <linearGradient id="farmSilo" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#d4d8df" />
          <stop offset="45%" stopColor="#b7bcc6" />
          <stop offset="100%" stopColor="#8d939f" />
        </linearGradient>
        <linearGradient id="farmHay" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#edc766" />
          <stop offset="100%" stopColor="#b8862a" />
        </linearGradient>
      </defs>

      {/* three ground layers, aerial perspective (far = lighter/cooler) */}
      <path d="M0,120 Q200,100 400,112 T800,104 L800,260 L0,260 Z" fill="url(#farmFar)" />
      <path d="M0,158 Q220,138 440,150 T800,144 L800,260 L0,260 Z" fill="url(#farmMid)" />
      <path d="M0,200 Q240,180 460,192 T800,186 L800,260 L0,260 Z" fill="url(#farmNear)" />

      {/* far tree line */}
      <g fill="#5a7a42" opacity={0.8}>
        <ellipse cx="60" cy="104" rx="20" ry="24" />
        <ellipse cx="88" cy="108" rx="16" ry="20" />
        <ellipse cx="112" cy="105" rx="18" ry="22" />
        <ellipse cx="660" cy="98" rx="18" ry="22" />
        <ellipse cx="686" cy="102" rx="16" ry="20" />
        <ellipse cx="712" cy="99" rx="20" ry="24" />
        <ellipse cx="740" cy="104" rx="14" ry="18" />
      </g>

      {/* full-width fence on the mid ridge, posts + double rail, no gaps */}
      <path d="M10,152 Q200,138 400,146 T790,140" stroke="#8a6a45" strokeWidth={4.5} fill="none" />
      <path d="M10,164 Q200,150 400,158 T790,152" stroke="#6b4d30" strokeWidth={4.5} fill="none" />
      <g fill="#5f4526">
        <rect x="8" y="134" width="7" height="36" rx="1" />
        <rect x="88" y="128" width="7" height="36" rx="1" />
        <rect x="168" y="124" width="7" height="36" rx="1" />
        <rect x="248" y="127" width="7" height="36" rx="1" />
        <rect x="328" y="131" width="7" height="36" rx="1" />
        <rect x="408" y="133" width="7" height="36" rx="1" />
        <rect x="488" y="130" width="7" height="36" rx="1" />
        <rect x="568" y="127" width="7" height="36" rx="1" />
        <rect x="648" y="124" width="7" height="36" rx="1" />
        <rect x="728" y="122" width="7" height="36" rx="1" />
        <rect x="786" y="121" width="7" height="36" rx="1" />
      </g>

      {/* tilled field with row texture, sitting flush on near ground */}
      <g stroke="#324420" strokeWidth={2} opacity={0.5}>
        <path d="M60,230 h90 M60,242 h90 M60,254 h90 M170,226 h100 M170,238 h100 M170,250 h100" fill="none" />
      </g>

      {/* dirt path leading to the barn door */}
      <path d="M420,260 Q470,220 520,196 L560,196 Q510,222 460,260 Z" fill="#9a7a4e" opacity={0.75} />

      {/* barn with plank lines, hayloft door, weathervane */}
      <g>
        <rect x="520" y="98" width="140" height="98" fill="url(#farmBarn)" />
        <g stroke="#7c2620" strokeWidth={1.2} opacity={0.55}>
          <path d="M535,98 v98 M550,98 v98 M565,98 v98 M580,98 v98 M595,98 v98 M610,98 v98 M625,98 v98 M640,98 v98 M655,98 v98" />
        </g>
        <path d="M512,98 L590,48 L668,98 Z" fill="#4a3428" />
        <path d="M512,98 L590,48 L668,98 Z" fill="none" stroke="#2e2018" strokeWidth={1.5} />
        <rect x="568" y="150" width="34" height="46" fill="#5a2019" />
        <path d="M568,150 L585,140 L602,150 Z" fill="#4a1a14" />
        <rect x="558" y="140" width="52" height="7" fill="#3a140f" />
        <rect x="580" y="70" width="20" height="18" fill="#2a1c14" />
        <line x1="590" y1="48" x2="590" y2="34" stroke="#2e2018" strokeWidth={2} />
        <path d="M590,34 l10,4 -10,4 z" fill="#2e2018" />
      </g>

      {/* silo with ribbing + conical cap */}
      <g>
        <rect x="668" y="118" width="38" height="78" rx="19" fill="url(#farmSilo)" />
        <ellipse cx="687" cy="118" rx="19" ry="10" fill="#e4e7ec" />
        <path d="M672,102 L687,78 L702,102 Z" fill="#8d939f" />
        <path d="M668,140 h38 M668,154 h38 M668,168 h38 M668,182 h38" stroke="#8b909c" strokeWidth={1.5} />
      </g>

      {/* two haybale stacks, shading + binding lines + cast shadows */}
      <g>
        <ellipse cx="130" cy="232" rx="62" ry="10" fill="#2c3f1e" opacity={0.45} />
        <g fill="url(#farmHay)" stroke="#8a6420" strokeWidth={1.5}>
          <ellipse cx="108" cy="222" rx="25" ry="20" />
          <ellipse cx="154" cy="226" rx="23" ry="18" />
          <ellipse cx="130" cy="204" rx="22" ry="17" />
        </g>
        <path d="M87,222 h42 M136,226 h38 M110,204 h42" stroke="#8a6420" strokeWidth={1.5} opacity={0.65} />

        <ellipse cx="330" cy="248" rx="34" ry="8" fill="#2c3f1e" opacity={0.4} />
        <g fill="url(#farmHay)" stroke="#8a6420" strokeWidth={1.3}>
          <ellipse cx="318" cy="240" rx="18" ry="14" />
          <ellipse cx="346" cy="243" rx="16" ry="13" />
        </g>
      </g>

      {/* scarecrow */}
      <g stroke="#4a3424" strokeWidth={3} fill="none">
        <line x1="250" y1="260" x2="250" y2="196" />
        <line x1="228" y1="212" x2="272" y2="212" />
      </g>
      <g fill="#8a6a45">
        <circle cx="250" cy="188" r="9" />
      </g>
      <path d="M235,206 Q250,196 265,206 L262,236 Q250,244 238,236 Z" fill="#5f7a45" />

      {/* a couple of birds, simple strokes */}
      <g stroke="#3a4a2e" strokeWidth={2} fill="none" opacity={0.6}>
        <path d="M60,60 q8,-8 16,0 q8,-8 16,0" />
        <path d="M110,44 q6,-6 12,0 q6,-6 12,0" />
      </g>
    </svg>
  );
}
