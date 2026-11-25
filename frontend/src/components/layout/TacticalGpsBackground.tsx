import React from 'react';

export interface TacticalGpsBackgroundProps {
  readonly sectorLabel?: string;
  readonly enclaveNodeLabel?: string;
  readonly patientBeaconLabel?: string;
  readonly className?: string;
}

export function TacticalGpsBackground({
  sectorLabel = 'NEO-SHINJUKU SEC-09',
  enclaveNodeLabel = 'ENCLAVE NODE [DIANA-9800] // SECTOR 09',
  patientBeaconLabel = 'PATIENT BEACON [#EQ-9042] // NON-INVASIVE CORTEX',
  className = '',
}: Readonly<TacticalGpsBackgroundProps>): React.JSX.Element {
  return (
    <div
      className={`fixed inset-0 pointer-events-none z-0 overflow-hidden select-none ${className}`}
      aria-hidden="true"
    >
      <svg
        className="w-full h-full min-w-[1280px] opacity-85"
        fill="none"
        viewBox="0 0 1440 980"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient
            gradientUnits="userSpaceOnUse"
            id="vivid-nav-glow"
            x1="180"
            x2="1140"
            y1="220"
            y2="760"
          >
            <stop offset="0%" stopColor="#3B66E8" stopOpacity="0.95" />
            <stop offset="45%" stopColor="#5EEAD4" stopOpacity="1" />
            <stop offset="85%" stopColor="#F4729B" stopOpacity="0.95" />
          </linearGradient>
          <pattern
            height="48"
            id="tactical-grid-ticks"
            patternUnits="userSpaceOnUse"
            width="48"
          >
            <path
              d="M 48 0 L 0 0 0 48"
              fill="none"
              stroke="#23332C"
              strokeOpacity="0.6"
              strokeWidth="0.75"
            />
            <circle cx="24" cy="24" fill="#5EEAD4" fillOpacity="0.35" r="0.8" />
          </pattern>
        </defs>

        {/* Grid Foundation */}
        <rect fill="url(#tactical-grid-ticks)" height="100%" width="100%" />

        {/* High-Contrast Topographic Contour Elevation Lines */}
        <g fill="none" stroke="#A8F0C6" strokeLinecap="round" strokeWidth="1.8">
          <path
            d="M -80 140 C 260 80, 520 230, 890 190 C 1180 150, 1340 90, 1540 120"
            strokeOpacity="0.55"
          />
          <path
            d="M -80 270 C 290 220, 560 380, 960 320 C 1220 270, 1380 210, 1540 250"
            strokeOpacity="0.5"
          />
          <path
            d="M -80 430 C 240 390, 600 520, 1020 460 C 1280 410, 1420 330, 1540 370"
            strokeDasharray="8 3"
            strokeOpacity="0.58"
          />
          <path
            d="M -80 590 C 270 540, 640 680, 1080 610 C 1320 560, 1440 490, 1540 520"
            strokeOpacity="0.5"
          />
          <path
            d="M -80 750 C 310 700, 680 840, 1140 770 C 1350 710, 1460 650, 1540 680"
            strokeOpacity="0.52"
          />
          <path
            d="M -80 890 C 340 850, 720 970, 1200 910 C 1380 860, 1490 810, 1540 840"
            strokeOpacity="0.45"
          />
        </g>

        {/* Contour Elevation Text Callouts Stamped on Curves */}
        <g
          className="font-mono text-[10px]"
          fill="#A8F0C6"
          opacity="0.85"
        >
          <text letterSpacing="1.5" x="360" y="170">
            ELEV +34.2m
          </text>
          <text letterSpacing="1.5" x="890" y="300">
            ELEV +42.8m
          </text>
          <text letterSpacing="1.5" x="310" y="555">
            CONTOUR INTERVAL 5m
          </text>
          <text letterSpacing="1.5" x="1210" y="390">
            ELEV +58.0m
          </text>
          <text letterSpacing="1.5" x="760" y="790">
            ELEV +64.5m [SHINJUKU CREST]
          </text>
        </g>

        {/* Crisp City Sector Street Grid & District Blocks in Neon Mint / Teal */}
        <g fill="none" stroke="#5EEAD4" strokeOpacity="0.42" strokeWidth="1.2">
          <line strokeDasharray="12 6" x1="160" x2="160" y1="0" y2="980" />
          <line x1="390" x2="390" y1="0" y2="980" />
          <line strokeDasharray="16 8" x1="720" x2="720" y1="0" y2="980" />
          <line x1="1040" x2="1040" y1="0" y2="980" />
          <line strokeDasharray="10 5" x1="1290" x2="1290" y1="0" y2="980" />
          <line x1="0" x2="1440" y1="210" y2="210" />
          <line strokeDasharray="12 6" x1="0" x2="1440" y1="460" y2="460" />
          <line x1="0" x2="1440" y1="690" y2="690" />
          <line strokeDasharray="14 7" x1="0" x2="1440" y1="880" y2="880" />

          {/* District Block Polygons */}
          <polygon
            fill="#131B18"
            fillOpacity="0.35"
            points="180,230 360,230 360,330 180,330"
            stroke="#A8F0C6"
            strokeOpacity="0.45"
            strokeWidth="1.2"
          />
          <polygon
            fill="#131B18"
            fillOpacity="0.3"
            points="410,230 690,230 690,430 410,430"
            stroke="#5EEAD4"
            strokeOpacity="0.4"
            strokeWidth="1.2"
          />
          <polygon
            fill="#131B18"
            fillOpacity="0.32"
            points="740,480 1010,480 1010,660 740,660"
            stroke="#A8F0C6"
            strokeOpacity="0.45"
            strokeWidth="1.2"
          />
          <polygon
            fill="#131B18"
            fillOpacity="0.28"
            points="1060,230 1260,230 1260,430 1060,430"
            stroke="#5EEAD4"
            strokeOpacity="0.38"
            strokeWidth="1.2"
          />
        </g>

        {/* Street Block Labels & Coordinates */}
        <g className="font-mono text-[10px]" fill="#5EEAD4" opacity="0.9">
          <text letterSpacing="1" x="195" y="255">
            {sectorLabel}
          </text>
          <text letterSpacing="1" x="425" y="255">
            LATTICE BOULEVARD // EXPRESS ROUTE
          </text>
          <text letterSpacing="1" x="755" y="505">
            Q-ENCLAVE BUFFER 4 [ISOLATION ZONE]
          </text>
          <text letterSpacing="1" x="1075" y="255">
            KEM-RELAY ALLEY [CAT-5 PQC]
          </text>
        </g>

        {/* Radar Range Rings & Azimuth Circles */}
        <g
          fill="none"
          stroke="#A8F0C6"
          strokeOpacity="0.38"
          transform="translate(680, 520)"
        >
          <circle r="140" strokeDasharray="4 4" strokeWidth="1.2" />
          <circle r="260" strokeWidth="1.4" />
          <circle r="380" strokeDasharray="8 6" strokeWidth="1.2" />
          <circle r="520" strokeWidth="1.4" />
          <line
            strokeOpacity="0.35"
            strokeWidth="1"
            x1="-560"
            x2="560"
            y1="0"
            y2="0"
          />
          <line
            strokeOpacity="0.35"
            strokeWidth="1"
            x1="0"
            x2="0"
            y1="-560"
            y2="560"
          />
          <text className="font-mono text-[10px]" fill="#A8F0C6" x="145" y="-6">
            1.0 km
          </text>
          <text className="font-mono text-[10px]" fill="#A8F0C6" x="265" y="-6">
            2.0 km
          </text>
          <text className="font-mono text-[10px]" fill="#A8F0C6" x="385" y="-6">
            3.0 km
          </text>
          <text className="font-mono text-[10px]" fill="#A8F0C6" x="525" y="-6">
            4.0 km
          </text>
          <text
            className="font-mono text-[10px]"
            fill="#A8F0C6"
            fontWeight="700"
            x="-4"
            y="-530"
          >
            000° N [POLARIS LOCK]
          </text>
          <text
            className="font-mono text-[10px]"
            fill="#A8F0C6"
            fontWeight="700"
            x="535"
            y="4"
          >
            090° E
          </text>
          <text
            className="font-mono text-[10px]"
            fill="#A8F0C6"
            fontWeight="700"
            x="-4"
            y="545"
          >
            180° S
          </text>
          <text
            className="font-mono text-[10px]"
            fill="#A8F0C6"
            fontWeight="700"
            x="-555"
            y="4"
          >
            270° W
          </text>
        </g>

        {/* Vibrant Navigation Trajectory Line */}
        <path
          d="M 280 290 Q 520 380 730 490 T 1160 680"
          fill="none"
          opacity="0.95"
          stroke="url(#vivid-nav-glow)"
          strokeDasharray="9 5"
          strokeLinecap="round"
          strokeWidth="3.5"
        />

        {/* Trajectory Data Strip */}
        <g transform="translate(480, 420)">
          <rect
            fill="#131B18"
            fillOpacity="0.9"
            height="24"
            rx="4"
            stroke="#3B66E8"
            strokeWidth="1.2"
            width="370"
            x="0"
            y="0"
          />
          <text
            className="font-mono text-[9px]"
            fill="#5EEAD4"
            fontWeight="600"
            letterSpacing="1"
            x="12"
            y="16"
          >
            GPS ROUTE // 2.4 km • AZIMUTH 284° • LAT 35.6762° N // LON 139.6503° E
          </text>
        </g>

        {/* Waypoint 1: Enclave Specialist Node (Bright Pastel Mint) */}
        <g transform="translate(280, 290)">
          <circle
            fill="none"
            r="36"
            stroke="#A8F0C6"
            strokeDasharray="4 4"
            strokeOpacity="0.4"
            strokeWidth="1.2"
          />
          <circle
            fill="none"
            r="20"
            stroke="#A8F0C6"
            strokeOpacity="0.8"
            strokeWidth="1.8"
          />
          <circle fill="#A8F0C6" r="8" />
          <circle fill="#0B100E" r="3" />
          <g transform="translate(18, -14)">
            <rect
              fill="#131B18"
              fillOpacity="0.95"
              height="22"
              rx="3"
              stroke="#A8F0C6"
              strokeWidth="1"
              width="235"
              x="0"
              y="0"
            />
            <text
              className="font-mono text-[9px]"
              fill="#A8F0C6"
              fontWeight="700"
              letterSpacing="0.5"
              x="8"
              y="15"
            >
              {enclaveNodeLabel}
            </text>
          </g>
        </g>

        {/* Waypoint 2: Bionic Patient Telemetry Node (Bright Coral Pink) */}
        <g transform="translate(1160, 680)">
          <circle
            fill="none"
            r="42"
            stroke="#F4729B"
            strokeDasharray="6 4"
            strokeOpacity="0.45"
            strokeWidth="1.2"
          />
          <circle
            fill="none"
            r="22"
            stroke="#F4729B"
            strokeOpacity="0.9"
            strokeWidth="2"
          />
          <circle fill="#F4729B" r="8" />
          <circle fill="#0B100E" r="3" />
          <g transform="translate(18, -14)">
            <rect
              fill="#131B18"
              fillOpacity="0.95"
              height="22"
              rx="3"
              stroke="#F4729B"
              strokeWidth="1"
              width="265"
              x="0"
              y="0"
            />
            <text
              className="font-mono text-[9px]"
              fill="#F4729B"
              fontWeight="700"
              letterSpacing="0.5"
              x="8"
              y="15"
            >
              {patientBeaconLabel}
            </text>
          </g>
        </g>
      </svg>
    </div>
  );
}
