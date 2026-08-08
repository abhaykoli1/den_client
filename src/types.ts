// Rowdy's Den — shared TypeScript types (mirror of the backend API surface).

export type Role = 'owner' | 'staff' | 'master'
export type SubStatus = 'pending' | 'trial' | 'active' | 'past_due' | 'paused' | 'expired' | 'cancelled'
export type BillingCycle = 'monthly' | 'yearly'
export type PaymentMode = 'cash' | 'upi' | 'card' | 'wallet' | 'due' | 'mixed'
export type PlanPaymentMode = 'cash' | 'upi' | 'card'
export type PlanType = 'wallet' | 'pass' | 'monthly'
export type MemberType = 'regular' | 'wallet' | 'pass' | 'due' | 'monthly'
export type MatchMode = 'solo' | '2v2'
export type Team = 'A' | 'B'
export type LogTag = 'BILLING' | 'PAYMENT' | 'WARNING' | 'ADMIN'
export type BillStatus = 'paid' | 'unpaid' | 'partial'

export interface AccountSubscription {
  planId?: string | null
  planName: string
  status: SubStatus
  price: number
  billingCycle: BillingCycle
  durationDays: number
  maxClubs: number
  selectedAt?: string | null
  startsAt?: string | null
  expiresAt?: string | null
  notes?: string | null
  updatedAt?: string | null
}

export interface AppUser {
  id: string
  email: string
  name: string
  picture?: string | null
  /** Login-account contact details — visible to Master Admin too. */
  phone?: string | null
  location?: string | null
  role: Role
  active: boolean
  clubIds: string[]
  subscription?: AccountSubscription | null
  createdAt?: string
  updatedAt?: string
  lastLoginAt?: string | null
}

/** A mail the system tried/produced — recorded in the `mailouts` collection. */
export interface Mailout {
  id: string
  to?: string | null
  subject: string
  kind: 'subscription' | 'plan_sold' | 'balance_notify' | 'plan_expired' | string
  clubId?: string | null
  userId?: string | null
  memberId?: string | null
  sent: boolean
  error?: string | null
  createdAt: string
}

export interface SaaSPlan {
  id: string
  name: string
  description?: string | null
  price: number
  billingCycle: BillingCycle
  durationDays: number
  trialDays: number
  maxClubs: number
  features: string[]
  active: boolean
  recommended: boolean
  sortOrder: number
  createdAt?: string
  updatedAt?: string
}

export interface ClubSettings {
  winnerBonus: number
  dueLimit: number
  defaultAdvance: number
  currency: string
  currencySymbol: string
  monthlyTableDiscount: number
}

export interface Club {
  id: string
  name: string
  logo?: string | null
  ownerUserId?: string | null
  settings: ClubSettings
  createdAt?: string
}

export interface TableRate {
  hourlyRate: number
  ratesByPlayers?: Record<string, number>
  minCharge: number
  peakHourlyRate?: number | null
  peakStartHour?: number | null
  peakEndHour?: number | null
  /** Per-glove charge when an assigned glove is not returned by billing. 0 = off. */
  glovePrice?: number | null
}

export interface ClubTable {
  id: string
  clubId: string
  name: string
  active: boolean
  rate: TableRate
  sortOrder: number
}

export interface MembershipPlan {
  id: string
  clubId: string
  name: string
  type: PlanType
  amount: number
  value: number
  days: number
  tableDiscountPercent: number
  isDefault: boolean
  active: boolean
  description?: string | null
  createdAt?: string
}

export interface Member {
  id: string
  clubId: string
  name: string
  phone: string
  email?: string | null
  type: MemberType
  walletBalance: number
  dueAmount: number
  passFramesLeft: number
  planId?: string | null
  planName?: string | null
  planType?: PlanType | null
  planExpiresAt?: string | null
  tableDiscountPercent: number
  active: boolean
  notes?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface SessionPlayer {
  id: string
  slot: string
  label: string
  type: 'guest' | 'member' | 'new_guest'
  memberId?: string | null
  isWinner?: boolean
  team?: Team | null
}

export interface BillLineItem {
  itemId: string
  name: string
  qty: number
  price: number
  amount: number
}

export interface ActiveSession {
  id: string
  tableId: string
  tableName?: string
  clubId: string
  startedAt: string
  endedAt?: string | null
  players: SessionPlayer[]
  playerCount: number
  hourlyRate: number
  minCharge: number
  matchMode: MatchMode
  itemsTotal: number
  items: BillLineItem[]
  discount: number
  advancePaid: number
  notes?: string | null
  billingLock?: boolean
  /** true when the session started inside the table's peak window. */
  peak?: boolean
  /** Gloves issued from the counter at start (price stamped then). */
  gloves?: SessionGlove[]
}

export interface SessionGlove {
  playerId: string
  label: string
  memberId?: string | null
  price: number
  returned: boolean
}

export interface Settlement {
  memberId: string
  memberName?: string
  amount: number
  kind: 'wallet' | 'due'
  walletPart?: number
  duePart?: number
  cashPart?: number
}

export interface FrameRecord {
  id: string
  clubId: string
  tableId: string
  tableName: string
  sessionId: string
  startedAt: string
  endedAt: string
  durationMinutes: number
  players: SessionPlayer[]
  winners: string[]
  winnerPlayerIds?: string[]
  losers: string[]
  loserPlayerIds?: string[]
  tableAmount: number
  itemsAmount: number
  items: BillLineItem[]
  hourlyRate: number
  minCharge?: number
  winnerBonus: number
  discount: number
  membershipDiscount: number
  membershipDiscountPercent: number
  membershipMemberName?: string | null
  passTableCredit: number
  passFramesUsed: number
  passMemberId?: string | null
  passMemberName?: string | null
  oldDueAmount?: number
  oldDueBefore?: Record<string, number>
  oldDuePaid?: Record<string, number>
  frameAmount?: number
  /** Gloves issued on this frame + the charge for ones never returned. */
  gloves?: SessionGlove[]
  gloveCharges?: number
  totalAmount: number
  /** Mid-session advance that was applied to this bill (logged when collected). */
  advancePaid?: number
  paidRequested?: number | null
  paidAmount: number
  dueAmount: number
  paymentMode: PaymentMode
  requestedPaymentMode?: PaymentMode
  status: BillStatus
  matchMode: MatchMode
  winningTeam?: Team | null
  settlements: Settlement[]
  notes?: string | null
  createdAt: string
}

export interface MenuItem {
  id: string
  clubId: string
  name: string
  category: string
  price: number
  costPrice: number
  stockQty: number
  active: boolean
  unit?: string | null
  /** Per-item low-stock alert threshold (default 5). */
  reorderLevel?: number
}

export interface Expense {
  id: string
  clubId: string
  title: string
  category: string
  amount: number
  date: string
  note?: string | null
  refType?: string | null
  refId?: string | null
  createdAt?: string
}

export interface ItemBill {
  id: string
  clubId: string
  customerName: string
  memberId?: string | null
  memberName?: string | null
  items: BillLineItem[]
  subtotal: number
  discount: number
  total: number
  paidAmount: number
  dueAmount: number
  walletPart?: number
  duePart?: number
  paymentMode: PaymentMode
  status: BillStatus
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export interface ActivityLog {
  id: string
  clubId: string
  memberId?: string | null
  memberName?: string | null
  tag: LogTag
  message: string
  type?: string | null
  amount?: number | null
  mode?: string | null
  note?: string | null
  refType?: 'frame' | 'item_bill' | 'manual' | 'membership' | null
  refId?: string | null
  createdAt: string
}

export interface MembershipSale {
  id: string
  clubId: string
  memberId: string
  memberName: string
  planId: string
  planName: string
  planType: PlanType
  amount: number
  value: number
  tableDiscountPercent: number
  mode: PlanPaymentMode
  createdAt: string
}

export interface ClubStats {
  clubId: string
  totalDue: number
  todayEarnings: number
  dueLimit: number
  activeMembers: number
  activeSessions: number
  today: string
  currency: string
  currencySymbol: string
}

export interface ClubData {
  club: Club
  tables: ClubTable[]
  members: Member[]
  plans: MembershipPlan[]
  sessions: ActiveSession[]
  frames: FrameRecord[]
  menuItems: MenuItem[]
  itemBills: ItemBill[]
  expenses: Expense[]
  membershipSales: MembershipSale[]
  logs: ActivityLog[]
  stats: ClubStats
}

export interface FinanceReport {
  month: string
  income: {
    frames: number
    items: number
    memberships: number
    dueCollections: number
    tournaments: number
    total: number
    counts: { frames: number; itemBills: number; memberships: number; duePayments: number; tournaments: number }
  }
  expenses: {
    total: number
    byCategory: Array<{ category: string; amount: number; count: number }>
    rows: Expense[]
  }
  stock: {
    items: Array<{
      itemId: string | null
      name: string
      category: string
      qtySold: number
      revenue: number
      cogs: number
      profit: number
    }>
    totalRevenue: number
    totalCogs: number
    totalProfit: number
  }
  pnl: { incomeTotal: number; expenseTotal: number; netProfit: number }
  balanceSheet: {
    assets: { receivables: number; inventory: number }
    liabilities: { memberWallets: number }
    netPosition: number
  }
  daily: Array<{ date: string; income: number; expenses: number; net: number; balance: number }>
}

export interface MonthlyReport {
  month: string
  sourceTotals: { frames: number; items: number; memberships: number; dueCollections: number; tournaments: number }
  totalEarnings: number
  counts: { frames: number; itemBills: number; memberships: number; duePayments: number; tournaments: number }
  daily: Array<{ date: string; frames: number; items: number; memberships: number; dueCollections: number; tournaments: number; total: number }>
  rows: Array<{ createdAt: string; source: string; label: string; amount: number; mode: string }>
}

// ------------------------------------------------------------- tournaments

export type TournamentStatus = 'upcoming' | 'running' | 'completed' | 'cancelled'

export interface TournamentPlayer {
  pid: string
  name: string
  phone?: string | null
  memberId?: string | null
  paidEntry: boolean
  seed: number
}

export interface TournamentMatch {
  id: string
  round: number
  label: string
  p1: { pid: string; name: string } | null
  p2: { pid: string; name: string } | null
  score1: number | null
  score2: number | null
  winnerPid: string | null
  loserPid?: string | null
  status: 'pending' | 'table_live' | 'played' | 'bye'
  tableId?: string | null
  tableName?: string | null
  startedAt?: string | null
  endedAt?: string | null
  minutes?: number | null
  tableAmount?: number | null
  playedAt?: string | null
}

export interface LeagueStanding {
  pid: string
  name: string
  played: number
  won: number
  lost: number
  scoreFor: number
  scoreAgainst: number
  scoreDiff: number
  points: number
}

export interface Tournament {
  id: string
  clubId: string
  name: string
  game: string
  date: string
  entryFee: number
  prize1: number
  prize2: number
  maxPlayers: number
  status: TournamentStatus
  participants: TournamentPlayer[]
  matches: TournamentMatch[]
  tableRate: number
  bracket: number
  /** knockout = single-elim bracket · league = round-robin + points table */
  format?: 'knockout' | 'league'
  standings?: LeagueStanding[]
  winnerPid?: string | null
  winnerName?: string | null
  runnerUpName?: string | null
  notes?: string | null
  playerCount: number
  collected: number
  tableCharges: number
  createdAt?: string
  updatedAt?: string
  completedAt?: string | null
}

// ------------------------------------------------------------- team

export interface TeamStaff {
  id: string
  name: string
  email: string
  role: Role
  picture?: string | null
  active: boolean
  lastLoginAt?: string | null
  isOwner: boolean
}

export interface TeamClubRow {
  club: { id: string; name: string }
  staff: TeamStaff[]
}

// ------------------------------------------------------------- day close & utilisation

export interface DayCloseReport {
  date: string
  clubName?: string
  byMode: Record<string, number>
  bySource: Record<string, number>
  collected: number
  counts: { payments: number; frames: number; itemBills: number; memberships: number; duePayments: number; tournaments: number }
  expenses: { total: number; count: number; byCategory: Array<{ category: string; amount: number }> }
  net: number
  frames: { count: number; tableAmount: number; itemsAmount: number }
  topItems: Array<{ name: string; qty: number; revenue: number; profit: number }>
  liveSessions: number
  totalDueNow: number
}

export interface UtilisationReport {
  month: string
  clubName?: string
  tables: Array<{ tableId: string; tableName: string; frames: number; minutes: number; revenue: number }>
  hours: Array<{ hour: number; frames: number; minutes: number }>
  peakHour: number | null
  totalMinutes: number
  totalRevenue: number
}
