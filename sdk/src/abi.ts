// Auto-generated from contracts/src/SynapseVaultRegistry.sol (v2) via `forge inspect SynapseVaultRegistry abi --json`.
// Regenerate after any contract change.
export const SYNAPSE_VAULT_ABI = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "requirePossessionProof_",
        "type": "bool"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "FIRMWARE_ATTESTATION_DOMAIN",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_ACCESS_DURATION",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "ML_DSA_87_ALGORITHM_ID",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "ML_DSA_87_PUBLIC_KEY_BYTES",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "ML_DSA_87_SIGNATURE_BYTES",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "ML_KEM_1024_PUBLIC_KEY_BYTES",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "PQC_KEY_STATUS_PRECOMPILE",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "PQC_VERIFY_PRECOMPILE",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "computePartId",
    "inputs": [
      {
        "name": "manufacturer",
        "type": "address"
      },
      {
        "name": "serialNumber",
        "type": "string"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "computeRecordId",
    "inputs": [
      {
        "name": "patient",
        "type": "address"
      },
      {
        "name": "salt",
        "type": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "emergencyRevokeAll",
    "inputs": [],
    "outputs": [
      {
        "name": "newEpoch",
        "type": "uint32"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "extendAccess",
    "inputs": [
      {
        "name": "recordId",
        "type": "bytes32"
      },
      {
        "name": "extraSeconds",
        "type": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "firmwareAttestationMessage",
    "inputs": [
      {
        "name": "partId",
        "type": "bytes32"
      },
      {
        "name": "version",
        "type": "uint32"
      },
      {
        "name": "firmwareHash",
        "type": "bytes32"
      },
      {
        "name": "calibrationHash",
        "type": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getBionicPart",
    "inputs": [
      {
        "name": "partId",
        "type": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "components": [
          {
            "name": "bearer",
            "type": "address"
          },
          {
            "name": "implantedAt",
            "type": "uint64"
          },
          {
            "name": "firmwareVersion",
            "type": "uint32"
          },
          {
            "name": "manufacturer",
            "type": "address"
          },
          {
            "name": "lastUpdatedAt",
            "type": "uint64"
          },
          {
            "name": "zone",
            "type": "uint8"
          },
          {
            "name": "status",
            "type": "uint8"
          },
          {
            "name": "firmwareHash",
            "type": "bytes32"
          },
          {
            "name": "calibrationHash",
            "type": "bytes32"
          },
          {
            "name": "pqcSignatureHash",
            "type": "bytes32"
          },
          {
            "name": "modelName",
            "type": "string"
          },
          {
            "name": "serialNumber",
            "type": "string"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getFirmwareHistory",
    "inputs": [
      {
        "name": "partId",
        "type": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple[]",
        "components": [
          {
            "name": "updatedBy",
            "type": "address"
          },
          {
            "name": "timestamp",
            "type": "uint64"
          },
          {
            "name": "version",
            "type": "uint32"
          },
          {
            "name": "firmwareHash",
            "type": "bytes32"
          },
          {
            "name": "calibrationHash",
            "type": "bytes32"
          },
          {
            "name": "pqcSignatureHash",
            "type": "bytes32"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getGrantMetadata",
    "inputs": [
      {
        "name": "recordId",
        "type": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "components": [
          {
            "name": "contentHash",
            "type": "bytes32"
          },
          {
            "name": "envelopeHash",
            "type": "bytes32"
          },
          {
            "name": "linkedPartId",
            "type": "bytes32"
          },
          {
            "name": "patient",
            "type": "address"
          },
          {
            "name": "specialist",
            "type": "address"
          },
          {
            "name": "domain",
            "type": "uint8"
          },
          {
            "name": "createdAt",
            "type": "uint64"
          },
          {
            "name": "validUntil",
            "type": "uint64"
          },
          {
            "name": "revoked",
            "type": "bool"
          },
          {
            "name": "isActive",
            "type": "bool"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getGrantsByPatient",
    "inputs": [
      {
        "name": "patient",
        "type": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getGrantsBySpecialist",
    "inputs": [
      {
        "name": "specialist",
        "type": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getKemPublicKey",
    "inputs": [
      {
        "name": "account",
        "type": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getPartsByBearer",
    "inputs": [
      {
        "name": "bearer",
        "type": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "grantTimedAccess",
    "inputs": [
      {
        "name": "salt",
        "type": "bytes32"
      },
      {
        "name": "contentHash",
        "type": "bytes32"
      },
      {
        "name": "envelopeHash",
        "type": "bytes32"
      },
      {
        "name": "linkedPartId",
        "type": "bytes32"
      },
      {
        "name": "specialist",
        "type": "address"
      },
      {
        "name": "domain",
        "type": "uint8"
      },
      {
        "name": "durationInSeconds",
        "type": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "recordId",
        "type": "bytes32"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "hasKemPublicKey",
    "inputs": [
      {
        "name": "account",
        "type": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isAccessValid",
    "inputs": [
      {
        "name": "recordId",
        "type": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "logFirmwareUpdate",
    "inputs": [
      {
        "name": "partId",
        "type": "bytes32"
      },
      {
        "name": "newFirmwareHash",
        "type": "bytes32"
      },
      {
        "name": "newCalibrationHash",
        "type": "bytes32"
      },
      {
        "name": "pqcSignature",
        "type": "bytes"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "patientEpoch",
    "inputs": [
      {
        "name": "",
        "type": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "registerBionicPart",
    "inputs": [
      {
        "name": "bearer",
        "type": "address"
      },
      {
        "name": "zone",
        "type": "uint8"
      },
      {
        "name": "modelName",
        "type": "string"
      },
      {
        "name": "serialNumber",
        "type": "string"
      },
      {
        "name": "firmwareHash",
        "type": "bytes32"
      },
      {
        "name": "calibrationHash",
        "type": "bytes32"
      },
      {
        "name": "pqcSignature",
        "type": "bytes"
      }
    ],
    "outputs": [
      {
        "name": "partId",
        "type": "bytes32"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "registerKemPublicKey",
    "inputs": [
      {
        "name": "pubKey",
        "type": "bytes"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "requirePossessionProof",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "revokeAccess",
    "inputs": [
      {
        "name": "recordId",
        "type": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "updatePartStatus",
    "inputs": [
      {
        "name": "partId",
        "type": "bytes32"
      },
      {
        "name": "newStatus",
        "type": "uint8"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "AccessExtended",
    "inputs": [
      {
        "name": "recordId",
        "type": "bytes32",
        "indexed": true
      },
      {
        "name": "patient",
        "type": "address",
        "indexed": true
      },
      {
        "name": "newValidUntil",
        "type": "uint64",
        "indexed": false
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "AccessGranted",
    "inputs": [
      {
        "name": "recordId",
        "type": "bytes32",
        "indexed": true
      },
      {
        "name": "patient",
        "type": "address",
        "indexed": true
      },
      {
        "name": "specialist",
        "type": "address",
        "indexed": true
      },
      {
        "name": "linkedPartId",
        "type": "bytes32",
        "indexed": false
      },
      {
        "name": "domain",
        "type": "uint8",
        "indexed": false
      },
      {
        "name": "validUntil",
        "type": "uint64",
        "indexed": false
      },
      {
        "name": "contentHash",
        "type": "bytes32",
        "indexed": false
      },
      {
        "name": "envelopeHash",
        "type": "bytes32",
        "indexed": false
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "AccessRevoked",
    "inputs": [
      {
        "name": "recordId",
        "type": "bytes32",
        "indexed": true
      },
      {
        "name": "patient",
        "type": "address",
        "indexed": true
      },
      {
        "name": "revokedAt",
        "type": "uint64",
        "indexed": false
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "BionicPartRegistered",
    "inputs": [
      {
        "name": "partId",
        "type": "bytes32",
        "indexed": true
      },
      {
        "name": "bearer",
        "type": "address",
        "indexed": true
      },
      {
        "name": "manufacturer",
        "type": "address",
        "indexed": true
      },
      {
        "name": "zone",
        "type": "uint8",
        "indexed": false
      },
      {
        "name": "modelName",
        "type": "string",
        "indexed": false
      },
      {
        "name": "firmwareHash",
        "type": "bytes32",
        "indexed": false
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "EmergencyKillSwitchActivated",
    "inputs": [
      {
        "name": "patient",
        "type": "address",
        "indexed": true
      },
      {
        "name": "newEpoch",
        "type": "uint32",
        "indexed": false
      },
      {
        "name": "timestamp",
        "type": "uint64",
        "indexed": false
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "FirmwareAttestation",
    "inputs": [
      {
        "name": "partId",
        "type": "bytes32",
        "indexed": true
      },
      {
        "name": "version",
        "type": "uint32",
        "indexed": true
      },
      {
        "name": "signatureHash",
        "type": "bytes32",
        "indexed": false
      },
      {
        "name": "pqcSignature",
        "type": "bytes",
        "indexed": false
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "FirmwareUpdated",
    "inputs": [
      {
        "name": "partId",
        "type": "bytes32",
        "indexed": true
      },
      {
        "name": "version",
        "type": "uint32",
        "indexed": true
      },
      {
        "name": "firmwareHash",
        "type": "bytes32",
        "indexed": false
      },
      {
        "name": "updatedBy",
        "type": "address",
        "indexed": true
      },
      {
        "name": "timestamp",
        "type": "uint64",
        "indexed": false
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "KemPublicKeyRegistered",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "indexed": true
      },
      {
        "name": "keyLength",
        "type": "uint256",
        "indexed": false
      },
      {
        "name": "timestamp",
        "type": "uint64",
        "indexed": false
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PartStatusChanged",
    "inputs": [
      {
        "name": "partId",
        "type": "bytes32",
        "indexed": true
      },
      {
        "name": "oldStatus",
        "type": "uint8",
        "indexed": false
      },
      {
        "name": "newStatus",
        "type": "uint8",
        "indexed": false
      },
      {
        "name": "timestamp",
        "type": "uint64",
        "indexed": false
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "AccessAlreadyRevoked",
    "inputs": []
  },
  {
    "type": "error",
    "name": "AccessExpired",
    "inputs": []
  },
  {
    "type": "error",
    "name": "EmptySignature",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidDuration",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidHash",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidKemPublicKey",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidSignatureLength",
    "inputs": [
      {
        "name": "length",
        "type": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "PartAlreadyRegistered",
    "inputs": []
  },
  {
    "type": "error",
    "name": "PartDecommissioned",
    "inputs": []
  },
  {
    "type": "error",
    "name": "PartNotFound",
    "inputs": []
  },
  {
    "type": "error",
    "name": "PqcKeyNotRegistered",
    "inputs": [
      {
        "name": "account",
        "type": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "PqcPossessionNotProven",
    "inputs": [
      {
        "name": "account",
        "type": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "PqcSignatureInvalid",
    "inputs": []
  },
  {
    "type": "error",
    "name": "PqcUnavailable",
    "inputs": []
  },
  {
    "type": "error",
    "name": "PqcUnsupportedAlgorithm",
    "inputs": [
      {
        "name": "algorithmId",
        "type": "uint8"
      }
    ]
  },
  {
    "type": "error",
    "name": "RecordAlreadyExists",
    "inputs": []
  },
  {
    "type": "error",
    "name": "RecordNotFound",
    "inputs": []
  },
  {
    "type": "error",
    "name": "Unauthorized",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ZeroAddress",
    "inputs": []
  }
] as const;
