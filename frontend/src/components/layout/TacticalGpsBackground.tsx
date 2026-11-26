import React from 'react';

export interface TacticalGpsBackgroundProps {
  readonly sectorLabel?: string;
  readonly enclaveNodeLabel?: string;
  readonly patientBeaconLabel?: string;
  readonly className?: string;
}

export function TacticalGpsBackground({
  sectorLabel = 'SECTOR-09 // WEST LATTICE',
  enclaveNodeLabel = 'ENCLAVE NODE [DIANA-9800]',
  patientBeaconLabel = 'PATIENT BEACON [#EQ-9042]',
  className = '',
}: Readonly<TacticalGpsBackgroundProps>): React.JSX.Element {
  return (
    <div
      className={`fixed inset-0 z-0 pointer-events-none select-none overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <svg
        className="w-full h-full object-cover min-w-[1440px]"
        fill="none"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient cx="50%" cy="50%" id="vignette-ambient" r="75%">
            <stop offset="0%" stopColor="#0B100E" stopOpacity="0.05" />
            <stop offset="70%" stopColor="#0B100E" stopOpacity="0.38" />
            <stop offset="100%" stopColor="#0B100E" stopOpacity="0.82" />
          </radialGradient>
          <linearGradient id="route-stream" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#3B66E8" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#5EEAD4" stopOpacity="1" />
            <stop offset="100%" stopColor="#F4729B" stopOpacity="0.95" />
          </linearGradient>
          <pattern
            height="60"
            id="tactical-mesh-grid"
            patternUnits="userSpaceOnUse"
            width="60"
          >
            <path
              d="M 60 0 L 0 0 0 60"
              fill="none"
              stroke="#23332C"
              strokeOpacity="0.45"
              strokeWidth="0.75"
            />
            <circle cx="30" cy="30" fill="#5EEAD4" fillOpacity="0.25" r="0.75" />
          </pattern>
          <filter height="200%" id="beacon-glow-mint" width="200%" x="-50%" y="-50%">
            <feGaussianBlur in="SourceGraphic" result="blur" stdDeviation="6" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter height="200%" id="beacon-glow-pink" width="200%" x="-50%" y="-50%">
            <feGaussianBlur in="SourceGraphic" result="blur" stdDeviation="6" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Base Tactical Grid Mesh */}
        <rect fill="#0B100E" height="100%" width="100%" />
        <rect fill="url(#tactical-mesh-grid)" height="100%" width="100%" />

        {/* Topographic Contour Lines across Central Tokyo Neo-Shinjuku Basin */}
        <g fill="none" stroke="#A8F0C6" strokeLinecap="round" strokeWidth="1.2">
          <path
            d="M -100 210 C 320 170, 680 310, 1140 260 S 1700 140, 2040 180"
            strokeOpacity="0.32"
          />
          <path
            d="M -100 340 C 360 290, 720 440, 1220 380 S 1780 250, 2040 310"
            strokeOpacity="0.38"
          />
          <path
            d="M -100 480 C 400 440, 800 580, 1320 520 S 1820 390, 2040 450"
            strokeDasharray="10 4"
            strokeOpacity="0.42"
          />
          <path
            d="M -100 640 C 380 590, 860 740, 1400 670 S 1860 560, 2040 610"
            strokeOpacity="0.35"
          />
          <path
            d="M -100 810 C 420 760, 920 900, 1480 840 S 1900 730, 2040 780"
            strokeOpacity="0.28"
          />
        </g>

        {/* Contour Labels */}
        <g
          fill="#A8F0C6"
          fillOpacity="0.65"
          fontFamily="JetBrains Mono"
          fontSize="10"
          letterSpacing="1"
        >
          <text x="560" y="240">
            ELEV +34.2m [BASIN CONTOUR]
          </text>
          <text x="1240" y="365">
            ELEV +48.6m
          </text>
          <text x="780" y="605">
            ELEV +64.5m [SHINJUKU CREST INTERV 5m]
          </text>
          <text x="1560" y="540">
            ELEV +72.0m [OUTER PLATEAU]
          </text>
        </g>

        {/* Tactical Street Axis Vectors (Neon Mint & Cobalt) */}
        <g fill="none" stroke="#5EEAD4" strokeOpacity="0.32" strokeWidth="1.2">
          <line strokeDasharray="8 6" x1="280" x2="280" y1="0" y2="1080" />
          <line x1="580" x2="580" y1="0" y2="1080" />
          <line strokeDasharray="14 6" x1="920" x2="920" y1="0" y2="1080" />
          <line x1="1260" x2="1260" y1="0" y2="1080" />
          <line strokeDasharray="10 5" x1="1580" x2="1580" y1="0" y2="1080" />
          <line x1="1780" x2="1780" y1="0" y2="1080" />

          <line x1="0" x2="1920" y1="180" y2="180" />
          <line strokeDasharray="12 6" x1="0" x2="1920" y1="360" y2="360" />
          <line x1="0" x2="1920" y1="580" y2="580" />
          <line strokeDasharray="16 8" x1="0" x2="1920" y1="780" y2="780" />
          <line x1="0" x2="1920" y1="940" y2="940" />

          {/* District Enclave Boundary Blocks */}
          <polygon
            fill="#131B18"
            fillOpacity="0.35"
            points="340,220 540,220 540,320 340,320"
            stroke="#A8F0C6"
            strokeOpacity="0.4"
          />
          <polygon
            fill="#131B18"
            fillOpacity="0.32"
            points="620,380 880,380 880,540 620,540"
            stroke="#5EEAD4"
            strokeOpacity="0.45"
          />
          <polygon
            fill="#131B18"
            fillOpacity="0.35"
            points="980,590 1220,590 1220,740 980,740"
            stroke="#A8F0C6"
            strokeOpacity="0.4"
          />
          <polygon
            fill="#131B18"
            fillOpacity="0.3"
            points="1320,220 1540,220 1540,380 1320,380"
            stroke="#3B66E8"
            strokeOpacity="0.4"
          />
          <polygon
            fill="#131B18"
            fillOpacity="0.3"
            points="1360,620 1620,620 1620,820 1360,820"
            stroke="#F4729B"
            strokeOpacity="0.35"
          />
        </g>

        {/* District Coordinates & Tactical Markers */}
        <g fill="#86A798" fontFamily="JetBrains Mono" fontSize="9" letterSpacing="1.5">
          <text x="350" y="245">
            {sectorLabel}
          </text>
          <text x="635" y="405">
            LATTICE BLVD EXPRESS • ELEV +42m
          </text>
          <text x="995" y="615">
            Q-ENCLAVE ZONE 4 [RESTRICTED TELEMETRY]
          </text>
          <text x="1335" y="245">
            CHOME-3 BUFFER // HIGHWAY CORRIDOR
          </text>
          <text x="1375" y="645">
            BIO-TELEMETRY CLUSTER [#PATIENT-0x94B]
          </text>
        </g>

        {/* Radar Range Rings & Azimuth Circles (Positioned in Center Tactical Field) */}
        <g
          fill="none"
          stroke="#A8F0C6"
          strokeOpacity="0.35"
          transform="translate(1040, 520)"
        >
          <circle r="140" strokeDasharray="4 4" strokeWidth="1.2" />
          <circle r="280" strokeWidth="1.4" />
          <circle r="440" strokeDasharray="8 6" strokeWidth="1.2" />
          <circle r="600" strokeWidth="1.5" />
          <line strokeOpacity="0.3" x1="-660" x2="660" y1="0" y2="0" />
          <line strokeOpacity="0.3" x1="0" x2="0" y1="-660" y2="660" />
          <path
            d="M 0 -605 L 0 -595 M 0 605 L 0 595 M -605 0 L -595 0 M 605 0 L 595 0"
            stroke="#5EEAD4"
            strokeWidth="2.5"
          />
          <text fill="#A8F0C6" fontFamily="JetBrains Mono" fontSize="10" x="150" y="-8">
            1.0 km
          </text>
          <text fill="#A8F0C6" fontFamily="JetBrains Mono" fontSize="10" x="290" y="-8">
            2.0 km
          </text>
          <text fill="#A8F0C6" fontFamily="JetBrains Mono" fontSize="10" x="450" y="-8">
            3.0 km
          </text>
          <text fill="#A8F0C6" fontFamily="JetBrains Mono" fontSize="10" x="610" y="-8">
            4.0 km
          </text>
          <text
            fill="#A8F0C6"
            fontFamily="JetBrains Mono"
            fontSize="11"
            fontWeight="700"
            x="-8"
            y="-615"
          >
            000° N [POLARIS LOCK]
          </text>
          <text
            fill="#A8F0C6"
            fontFamily="JetBrains Mono"
            fontSize="11"
            fontWeight="700"
            x="625"
            y="4"
          >
            090° E
          </text>
          <text
            fill="#A8F0C6"
            fontFamily="JetBrains Mono"
            fontSize="11"
            fontWeight="700"
            x="-8"
            y="630"
          >
            180° S
          </text>
          <text
            fill="#A8F0C6"
            fontFamily="JetBrains Mono"
            fontSize="11"
            fontWeight="700"
            x="-665"
            y="4"
          >
            270° W
          </text>
        </g>

        {/* Dynamic Vector Route Connecting Enclave and Patient Beacon */}
        <path
          d="M 680 320 Q 940 410 1120 520 T 1460 700"
          fill="none"
          filter="url(#beacon-glow-mint)"
          stroke="url(#route-stream)"
          strokeDasharray="10 6"
          strokeLinecap="round"
          strokeWidth="3.5"
        />

        {/* Mid-Route Telemetry Speed & Latency Callout Pill */}
        <g transform="translate(970, 435)">
          <rect
            fill="#0B100E"
            fillOpacity="0.9"
            height="26"
            rx="4"
            stroke="#3B66E8"
            strokeWidth="1.2"
            width="310"
            x="0"
            y="0"
          />
          <text
            fill="#5EEAD4"
            fontFamily="JetBrains Mono"
            fontSize="9"
            fontWeight="700"
            letterSpacing="1"
            x="12"
            y="17"
          >
            GPS VECTOR // 2.4 km • 0.42ms LAT • AZIMUTH 284°
          </text>
        </g>

        {/* BEACON 1: Enclave Specialist Node [DIANA-9800] */}
        <g transform="translate(680, 320)">
          <circle
            className="animate-pulse"
            fill="none"
            r="44"
            stroke="#A8F0C6"
            strokeDasharray="4 4"
            strokeOpacity="0.25"
          />
          <circle fill="none" r="26" stroke="#A8F0C6" strokeOpacity="0.6" strokeWidth="1.5" />
          <circle fill="#A8F0C6" filter="url(#beacon-glow-mint)" r="10" />
          <circle fill="#0B100E" r="4" />
          <g transform="translate(20, -18)">
            <rect
              fill="#131B18"
              fillOpacity="0.92"
              height="26"
              rx="4"
              stroke="#A8F0C6"
              strokeWidth="1.2"
              width="220"
              x="0"
              y="0"
            />
            <circle className="animate-pulse" cx="12" cy="13" fill="#A8F0C6" r="3.5" />
            <text
              fill="#A8F0C6"
              fontFamily="JetBrains Mono"
              fontSize="10"
              fontWeight="700"
              letterSpacing="0.5"
              x="22"
              y="17"
            >
              {enclaveNodeLabel}
            </text>
          </g>
        </g>

        {/* BEACON 2: Patient Telemetry Node [#EQ-9042] (Pulsating Coral Pink) */}
        <g transform="translate(1460, 700)">
          <circle
            className="animate-ping"
            fill="none"
            r="52"
            stroke="#F4729B"
            strokeDasharray="6 4"
            strokeOpacity="0.3"
            style={{ animationDuration: '3s' }}
          />
          <circle fill="none" r="30" stroke="#F4729B" strokeOpacity="0.75" strokeWidth="1.8" />
          <circle fill="#F4729B" filter="url(#beacon-glow-pink)" r="10" />
          <circle fill="#0B100E" r="4" />
          <g transform="translate(22, -18)">
            <rect
              fill="#131B18"
              fillOpacity="0.92"
              height="26"
              rx="4"
              stroke="#F4729B"
              strokeWidth="1.2"
              width="240"
              x="0"
              y="0"
            />
            <circle className="animate-pulse" cx="12" cy="13" fill="#F4729B" r="3.5" />
            <text
              fill="#F4729B"
              fontFamily="JetBrains Mono"
              fontSize="10"
              fontWeight="700"
              letterSpacing="0.5"
              x="22"
              y="17"
            >
              {patientBeaconLabel}
            </text>
          </g>
        </g>

        {/* Satellite Orbit telemetry status watermark at corner */}
        <g fill="#5B7569" fontFamily="JetBrains Mono" fontSize="9" letterSpacing="1">
          <text x="440" y="1025">
            SATELLITE SYNC: QORE-SAT-4 // LAT 35.6762° N LON 139.6503° E // DOPPLER COMPENSATED
          </text>
          <text x="1440" y="1025">
            PQC CIPHER: ML-KEM-1024 / FIPS 203 READY
          </text>
        </g>

        {/* Ambient Vignette */}
        <rect fill="url(#vignette-ambient)" height="100%" width="100%" />
      </svg>
    </div>
  );
}
