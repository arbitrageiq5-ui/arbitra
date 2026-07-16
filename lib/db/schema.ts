import { pgTable, text, timestamp, boolean, serial, decimal, integer } from 'drizzle-orm/pg-core'

// --- Better Auth required tables -------------------------------------------
// Column names are camelCase to match Better Auth's defaults. Do not rename.

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  role: text('role').default('viewer').notNull(), // 'viewer' | 'trader' | 'admin'
  // Referral & activation system
  referralCode: text('referral_code').unique(),
  referredBy: text('referred_by'), // userId of referrer (no FK to avoid circular)
  isActivated: boolean('is_activated').notNull().default(false),
  activationPaidAt: timestamp('activation_paid_at'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
})

// --- App tables - Arbitrage Platform -------------------------------------------

export const exchangeAccounts = pgTable('exchange_accounts', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  exchange: text('exchange').notNull(),
  label: text('label'),
  apiKey: text('apiKey').notNull(),
  apiSecret: text('apiSecret').notNull(),
  passphrase: text('passphrase'),
  tradeMode: text('trade_mode').notNull().default('read_only'), // 'read_only' | 'live'
  isActive: boolean('isActive').default(true),
  lastTestedAt: timestamp('last_tested_at'),
  testStatus: text('test_status'), // 'ok' | 'error' | message
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
})

export const priceHistory = pgTable('price_history', {
  id: serial('id').primaryKey(),
  symbol: text('symbol').notNull(),
  exchange: text('exchange').notNull(),
  price: decimal('price', { precision: 20, scale: 8 }).notNull(),
  timestamp: timestamp('timestamp').defaultNow(),
  createdAt: timestamp('createdAt').defaultNow(),
})

export const arbitrageOpportunities = pgTable('arbitrage_opportunities', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  symbol: text('symbol').notNull(),
  buyExchange: text('buyExchange').notNull(),
  sellExchange: text('sellExchange').notNull(),
  buyPrice: decimal('buyPrice', { precision: 20, scale: 8 }).notNull(),
  sellPrice: decimal('sellPrice', { precision: 20, scale: 8 }).notNull(),
  profitPercentage: decimal('profitPercentage', { precision: 10, scale: 4 }).notNull(),
  profitAmount: decimal('profitAmount', { precision: 20, scale: 8 }).notNull(),
  aiScore: decimal('aiScore', { precision: 5, scale: 2 }).default('0'),
  aiReasoning: text('aiReasoning'),
  status: text('status').default('pending'),
  isNotified: boolean('isNotified').default(false),
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
})

export const portfolio = pgTable('portfolio', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  symbol: text('symbol').notNull(),
  quantity: decimal('quantity', { precision: 20, scale: 8 }).notNull(),
  averageCost: decimal('averageCost', { precision: 20, scale: 8 }).notNull(),
  currentValue: decimal('currentValue', { precision: 20, scale: 8 }).notNull(),
  unrealizedGain: decimal('unrealizedGain', { precision: 20, scale: 8 }),
  isLive: boolean('isLive').default(false),
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
})

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  data: text('data'),
  isRead: boolean('isRead').default(false),
  createdAt: timestamp('createdAt').defaultNow(),
})

// --- RBAC Tables ---

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  resource: text('resource').notNull(),
  resourceId: serial('resourceId'),
  details: text('details'), // JSON stringified
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  createdAt: timestamp('createdAt').defaultNow(),
})

export const userPermissions = pgTable('user_permissions', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  resource: text('resource').notNull(),
  action: text('action').notNull(),
  granted: boolean('granted').default(true),
  grantedBy: text('grantedBy').references(() => user.id),
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
})

// --- Trade Orders ---

export const tradeOrders = pgTable('trade_orders', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  exchangeAccountId: integer('exchange_account_id').references(() => exchangeAccounts.id, { onDelete: 'set null' }),
  symbol: text('symbol').notNull(),
  side: text('side').notNull(),            // 'buy' | 'sell'
  orderType: text('order_type').notNull().default('market'),
  amount: decimal('amount', { precision: 20, scale: 8 }).notNull(),
  price: decimal('price', { precision: 20, scale: 8 }),
  filled: decimal('filled', { precision: 20, scale: 8 }).default('0'),
  cost: decimal('cost', { precision: 20, scale: 8 }).default('0'),
  fee: decimal('fee', { precision: 20, scale: 8 }).default('0'),
  exchange: text('exchange').notNull(),
  externalOrderId: text('external_order_id'),
  status: text('status').notNull().default('pending'), // pending|open|closed|canceled|failed
  tradeMode: text('trade_mode').notNull().default('paper'), // 'paper' | 'live'
  note: text('note'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

// --- Deposit / Fund Management ---

export const depositAddresses = pgTable('deposit_addresses', {
  id: serial('id').primaryKey(),
  network: text('network').notNull(), // 'TRC20' | 'BEP20' | 'ERC20'
  address: text('address').notNull(),
  label: text('label'),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: text('created_by').notNull().references(() => user.id, { onDelete: 'cascade' }),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const fundRequests = pgTable('fund_requests', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  network: text('network').notNull(), // 'TRC20' | 'BEP20' | 'ERC20'
  amount: decimal('amount', { precision: 18, scale: 2 }).notNull(),
  txHash: text('tx_hash'),
  status: text('status').notNull().default('pending'), // 'pending' | 'confirmed' | 'rejected'
  note: text('note'),
  reviewedBy: text('reviewedBy').references(() => user.id),
  reviewedAt: timestamp('reviewedAt'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

// --- Auto Trade Platform ---

export const autoTradePlans = pgTable('auto_trade_plans', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  createdBy: text('createdBy').notNull().references(() => user.id),
  principal: decimal('principal', { precision: 18, scale: 2 }).notNull(),
  grossReturnPct: decimal('gross_return_pct', { precision: 6, scale: 4 }).notNull().default('10.00'),
  feePct: decimal('fee_pct', { precision: 6, scale: 4 }).notNull().default('2.00'),
  netReturnPct: decimal('net_return_pct', { precision: 6, scale: 4 }).notNull().default('8.00'),
  status: text('status').notNull().default('active'), // 'active' | 'paused' | 'completed'
  startDate: text('start_date').notNull(), // ISO date string YYYY-MM-DD
  endDate: text('end_date'),
  note: text('note'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

// --- Activation Fee & Referral Commissions ---

export const activationFees = pgTable('activation_fees', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull().default('100.00'),
  txHash: text('tx_hash'),
  status: text('status').notNull().default('pending'), // 'pending' | 'confirmed' | 'rejected'
  reviewedBy: text('reviewed_by').references(() => user.id),
  reviewedAt: timestamp('reviewed_at'),
  note: text('note'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const referralCommissions = pgTable('referral_commissions', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }), // earner
  fromUserId: text('fromUserId').notNull().references(() => user.id, { onDelete: 'cascade' }), // who paid the activation fee
  level: integer('level').notNull(), // 1=$30, 2=$10, 3=$5
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  status: text('status').notNull().default('pending'), // 'pending' | 'paid'
  paidAt: timestamp('paid_at'),
  note: text('note'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// --- Wallet ---

export const walletTransactions = pgTable('wallet_transactions', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  // type: 'deposit' | 'withdrawal' | 'auto_trade_profit' | 'referral_commission' | 'activation_fee' | 'auto_trade_principal'
  type: text('type').notNull(),
  amount: decimal('amount', { precision: 18, scale: 2 }).notNull(), // positive = credit, negative = debit
  balanceAfter: decimal('balance_after', { precision: 18, scale: 2 }).notNull().default('0'),
  refId: text('ref_id'),       // foreign key value (e.g. fundRequest id, withdrawal id)
  refTable: text('ref_table'), // which table (e.g. 'fund_requests', 'withdrawals')
  description: text('description'),
  status: text('status').notNull().default('completed'), // 'completed' | 'pending' | 'reversed'
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const withdrawals = pgTable('withdrawals', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  amount: decimal('amount', { precision: 18, scale: 2 }).notNull(),
  network: text('network').notNull(), // 'TRC20' | 'BEP20' | 'ERC20'
  walletAddress: text('wallet_address').notNull(),
  status: text('status').notNull().default('pending'), // 'pending' | 'approved' | 'rejected'
  reviewedBy: text('reviewed_by').references(() => user.id),
  reviewedAt: timestamp('reviewed_at'),
  txHash: text('tx_hash'),
  note: text('note'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const autoTradeLogs = pgTable('auto_trade_logs', {
  id: serial('id').primaryKey(),
  planId: integer('plan_id').notNull().references(() => autoTradePlans.id, { onDelete: 'cascade' }),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  tradeDate: text('trade_date').notNull(), // ISO date string YYYY-MM-DD
  dailyGross: decimal('daily_gross', { precision: 18, scale: 8 }).notNull(),
  dailyFee: decimal('daily_fee', { precision: 18, scale: 8 }).notNull(),
  dailyNet: decimal('daily_net', { precision: 18, scale: 8 }).notNull(),
  runningTotal: decimal('running_total', { precision: 18, scale: 8 }).notNull(),
  status: text('status').notNull().default('completed'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})
