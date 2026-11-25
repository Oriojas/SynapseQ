export const SYNAPSE_VAULT_ABI = [
  {
    type: "function",
    name: "registerBionicPart",
    inputs: [
      { name: "partId", type: "bytes32" },
      { name: "manufacturer", type: "address" },
      { name: "zone", type: "uint8" },
      { name: "modelName", type: "string" },
      { name: "serialNumber", type: "string" },
      { name: "firmwareHash", type: "bytes32" },
      { name: "calibrationHash", type: "bytes32" },
      { name: "pqcSignature", type: "bytes" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "logFirmwareUpdate",
    inputs: [
      { name: "partId", type: "bytes32" },
      { name: "newFirmwareHash", type: "bytes32" },
      { name: "newCalibrationHash", type: "bytes32" },
      { name: "pqcSignature", type: "bytes" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "grantTimedAccess",
    inputs: [
      { name: "recordId", type: "bytes32" },
      { name: "ipfsCID", type: "string" },
      { name: "contentHash", type: "bytes32" },
      { name: "linkedPartId", type: "bytes32" },
      { name: "specialist", type: "address" },
      { name: "encryptedKeyEnvelope", type: "bytes" },
      { name: "domain", type: "uint8" },
      { name: "durationInSeconds", type: "uint256" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "getRecordForSpecialist",
    inputs: [{ name: "recordId", type: "bytes32" }],
    outputs: [
      { name: "ipfsCID", type: "string" },
      { name: "contentHash", type: "bytes32" },
      { name: "linkedPartId", type: "bytes32" },
      { name: "encryptedKeyEnvelope", type: "bytes" },
      { name: "domain", type: "uint8" },
      { name: "validUntil", type: "uint64" }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "isAccessValid",
    inputs: [{ name: "recordId", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "revokeAccess",
    inputs: [{ name: "recordId", type: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "emergencyRevokeAll",
    inputs: [],
    outputs: [{ name: "revokedCount", type: "uint256" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "getBionicPart",
    inputs: [{ name: "partId", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "partId", type: "bytes32" },
          { name: "bearer", type: "address" },
          { name: "manufacturer", type: "address" },
          { name: "zone", type: "uint8" },
          { name: "status", type: "uint8" },
          { name: "modelName", type: "string" },
          { name: "serialNumber", type: "string" },
          { name: "firmwareHash", type: "bytes32" },
          { name: "calibrationHash", type: "bytes32" },
          { name: "pqcSignature", type: "bytes" },
          { name: "implantedAt", type: "uint64" },
          { name: "lastUpdatedAt", type: "uint64" },
          { name: "firmwareVersion", type: "uint32" }
        ]
      }
    ],
    stateMutability: "view"
  }
] as const;
