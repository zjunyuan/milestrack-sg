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
  txSelect: { on: false, ids: new Set() },   // History select mode (mass delete)
  txView: { sortKey: 'date', sortDir: 'desc', category: 'ALL', amtMin: '', amtMax: '', transFrom: '', transTo: '', postFrom: '', postTo: '' },   // History table: sort, category, amount range, date ranges
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
  },
  uobStatementDay: 23,   // day of the month UOB statements come out (annual fee alert starts then)
  stmtCoverage: {},      // statement months imported: { [cardKey]: { "YYYY-MM": { n, at } } }
  feeCards: {},          // fee alert dates for non-UOB cards: { [cardKey]: { renewal: "YYYY-MM", day: 1-31 } }
  feeAlerts: {}          // per UOB card: { cycle: "2026-08", status: "requested" | "snoozed", until: ms }
};
