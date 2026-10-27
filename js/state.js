import { ALL_MASTER_CARDS, DEFAULT_VAULT } from "./config.js";

export const state = {
  currentUser: null,
  myVaultKey: "primary",
  peerVaultKey: "sister",
  currentChannel: "inperson",
  isKrisPlusMode: false,
  isOverseasMode: false,
  isSingleSwipeMode: false,
  txSearchQuery: "",
  txCardFilter: "ALL",
  enabledCardIds: ALL_MASTER_CARDS.map(c => c.id),
  cards: ALL_MASTER_CARDS,
  transactions: [],
  myVault: { ...DEFAULT_VAULT },
  peerVault: { ...DEFAULT_VAULT },
  citiApprovalDate: "2023-01",
  uobRenewals: {
    solitaire: "2023-11",
    visaSig: "2024-03",
    ppv: "2024-05",
    prvi: "2024-07"
  }
};
