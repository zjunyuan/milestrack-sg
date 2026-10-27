import { ALL_MASTER_CARDS, DEFAULT_VAULT } from "./config.js";

export const state = {
  currentUser: null,
  myVaultKey: "primary",
  vaultLabel: "Household Vault",
  isAdmin: true,
  peerVaults: {},

  cards: JSON.parse(JSON.stringify(ALL_MASTER_CARDS)),
  enabledCardIds: ALL_MASTER_CARDS.map(c => c.id),
  transactions: [],
  vault: JSON.parse(JSON.stringify(DEFAULT_VAULT)),

  settings: {
    uobVsCutoff: 18,
    citiCutoff: 15,
    citiApprovalMonth: "2024-03",
    uobFeeAlerts: {
      "uob-ladys-solitaire": "2024-05",
      "uob-vs-contactless": "2024-08",
      "uob-ppv-contactless": "2024-10",
      "uob-prvi": "2024-11"
    }
  },

  isOverseasMode: false,
  isKrisPlusMode: false,
  isSingleSwipeMode: false,
  currentChannel: "inperson",
  currentTab: "cards"
};
