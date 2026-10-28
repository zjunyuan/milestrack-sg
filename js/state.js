import { ALL_MASTER_CARDS, DEFAULT_VAULT } from "./config.js";

export const state = {
  currentUser: null,
  userRole: "GUEST",      // PRIMARY | SISTER | ELLICE | EUGENE | TEST | GUEST
  allVaultsData: {},      // PRIMARY only: live copy of every vault doc
  myVaultKey: "primary",
  currentChannel: "inperson",
  isKrisPlusMode: false,
  searchMode: "retailer",       // recommender search box: "retailer" | "mcc" (js/search-mode.js)
  isOverseasMode: false,
  isSingleSwipeMode: false,
  merchantOverrides: {},   // household brand->MCC corrections (Firestore milestrack_merchants)
  selectedRetailer: null,  // { name, mcc } picked from the typeahead or an alt-category chip
  mccRules: {},            // household card rules per MCC, set by the admin (Firestore milestrack_mccRules)
  txSearchQuery: "",
  txCardFilter: "ALL",
  enabledCardIds: ALL_MASTER_CARDS.map(c => c.id),
  cards: ALL_MASTER_CARDS,
  transactions: [],
  myVault: { ...DEFAULT_VAULT },
  citiApprovalDate: "2023-01",
  uobRenewals: {
    solitaire: "2023-11",
    visaSig: "2024-03",
    ppv: "2024-05",
    prvi: "2024-07",
    kf: ""
  }
};
