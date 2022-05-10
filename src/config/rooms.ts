export enum RoomGroups {
  common = "common",
  engineering = "engineering",
  infra = "infra",
}

/* eslint-disable */
export const groupedRooms: { [k: string]: string[] } = {
  [RoomGroups.common]: [
    '!DsFdtakbJIgTjrIEzf:matrix.parity.io', // Parity Liedown
    '!sdFqbvLCnbwaqBLiGw:matrix.parity.io', // Parity Dumb Questions
    '!fIDSZhCwduakimUvUR:matrix.parity.io', // Parity Forum
    '!nZVIsjouiWCWuvbFOG:matrix.parity.io', // Parity Conferences
    '!NdxrIlxGUHXYwtRGrF:matrix.parity.io', // Parity General
    '!mbjCezomxKuQIIZrtL:matrix.parity.io', // Parity TechOps Watercooler
    '!rYwGSweasiVlLZdftO:matrix.parity.io', // Parity IO
    '!emIudoSRVQMhILqleG:matrix.parity.io', // Parity Simply Love ❤️✨
    '!MNNdgVPLqzMqdZKYZv:matrix.parity.io', // Parity Announcements
    '!KmcPJDgRVCqtJSnwQc:matrix.parity.io', // Today I Learned
    '!JHwHMYLkHwAAqxjKgQ:matrix.parity.io', // Parity Social
    '!vXIdAPypKvKVuztdqw:matrix.parity.io', // Parity Retreat
    '!MjwzeAZAraDJjlEZKF:matrix.parity.io', // Berlin Lunch Train
    '!QlzEduKSoUTveNlXKu:matrix.parity.io', // Parity Lisbon Office
    '!rOvpVjZCuxwdGDoiZs:matrix.parity.io', // Parity Berlin Office
    '!aenJixaHcSKbJOWxYk:matrix.parity.io', // Substrate
    '!qoanQXLalRnFLPuvtV:matrix.parity.io', // Engineering Updates
    // // temporary
    '!TMIbnEhhKugsxnFEZD:matrix.parity.io', // Company Retreat 2022
  ],
  [RoomGroups.engineering]: [
    '!FdCojkeGzZLSEoiecf:web3.foundation',  // Polkadot Watercooler
    '!HzySYSaIhtyWrwiwEV:matrix.org',       // Substrate Technical (Public)
    '!AtgPynFxLJGFYkAZEl:matrix.parity.io', // Parity Support (Public)
    '!IWlcTyHSqIEjpUReHD:matrix.parity.io', // Parity Watercooler (Public)
  ],
  [RoomGroups.infra]: [
    '!gJeGMHCcDoIwsHIJri:matrix.parity.io', // CI/CD
    '!gYqcPOpJPouwsLuNiJ:matrix.parity.io', // DevOps Announcements
    '!zlbZeGdMXSdHhLUOGw:matrix.parity.io', // Parity Devops
    '!GGBcssYxoLuUHhpuGi:matrix.parity.io', // Westend DevOps
    '!aLcsDaOyoXfxOeaTFI:matrix.parity.io', // Parity OpsTooling
  ],
}

/* eslint-enable */
