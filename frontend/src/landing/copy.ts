/**
 * SynapseQ landing copy (ES | EN).
 * Content is grounded in the README: real primitives (ML-KEM-1024, ML-DSA-87,
 * SHAKE-256, AES-256-GCM), real contract behaviour and its honest limits.
 * Product names of implants/OEMs are fictional and brand-neutral.
 */

export type Locale = 'es' | 'en';
export type Tone = 'mint' | 'pink' | 'amber' | 'blue';
export type ModuleTab = 'patient-vault' | 'cyber-hbom' | 'specialist-portal';

export interface BionicPartCopy {
  readonly id: 'cortex' | 'retina' | 'heart' | 'arm';
  readonly code: string;
  readonly zone: string;
  readonly name: string;
  readonly oem: string;
  readonly status: string;
  readonly statusTone: Tone;
  readonly story: string;
  readonly passWindow: string;
  readonly firmwareHash: string;
}

export interface ModuleCardCopy {
  readonly hudTag: string;
  readonly tabParam: ModuleTab;
  readonly title: string;
  readonly tagline: string;
  readonly description: string;
  readonly bullets: readonly string[];
  readonly cta: string;
  readonly accent: 'mint' | 'pink' | 'blue';
}

export interface LandingCopy {
  readonly nav: {
    readonly vision: string;
    readonly present: string;
    readonly future: string;
    readonly modules: string;
    readonly launchDapp: string;
    readonly skip: string;
  };
  readonly hero: {
    readonly hudBadge: string;
    readonly headlineA: string;
    readonly headlineB: string;
    readonly subtitle: string;
    readonly ctaPrimary: string;
    readonly ctaSecondary: string;
    readonly irisTop: string;
    readonly irisStatus: string;
    readonly irisCaption: string;
    readonly irisLabels: readonly string[];
    readonly scrollHint: string;
    readonly trustItems: readonly { readonly label: string; readonly value: string }[];
  };
  readonly harvest: {
    readonly hudTag: string;
    readonly title: string;
    readonly lead: string;
    readonly archiveLabel: string;
    readonly archiveStatus: string;
    readonly yearLabel: string;
    readonly stats: readonly { readonly value: number; readonly prefix?: string; readonly suffix: string; readonly label: string }[];
  };
  readonly pipeline: {
    readonly hudTag: string;
    readonly title: string;
    readonly lead: string;
    readonly steps: readonly {
      readonly code: string;
      readonly title: string;
      readonly body: string;
      readonly spec: string;
      readonly tone: Tone;
    }[];
    readonly tagline: string;
  };
  readonly killSwitch: {
    readonly hudTag: string;
    readonly title: string;
    readonly lead: string;
    readonly pillars: readonly { readonly code: string; readonly title: string; readonly body: string; readonly tone: Tone }[];
    readonly sim: {
      readonly hudTag: string;
      readonly activeStatus: string;
      readonly revokedStatus: string;
      readonly passTitle: string;
      readonly recipientLabel: string;
      readonly recipientName: string;
      readonly scopeLabel: string;
      readonly scopeValue: string;
      readonly timerLabel: string;
      readonly demoLabel: string;
      readonly killLabel: string;
      readonly revokedNote: string;
      readonly activeNote: string;
      readonly otherPasses: readonly string[];
      readonly epochLabel: string;
    };
    readonly honestNote: string;
  };
  readonly qday: {
    readonly hudTag: string;
    readonly lines: readonly string[];
    readonly warning: string;
    readonly fromLabel: string;
    readonly toLabel: string;
  };
  readonly bionic: {
    readonly hudTag: string;
    readonly title: string;
    readonly lead: string;
    readonly hint: string;
    readonly inspectorLabels: { readonly oem: string; readonly pass: string; readonly firmware: string };
    readonly parts: readonly BionicPartCopy[];
    readonly lifecycleTitle: string;
    readonly lifecycle: readonly { readonly code: string; readonly title: string; readonly body: string }[];
    readonly honestNote: string;
  };
  readonly audience: {
    readonly hudTag: string;
    readonly title: string;
    readonly items: readonly { readonly code: string; readonly title: string; readonly body: string; readonly gain: string; readonly tone: Tone }[];
  };
  readonly modules: {
    readonly hudTag: string;
    readonly title: string;
    readonly lead: string;
    readonly cards: readonly ModuleCardCopy[];
    readonly proofTitle: string;
    readonly proof: readonly { readonly label: string; readonly value: string }[];
  };
  readonly manifesto: {
    readonly hudTag: string;
    readonly quoteA: string;
    readonly quoteB: string;
    readonly quoteC: string;
    readonly subcopy: string;
    readonly ctaPrimary: string;
    readonly ctaGithub: string;
  };
  readonly footer: {
    readonly tagline: string;
    readonly builtFor: string;
    readonly wink: string;
    readonly teamLabel: string;
  };
}

export const LANDING_COPY: Record<Locale, LandingCopy> = {
  es: {
    nav: {
      vision: 'Visión',
      present: '2026',
      future: '2045',
      modules: 'dApp',
      launchDapp: 'Lanzar dApp',
      skip: 'Saltar al contenido',
    },
    hero: {
      hudBadge: 'BÓVEDA POST-CUÁNTICA // BIO + CIBER-HUMANA',
      headlineA: 'Tu ADN no puede cambiar de contraseña.',
      headlineB: 'Tu futuro cuerpo biónico tampoco.',
      subtitle:
        'Una bóveda post-cuántica para tu historia clínica hoy y para cada pieza de tu cuerpo mañana. Tú prestas el acceso; nadie se queda con la llave.',
      ctaPrimary: 'Lanzar dApp',
      ctaSecondary: 'Iniciar el viaje',
      irisTop: 'PLANO 01 // IRIS DE SOBERANÍA',
      irisStatus: 'SOBERANO',
      irisCaption: 'Mueve el cursor: el núcleo te sigue',
      irisLabels: ['ANILLO EXT · ML-KEM-1024', 'ANILLO INT · ML-DSA-87', 'NÚCLEO · KILL-SWITCH O(1)'],
      scrollHint: 'Desplázate para atravesar',
      trustItems: [
        { label: 'SELLADO', value: 'ML-KEM-1024' },
        { label: 'FIRMA OEM', value: 'ML-DSA-87' },
        { label: 'RED', value: 'QoreChain · 9800' },
        { label: 'ACCESO', value: 'Zero-Trust' },
      ],
    },
    harvest: {
      hudTag: 'ACTO I // 2026 · EL PRESENTE INVISIBLE',
      title: 'Hoy ya roban tus datos esperando al mañana.',
      lead: 'Una tarjeta se cancela en segundos. Tu genoma, tus resonancias y tu historia clínica deben seguir siendo privados durante décadas. Mientras tanto, hay quien guarda hoy tráfico cifrado con RSA y ECC para abrirlo cuando llegue la computación cuántica: Harvest Now, Decrypt Later.',
      archiveLabel: 'ARCHIVO HNDL // CIFRADO CLÁSICO',
      archiveStatus: 'ESPERANDO Q-DAY',
      yearLabel: 'TUS DATOS SIGUEN VIVOS EN',
      stats: [
        { value: 70, suffix: ' años', label: 'de confidencialidad que exige un expediente clínico' },
        { value: 0, suffix: '', label: 'contraseñas nuevas posibles para tu ADN tras una fuga' },
        { value: 1, suffix: ' Q-Day', label: 'basta para abrir todo lo cosechado con cifrado clásico' },
      ],
    },
    pipeline: {
      hudTag: 'CÓMO FUNCIONA // 4 CAPAS',
      title: 'Criptografía que sobrevive al futuro, en tu navegador.',
      lead: 'Nada de esto ocurre en un servidor que debas creer. Ocurre en tu dispositivo y queda anclado en QoreChain.',
      steps: [
        {
          code: '01 · CIFRA',
          title: 'Cifras en tu navegador',
          body: 'Tus archivos se cifran localmente con AES-256-GCM vía Web Crypto. Nunca salen en claro de tu dispositivo.',
          spec: 'AES-256-GCM · WEB CRYPTO',
          tone: 'mint',
        },
        {
          code: '02 · SELLA',
          title: 'Sellas la llave para una sola persona',
          body: 'La llave del archivo se encapsula con la clave pública ML-KEM-1024 del especialista, publicada on-chain. Solo esa persona puede abrirla.',
          spec: 'ML-KEM-1024 · NIST FIPS 203 · 1.568 B',
          tone: 'blue',
        },
        {
          code: '03 · ANCLA',
          title: 'Anclas solo compromisos',
          body: 'En la cadena van únicamente hashes SHAKE-256 del cifrado y del sobre. El sobre y el CID nunca tocan el contrato.',
          spec: 'SHAKE-256 · QORECHAIN 9800',
          tone: 'amber',
        },
        {
          code: '04 · LIBERA',
          title: 'Liberas con un reto firmado',
          body: 'El Key-Release Gateway entrega el sobre solo si la wallet firma un reto de un solo uso y el pase sigue activo on-chain.',
          spec: 'NONCE · CHAIN ID · RECORD ID',
          tone: 'pink',
        },
      ],
      tagline: 'Prestas acceso. Nunca cedes la propiedad.',
    },
    killSwitch: {
      hudTag: 'ACTO I // CONTROL EFÍMERO',
      title: 'Un botón para apagarlo todo.',
      lead: 'Los pases expiran solos. Y si algo no te cuadra, los extingues todos a la vez.',
      pillars: [
        {
          code: '01 / PASE EFÍMERO',
          title: 'Acceso por horas, no para siempre',
          body: 'Compartes un estudio con un especialista durante una ventana de tiempo. Puedes extender un pase activo, pero uno vencido o revocado no revive.',
          tone: 'mint',
        },
        {
          code: '02 / KILL-SWITCH O(1)',
          title: 'Revocación global en una operación',
          body: 'emergencyRevokeAll() sube tu época on-chain e invalida todos tus pases anteriores de golpe, sin recorrerlos uno por uno.',
          tone: 'pink',
        },
      ],
      sim: {
        hudTag: 'ILUSTRACIÓN // PASE EFÍMERO',
        activeStatus: 'PASE ACTIVO',
        revokedStatus: 'REVOCADO · ÉPOCA +1',
        passTitle: 'Resonancia craneal + perfil genómico',
        recipientLabel: 'ESPECIALISTA',
        recipientName: 'Dra. Elena Rostova · Neurología',
        scopeLabel: 'ALCANCE',
        scopeValue: 'Lectura en memoria',
        timerLabel: 'EXPIRA EN',
        demoLabel: 'ILUSTRACIÓN · SE REPITE SOLA',
        killLabel: 'KILL-SWITCH',
        revokedNote: 'Época incrementada. El gateway rechaza cualquier nueva entrega del sobre ML-KEM-1024.',
        activeNote: 'Así se ve un pase vivo. En la dApp, un solo Kill-Switch los apaga todos a la vez.',
        otherPasses: ['Laboratorio · 24 h', 'Segunda opinión · 6 h', 'Cardiología · 2 h'],
        epochLabel: 'ÉPOCA',
      },
      honestNote:
        'Límite honesto: revocar impide nuevas entregas; no puede borrar lo que alguien ya descifró en su memoria.',
    },
    qday: {
      hudTag: 'TRANSICIÓN // Q-DAY',
      lines: [
        'Un día, un ordenador cuántico romperá RSA.',
        'Ese día, una fuga deja de ser un PDF.',
        'Y tu cuerpo ya tendrá firmware.',
      ],
      warning: 'CIFRADO CLÁSICO COMPROMETIDO',
      fromLabel: 'HOY',
      toLabel: 'MAÑANA',
    },
    bionic: {
      hudTag: 'ACTO II // 2045 · EL CUERPO AUMENTADO',
      title: 'Cuando el cuerpo tenga firmware, la privacidad será supervivencia.',
      lead: 'Neuro-implantes, retinas fotónicas, brazos biónicos, órganos sintéticos. Cada pieza será parte de tu cadena de suministro personal: una Lista de Materiales Humana (HBOM). Si alguien falsifica su firma, ya no roba un dato: toma el control de una parte de ti.',
      hint: 'Desplázate: el escáner recorre cada pieza de la HBOM',
      inspectorLabels: { oem: 'FABRICANTE', pass: 'PASE BIO-INGENIERO', firmware: 'ÚLTIMO FIRMWARE' },
      parts: [
        {
          id: 'cortex',
          code: 'HBOM-01 // CÓRTEX',
          zone: 'Interfaz cerebro-computadora',
          name: 'Neural Bridge N9',
          oem: 'Axon Forge Labs',
          status: 'ACTIVE',
          statusTone: 'mint',
          story: 'Puente neuronal de baja latencia. Solo acepta parches firmados por su fabricante con ML-DSA-87.',
          passWindow: '2 h · solo telemetría',
          firmwareHash: '0x9f4a…c21e',
        },
        {
          id: 'retina',
          code: 'HBOM-02 // RETINA',
          zone: 'Óptica aumentada',
          name: 'Photon Iris Q4',
          oem: 'Lumen Optics',
          status: 'MAINTENANCE',
          statusTone: 'amber',
          story: 'Implante óptico en recalibración. Su historial de firmware es inmutable y auditable por cualquiera.',
          passWindow: '45 min · diagnóstico',
          firmwareHash: '0x4b12…88d0',
        },
        {
          id: 'heart',
          code: 'HBOM-03 // CARDIO',
          zone: 'Sistema cardiopulmonar',
          name: 'PulseCore V3',
          oem: 'Helix Bio-Foundry',
          status: 'ACTIVE',
          statusTone: 'mint',
          story: 'Órgano bio-impreso con telemetría cifrada de extremo a extremo durante toda la vida del portador.',
          passWindow: '30 min · cardiología',
          firmwareHash: '0x2d88…f04c',
        },
        {
          id: 'arm',
          code: 'HBOM-04 // EXTREMIDAD',
          zone: 'Actuador motor derecho',
          name: 'Myo-Dex Arm T7',
          oem: 'Aether Cybernetics',
          status: 'ACTIVE',
          statusTone: 'pink',
          story: 'Prótesis mioeléctrica. El portador abre ventanas de calibración sin ceder nunca el control raíz.',
          passWindow: '2 h · telemetría motora',
          firmwareHash: '0x7e01…a93b',
        },
      ],
      lifecycleTitle: 'Ciclo de vida de cada pieza, on-chain',
      lifecycle: [
        { code: 'REGISTRO', title: 'El fabricante la registra', body: 'partId = keccak256(fabricante, serial), con zona anatómica, modelo y hashes.' },
        { code: 'FIRMWARE', title: 'Cada parche queda firmado', body: 'Solo el fabricante publica firmware; la firma ML-DSA-87 completa queda en un evento.' },
        { code: 'ESTADO', title: 'ACTIVE · MAINTENANCE · DECOMMISSIONED', body: 'DECOMMISSIONED es terminal: una pieza retirada no vuelve a la vida.' },
      ],
      honestNote:
        'Verificación real on-chain: QoreChain Diana Testnet valida la firma ML-DSA-87 (4,627 B) con los precompilados nativos pqcKeyStatus (0x…0a02) y pqcVerify (0x…0a01).',
    },
    audience: {
      hudTag: 'PARA QUIÉN',
      title: 'Tres actores. Ninguno con la llave permanente.',
      items: [
        {
          code: 'PACIENTES · CIBER-HUMANOS',
          title: 'Tu cuerpo, tus reglas',
          body: 'Decides quién ve qué, durante cuánto tiempo, y lo apagas todo con un clic.',
          gain: 'Control y Kill-Switch',
          tone: 'mint',
        },
        {
          code: 'CLÍNICAS · ESPECIALISTAS',
          title: 'Acceso sin custodia',
          body: 'Lees en memoria lo que necesitas, sin almacenar datos ajenos ni cargar con su riesgo.',
          gain: 'Menos responsabilidad, más confianza',
          tone: 'blue',
        },
        {
          code: 'FABRICANTES OEM',
          title: 'Implantes auditables',
          body: 'Registro único por pieza y un historial de firmware firmado que nadie puede reescribir.',
          gain: 'Trazabilidad post-cuántica',
          tone: 'pink',
        },
      ],
    },
    modules: {
      hudTag: 'ACTO III // YA EXISTE HOY',
      title: 'El futuro ya tiene arquitectura. Pruébala hoy.',
      lead: 'SynapseQ ya corre con un contrato inteligente, criptografía post-cuántica real en el navegador y un Key-Release Gateway Zero-Trust. Elige por dónde entrar.',
      cards: [
        {
          hudTag: 'MÓDULO 01 // PACIENTE',
          tabParam: 'patient-vault',
          title: 'Bóveda del Paciente',
          tagline: 'Soberanía clínica en tus manos',
          description: 'Cifra en local, sella con ML-KEM-1024 y emite pases con cuenta regresiva y Kill-Switch.',
          bullets: ['AES-256-GCM + ML-KEM-1024', 'Pases con expiración on-chain', 'Revocación global O(1)'],
          cta: 'Abrir Bóveda',
          accent: 'mint',
        },
        {
          hudTag: 'MÓDULO 02 // CIBER-HUMANO',
          tabParam: 'cyber-hbom',
          title: 'Catálogo HBOM',
          tagline: 'Tu cuerpo, auditado pieza a pieza',
          description: 'Registra piezas biónicas, sigue sus parches ML-DSA-87 y su estado operativo.',
          bullets: ['partId por fabricante y serial', 'Historial inmutable de firmware', 'ACTIVE · MAINTENANCE · DECOMMISSIONED'],
          cta: 'Abrir Catálogo',
          accent: 'pink',
        },
        {
          hudTag: 'MÓDULO 03 // ESPECIALISTA',
          tabParam: 'specialist-portal',
          title: 'Portal Especialista',
          tagline: 'Zero-Trust, sin custodia permanente',
          description: 'Autenticación con wallet, verificación contra la cadena y descifrado solo en memoria.',
          bullets: ['Reto de un solo uso al gateway', 'Integridad SHAKE-256 verificada', 'Se apaga si el paciente revoca'],
          cta: 'Abrir Portal',
          accent: 'blue',
        },
      ],
      proofTitle: 'Lo que ya funciona',
      proof: [
        { label: 'CONTRATO', value: 'Foundry · 36 tests' },
        { label: 'RED', value: 'QoreChain Diana · 9800' },
        { label: 'PQC', value: 'QoreSeal + pqcVerify' },
        { label: 'GATEWAY', value: 'Zero-Trust · 4 suites' },
        { label: 'RECUPERACIÓN', value: 'Shamir 2-de-3' },
      ],
    },
    manifesto: {
      hudTag: 'MANIFIESTO',
      quoteA: 'Protegiendo la biología humana del presente. ',
      quoteB: 'Asegurando la soberanía ciber-humana ',
      quoteC: 'del mañana.',
      subcopy:
        'La transición hacia la era cuántica y el cuerpo aumentado no es un parche de software: es la frontera de la libertad humana.',
      ctaPrimary: 'Lanzar dApp',
      ctaGithub: 'Ver arquitectura en GitHub',
    },
    footer: {
      tagline: 'Post-Quantum Ephemeral Health & Cyber-Human Augmentation Vault',
      builtFor: 'Construido para QoreChain · Build Before Q-Day',
      wink: 'Nos vemos del otro lado.',
      teamLabel: 'Equipo: Oscar Riojas · Luis Felipe Marín · Jhon Tejada',
    },
  },
  en: {
    nav: {
      vision: 'Vision',
      present: '2026',
      future: '2045',
      modules: 'dApp',
      launchDapp: 'Launch dApp',
      skip: 'Skip to content',
    },
    hero: {
      hudBadge: 'POST-QUANTUM VAULT // BIO + CYBER-HUMAN',
      headlineA: "Your DNA can't change its password.",
      headlineB: 'Neither can your future bionic body.',
      subtitle:
        'A post-quantum vault for your medical history today and for every part of your body tomorrow. You lend access; nobody keeps the key.',
      ctaPrimary: 'Launch dApp',
      ctaSecondary: 'Start the journey',
      irisTop: 'BLUEPRINT 01 // SOVEREIGNTY IRIS',
      irisStatus: 'SOVEREIGN',
      irisCaption: 'Move your cursor: the core follows you',
      irisLabels: ['OUTER RING · ML-KEM-1024', 'INNER RING · ML-DSA-87', 'CORE · KILL-SWITCH O(1)'],
      scrollHint: 'Scroll to travel through',
      trustItems: [
        { label: 'SEALING', value: 'ML-KEM-1024' },
        { label: 'OEM SIGNATURE', value: 'ML-DSA-87' },
        { label: 'NETWORK', value: 'QoreChain · 9800' },
        { label: 'ACCESS', value: 'Zero-Trust' },
      ],
    },
    harvest: {
      hudTag: 'ACT I // 2026 · THE INVISIBLE PRESENT',
      title: 'Your data is already being harvested for tomorrow.',
      lead: 'A credit card can be cancelled in seconds. Your genome, your scans and your clinical history must stay private for decades. Meanwhile, adversaries store RSA- and ECC-encrypted traffic today to open it once quantum computers arrive: Harvest Now, Decrypt Later.',
      archiveLabel: 'HNDL ARCHIVE // CLASSICAL ENCRYPTION',
      archiveStatus: 'WAITING FOR Q-DAY',
      yearLabel: 'YOUR DATA IS STILL ALIVE IN',
      stats: [
        { value: 70, suffix: ' years', label: 'of confidentiality a clinical record demands' },
        { value: 0, suffix: '', label: 'new passwords your DNA can get after a breach' },
        { value: 1, suffix: ' Q-Day', label: 'is enough to open everything harvested with classical crypto' },
      ],
    },
    pipeline: {
      hudTag: 'HOW IT WORKS // 4 LAYERS',
      title: 'Cryptography that outlives the future, in your browser.',
      lead: "None of this happens on a server you have to trust. It happens on your device and is anchored on QoreChain.",
      steps: [
        {
          code: '01 · ENCRYPT',
          title: 'You encrypt in your browser',
          body: 'Files are encrypted locally with AES-256-GCM through Web Crypto. They never leave your device in the clear.',
          spec: 'AES-256-GCM · WEB CRYPTO',
          tone: 'mint',
        },
        {
          code: '02 · SEAL',
          title: 'You seal the key for one person',
          body: "The file key is encapsulated with the specialist's ML-KEM-1024 public key, published on-chain. Only that person can open it.",
          spec: 'ML-KEM-1024 · NIST FIPS 203 · 1,568 B',
          tone: 'blue',
        },
        {
          code: '03 · ANCHOR',
          title: 'You anchor only commitments',
          body: 'Only SHAKE-256 hashes of the ciphertext and the envelope go on-chain. The envelope and the CID never touch the contract.',
          spec: 'SHAKE-256 · QORECHAIN 9800',
          tone: 'amber',
        },
        {
          code: '04 · RELEASE',
          title: 'You release with a signed challenge',
          body: 'The Key-Release Gateway hands over the envelope only if the wallet signs a one-time challenge and the pass is still active on-chain.',
          spec: 'NONCE · CHAIN ID · RECORD ID',
          tone: 'pink',
        },
      ],
      tagline: 'Lend access. Never surrender ownership.',
    },
    killSwitch: {
      hudTag: 'ACT I // EPHEMERAL CONTROL',
      title: 'One switch to shut it all down.',
      lead: "Passes expire on their own. And if something feels off, you extinguish all of them at once.",
      pillars: [
        {
          code: '01 / EPHEMERAL PASS',
          title: 'Access for hours, not forever',
          body: 'Share a scan with a specialist for a time window. You can extend an active pass, but an expired or revoked one never comes back.',
          tone: 'mint',
        },
        {
          code: '02 / KILL-SWITCH O(1)',
          title: 'Global revocation in one operation',
          body: 'emergencyRevokeAll() bumps your on-chain epoch and invalidates every earlier pass at once, without iterating over them.',
          tone: 'pink',
        },
      ],
      sim: {
        hudTag: 'ILLUSTRATION // EPHEMERAL PASS',
        activeStatus: 'PASS ACTIVE',
        revokedStatus: 'REVOKED · EPOCH +1',
        passTitle: 'Cranial MRI + genomic profile',
        recipientLabel: 'SPECIALIST',
        recipientName: 'Dr. Elena Rostova · Neurology',
        scopeLabel: 'SCOPE',
        scopeValue: 'In-memory read',
        timerLabel: 'EXPIRES IN',
        demoLabel: 'ILLUSTRATION · LOOPS ON ITS OWN',
        killLabel: 'KILL-SWITCH',
        revokedNote: 'Epoch bumped. The gateway rejects any new delivery of the ML-KEM-1024 envelope.',
        activeNote: 'This is what a live pass looks like. In the dApp, one Kill-Switch shuts them all down at once.',
        otherPasses: ['Lab · 24 h', 'Second opinion · 6 h', 'Cardiology · 2 h'],
        epochLabel: 'EPOCH',
      },
      honestNote:
        "Honest limit: revoking blocks new deliveries; it can't erase what someone already decrypted in memory.",
    },
    qday: {
      hudTag: 'TRANSITION // Q-DAY',
      lines: [
        'One day, a quantum computer will break RSA.',
        'That day, a breach stops being a PDF.',
        'And your body will already run firmware.',
      ],
      warning: 'CLASSICAL ENCRYPTION COMPROMISED',
      fromLabel: 'TODAY',
      toLabel: 'TOMORROW',
    },
    bionic: {
      hudTag: 'ACT II // 2045 · THE AUGMENTED BODY',
      title: 'When the body runs firmware, privacy becomes survival.',
      lead: "Neural implants, photonic retinas, bionic arms, synthetic organs. Each part becomes your personal supply chain: a Human Bill of Materials (HBOM). If someone forges its signature, they don't steal data: they take control of a part of you.",
      hint: 'Scroll: the scanner walks through every HBOM part',
      inspectorLabels: { oem: 'MANUFACTURER', pass: 'BIO-ENGINEER PASS', firmware: 'LATEST FIRMWARE' },
      parts: [
        {
          id: 'cortex',
          code: 'HBOM-01 // CORTEX',
          zone: 'Brain-computer interface',
          name: 'Neural Bridge N9',
          oem: 'Axon Forge Labs',
          status: 'ACTIVE',
          statusTone: 'mint',
          story: 'Low-latency neural bridge. It only accepts patches signed by its manufacturer with ML-DSA-87.',
          passWindow: '2 h · telemetry only',
          firmwareHash: '0x9f4a…c21e',
        },
        {
          id: 'retina',
          code: 'HBOM-02 // RETINA',
          zone: 'Augmented optics',
          name: 'Photon Iris Q4',
          oem: 'Lumen Optics',
          status: 'MAINTENANCE',
          statusTone: 'amber',
          story: 'Optical implant under recalibration. Its firmware history is immutable and auditable by anyone.',
          passWindow: '45 min · diagnostics',
          firmwareHash: '0x4b12…88d0',
        },
        {
          id: 'heart',
          code: 'HBOM-03 // CARDIO',
          zone: 'Cardiopulmonary system',
          name: 'PulseCore V3',
          oem: 'Helix Bio-Foundry',
          status: 'ACTIVE',
          statusTone: 'mint',
          story: "Bio-printed organ with end-to-end encrypted telemetry for the bearer's entire life.",
          passWindow: '30 min · cardiology',
          firmwareHash: '0x2d88…f04c',
        },
        {
          id: 'arm',
          code: 'HBOM-04 // LIMB',
          zone: 'Right motor actuator',
          name: 'Myo-Dex Arm T7',
          oem: 'Aether Cybernetics',
          status: 'ACTIVE',
          statusTone: 'pink',
          story: 'Myoelectric prosthesis. The bearer opens calibration windows without ever giving up root control.',
          passWindow: '2 h · motor telemetry',
          firmwareHash: '0x7e01…a93b',
        },
      ],
      lifecycleTitle: 'Every part has an on-chain lifecycle',
      lifecycle: [
        { code: 'REGISTER', title: 'The manufacturer registers it', body: 'partId = keccak256(manufacturer, serial), with anatomical zone, model and hashes.' },
        { code: 'FIRMWARE', title: 'Every patch is signed', body: 'Only the manufacturer publishes firmware; the full ML-DSA-87 signature lives in an event.' },
        { code: 'STATUS', title: 'ACTIVE · MAINTENANCE · DECOMMISSIONED', body: 'DECOMMISSIONED is terminal: a retired part never comes back to life.' },
      ],
      honestNote:
        'Real on-chain verification: QoreChain Diana Testnet verifies the 4,627-byte ML-DSA-87 signature via native precompiles pqcKeyStatus (0x…0a02) and pqcVerify (0x…0a01).',
    },
    audience: {
      hudTag: 'WHO IT IS FOR',
      title: 'Three actors. None holds a permanent key.',
      items: [
        {
          code: 'PATIENTS · CYBER-HUMANS',
          title: 'Your body, your rules',
          body: 'Decide who sees what and for how long, and shut everything down with one click.',
          gain: 'Control and Kill-Switch',
          tone: 'mint',
        },
        {
          code: 'CLINICS · SPECIALISTS',
          title: 'Access without custody',
          body: "Read what you need in memory, without storing someone else's data or carrying its risk.",
          gain: 'Less liability, more trust',
          tone: 'blue',
        },
        {
          code: 'OEM MANUFACTURERS',
          title: 'Auditable implants',
          body: 'A unique record per part and a signed firmware history nobody can rewrite.',
          gain: 'Post-quantum traceability',
          tone: 'pink',
        },
      ],
    },
    modules: {
      hudTag: 'ACT III // ALREADY LIVE',
      title: 'The future already has an architecture. Try it today.',
      lead: 'SynapseQ already runs on a smart contract, real post-quantum cryptography in the browser and a Zero-Trust Key-Release Gateway. Pick your way in.',
      cards: [
        {
          hudTag: 'MODULE 01 // PATIENT',
          tabParam: 'patient-vault',
          title: 'Patient Vault',
          tagline: 'Clinical sovereignty in your hands',
          description: 'Encrypt locally, seal with ML-KEM-1024 and issue passes with a countdown and a Kill-Switch.',
          bullets: ['AES-256-GCM + ML-KEM-1024', 'Passes with on-chain expiry', 'O(1) global revocation'],
          cta: 'Open Vault',
          accent: 'mint',
        },
        {
          hudTag: 'MODULE 02 // CYBER-HUMAN',
          tabParam: 'cyber-hbom',
          title: 'HBOM Catalog',
          tagline: 'Your body, audited part by part',
          description: 'Register bionic parts, follow their ML-DSA-87 patches and operating status.',
          bullets: ['partId per manufacturer and serial', 'Immutable firmware history', 'ACTIVE · MAINTENANCE · DECOMMISSIONED'],
          cta: 'Open Catalog',
          accent: 'pink',
        },
        {
          hudTag: 'MODULE 03 // SPECIALIST',
          tabParam: 'specialist-portal',
          title: 'Specialist Portal',
          tagline: 'Zero-Trust, no permanent custody',
          description: 'Wallet authentication, verification against the chain and decryption in memory only.',
          bullets: ['One-time challenge to the gateway', 'SHAKE-256 integrity verified', 'Goes dark if the patient revokes'],
          cta: 'Open Portal',
          accent: 'blue',
        },
      ],
      proofTitle: 'What already works',
      proof: [
        { label: 'CONTRACT', value: 'Foundry · 36 tests' },
        { label: 'NETWORK', value: 'QoreChain Diana · 9800' },
        { label: 'PQC', value: 'QoreSeal + pqcVerify' },
        { label: 'GATEWAY', value: 'Zero-Trust · 4 suites' },
        { label: 'RECOVERY', value: 'Shamir 2-of-3' },
      ],
    },
    manifesto: {
      hudTag: 'MANIFESTO',
      quoteA: 'Protecting human biology today. ',
      quoteB: 'Securing cyber-human sovereignty ',
      quoteC: 'tomorrow.',
      subcopy:
        "The shift to the quantum era and the augmented body isn't a software patch: it is the frontier of human freedom.",
      ctaPrimary: 'Launch dApp',
      ctaGithub: 'See the architecture on GitHub',
    },
    footer: {
      tagline: 'Post-Quantum Ephemeral Health & Cyber-Human Augmentation Vault',
      builtFor: 'Built for QoreChain · Build Before Q-Day',
      wink: 'See you on the other side.',
      teamLabel: 'Team: Oscar Riojas · Luis Felipe Marín · Jhon Tejada',
    },
  },
};
