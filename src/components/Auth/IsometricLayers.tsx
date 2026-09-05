import React from 'react'

export const IsometricLayers: React.FC<{ className?: string; size?: number }> = ({
  className = '',
  size = 200,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 240 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="layerGradTop" x1="20" y1="20" x2="220" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" stopOpacity="0.25" />
          <stop stopColor="#ffffff" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id="layerGradMid" x1="20" y1="60" x2="220" y2="140" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" stopOpacity="0.18" />
          <stop stopColor="#ffffff" stopOpacity="0.03" />
        </linearGradient>
        <linearGradient id="layerGradBottom" x1="20" y1="100" x2="220" y2="180" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" stopOpacity="0.12" />
          <stop stopColor="#ffffff" stopOpacity="0.02" />
        </linearGradient>
        <filter id="layerGlow" x="0" y="0" width="240" height="240" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000000" floodOpacity="0.15" />
        </filter>
      </defs>

      {/* Vertical corner guide lines */}
      <line x1="120" y1="38" x2="120" y2="178" stroke="white" strokeOpacity="0.15" strokeDasharray="3 3" />
      <line x1="210" y1="88" x2="210" y2="158" stroke="white" strokeOpacity="0.1" strokeDasharray="3 3" />
      <line x1="30" y1="88" x2="30" y2="158" stroke="white" strokeOpacity="0.1" strokeDasharray="3 3" />

      {/* Layer 3 - Bottom */}
      <g filter="url(#layerGlow)">
        <polygon
          points="120,118 210,168 120,218 30,168"
          fill="url(#layerGradBottom)"
          stroke="white"
          strokeOpacity="0.45"
          strokeWidth="1.75"
        />
        {/* Layer 3 edge depth */}
        <polygon
          points="30,168 120,218 120,224 30,174"
          fill="white"
          fillOpacity="0.08"
        />
        <polygon
          points="120,218 210,168 210,174 120,224"
          fill="white"
          fillOpacity="0.15"
        />
        <line x1="120" y1="118" x2="120" y2="218" stroke="white" strokeOpacity="0.12" />
        <line x1="75" y1="143" x2="165" y2="193" stroke="white" strokeOpacity="0.1" />
        <line x1="165" y1="143" x2="75" y2="193" stroke="white" strokeOpacity="0.1" />
      </g>

      {/* Layer 2 - Middle */}
      <g filter="url(#layerGlow)">
        <polygon
          points="120,78 210,128 120,178 30,128"
          fill="url(#layerGradMid)"
          stroke="white"
          strokeOpacity="0.65"
          strokeWidth="1.75"
        />
        {/* Layer 2 edge depth */}
        <polygon
          points="30,128 120,178 120,184 30,134"
          fill="white"
          fillOpacity="0.12"
        />
        <polygon
          points="120,178 210,128 210,134 120,184"
          fill="white"
          fillOpacity="0.2"
        />
        <line x1="120" y1="78" x2="120" y2="178" stroke="white" strokeOpacity="0.2" />
        <line x1="75" y1="103" x2="165" y2="153" stroke="white" strokeOpacity="0.15" />
        <line x1="165" y1="103" x2="75" y2="153" stroke="white" strokeOpacity="0.15" />
      </g>

      {/* Layer 1 - Top */}
      <g filter="url(#layerGlow)">
        <polygon
          points="120,38 210,88 120,138 30,88"
          fill="url(#layerGradTop)"
          stroke="white"
          strokeOpacity="0.9"
          strokeWidth="2"
        />
        {/* Layer 1 edge depth */}
        <polygon
          points="30,88 120,138 120,145 30,95"
          fill="white"
          fillOpacity="0.18"
        />
        <polygon
          points="120,138 210,88 210,95 120,145"
          fill="white"
          fillOpacity="0.3"
        />
        <line x1="120" y1="38" x2="120" y2="138" stroke="white" strokeOpacity="0.3" />
        <line x1="75" y1="63" x2="165" y2="113" stroke="white" strokeOpacity="0.2" />
        <line x1="165" y1="63" x2="75" y2="113" stroke="white" strokeOpacity="0.2" />
      </g>
    </svg>
  )
}
