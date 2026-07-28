import { pgTable, text, timestamp, boolean, serial, decimal, integer, jsonb } from 'drizzle-orm/pg-core'

// --- Better Auth required tables -------------------------------------------
// Column names are camelCase to match Better Auth's defaults. Do not rename.

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  role: text('role').default('viewer').notNull(), // 'viewer' | 'trader' | 'protrader' | 'admin'
  // Referral & activation system
  referralCode: text('referral_code').unique(),
  referredBy: text('referred_by'), // userId of referrer (no FK to avoid circular)
  isActivated: boolean('is_activated').notNull().default(false),
  activationPaidAt: timestamp('activation_paid_at'),
  // Registration details
  phone: text('phone'),
  country: text('country'),
  // 'beginner' | 'intermediate' | 'advanced'
  tradingExperienceLevel: text('trading_experience_level').default('beginner'),
  // Security tracking
  lastLoginIp: text('last_login_ip'),
  lastLoginAt: timestamp('last_login_at'),
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
  txHash: text('tx_hash').notNull(), // Transaction hash is now REQUIRED
  screenshotUrl: text('screenshot_url').notNull(), // Payment screenshot proof is now REQUIRED
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
  txHash: text('tx_hash').notNull(), // Transaction hash is now REQUIRED
  note: text('note'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

// --- Trading Bots ---

// --- Registration Audit ---

export const registrationAudits = pgTable('registration_audits', {
  id: serial('id').primaryKey(),
  userId: text('userId').references(() => user.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  captchaScore: decimal('captcha_score', { precision: 3, scale: 2 }),
  captchaPassed: boolean('captcha_passed').default(false),
  registrationStatus: text('registration_status').notNull().default('pending'), // 'pending' | 'success' | 'rejected'
  rejectionReason: text('rejection_reason'),
  country: text('country'),
  tradingExperienceLevel: text('trading_experience_level'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const tradingBots = pgTable('trading_bots', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  // 'dca' | 'grid' | 'martingale'
  strategy: text('strategy').notNull().default('dca'),
  // 'spot' | 'futures'
  marketType: text('market_type').notNull().default('spot'),
  exchange: text('exchange').notNull(),
  exchangeAccountId: integer('exchange_account_id').references(() => exchangeAccounts.id, { onDelete: 'set null' }),
  symbol: text('symbol').notNull(),
  baseCurrency: text('base_currency').notNull(),
  quoteCurrency: text('quote_currency').notNull(),
  // 'active' | 'paused' | 'stopped' | 'error'
  status: text('status').notNull().default('stopped'),
  totalInvested: decimal('total_invested', { precision: 18, scale: 2 }).notNull().default('0'),
  totalOrders: integer('total_orders').notNull().default(0),
  avgBuyPrice: decimal('avg_buy_price', { precision: 20, scale: 8 }).notNull().default('0'),
  currentPrice: decimal('current_price', { precision: 20, scale: 8 }).notNull().default('0'),
  unrealizedPnl: decimal('unrealized_pnl', { precision: 18, scale: 2 }).notNull().default('0'),
  realizedPnl: decimal('realized_pnl', { precision: 18, scale: 2 }).notNull().default('0'),
  // DCA config: { baseOrderSize, safetyOrderSize, maxSafetyOrders, priceDeviationPct, takeProfitPct, leverage?, interval }
  config: jsonb('config').notNull().default({}),
  startedAt: timestamp('started_at'),
  stoppedAt: timestamp('stopped_at'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const dcaOrders = pgTable('dca_orders', {
  id: serial('id').primaryKey(),
  botId: integer('bot_id').notNull().references(() => tradingBots.id, { onDelete: 'cascade' }),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  // 'buy' | 'sell' | 'take_profit'
  orderType: text('order_type').notNull().default('buy'),
  // 'spot' | 'futures'
  marketType: text('market_type').notNull().default('spot'),
  symbol: text('symbol').notNull(),
  qty: decimal('qty', { precision: 20, scale: 8 }).notNull(),
  price: decimal('price', { precision: 20, scale: 8 }).notNull(),
  total: decimal('total', { precision: 18, scale: 2 }).notNull(),
  triggerCondition: text('trigger_condition'),
  exchangeOrderId: text('exchange_order_id'),
  // 'pending' | 'filled' | 'cancelled' | 'failed'
  status: text('status').notNull().default('pending'),
  filledAt: timestamp('filled_at'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
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

// --- Arbitrage Exchange API Keys (admin-managed) ---

export const exchangeApiKeys = pgTable('exchange_api_keys', {
  id: serial('id').primaryKey(),
  exchange: text('exchange').notNull().unique(), // 'binance' | 'kraken' | 'okx' etc.
  label: text('label').notNull(),               // display name
  apiKey: text('api_key'),                       // optional — some public APIs don't need keys
  apiSecret: text('api_secret'),
  passphrase: text('passphrase'),                // KuCoin, Bitget etc.
  isEnabled: boolean('is_enabled').notNull().default(true),
  isPublicOnly: boolean('is_public_only').notNull().default(true), // true = read-only price feed
  lastTestedAt: timestamp('last_tested_at'),
  lastTestStatus: text('last_test_status'),      // 'ok' | 'error' | null
  lastTestMs: integer('last_test_ms'),           // latency in ms
  note: text('note'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

// --- AI Arbitrage Strategy Config ---

export const arbitrageConfig = pgTable('arbitrage_config', {
  id: serial('id').primaryKey(),
  configKey: text('config_key').notNull().unique(), // 'ai_strategy' | 'scan_settings' etc.
  configValue: jsonb('config_value').notNull().default({}),
  updatedBy: text('updated_by').references(() => user.id),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

// --- Referral Income Commissions (% of bot/auto-trade profits) ---
// Level 1: 0.50% of income, Level 2: 0.25%, Level 3: 0.20%

export const referralIncomeCommissions = pgTable('referral_income_commissions', {
  id:            serial('id').primaryKey(),
  userId:        text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  fromUserId:    text('fromUserId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  level:         integer('level').notNull(),
  sourceType:    text('source_type').notNull(),
  incomeAmount:  decimal('income_amount', { precision: 18, scale: 8 }).notNull(),
  commissionPct: decimal('commission_pct', { precision: 6, scale: 4 }).notNull(),
  amount:        decimal('amount', { precision: 18, scale: 8 }).notNull(),
  refId:         text('ref_id'),
  status:        text('status').notNull().default('paid'),
  createdAt:     timestamp('createdAt').notNull().defaultNow(),
})

// --- Trader Arbitrage Bot Trades ---
// Each row = one full arbitrage cycle: buy on exchange A → withdraw → deposit on B → sell

export const arbitrageBotTrades = pgTable('arbitrage_bot_trades', {
  id:              serial('id').primaryKey(),
  userId:          text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  symbol:          text('symbol').notNull(),           // e.g. USDT, BTC, ETH
  network:         text('network').notNull(),           // e.g. TRC20, BEP20, ERC20
  buyExchange:     text('buy_exchange').notNull(),
  sellExchange:    text('sell_exchange').notNull(),
  buyPrice:        decimal('buy_price', { precision: 18, scale: 8 }).notNull(),
  sellPrice:       decimal('sell_price', { precision: 18, scale: 8 }).notNull(),
  amount:          decimal('amount', { precision: 18, scale: 8 }).notNull(),       // qty of coin
  amountUsd:       decimal('amount_usd', { precision: 18, scale: 2 }).notNull(),   // capital in USD
  grossProfitUsd:  decimal('gross_profit_usd', { precision: 18, scale: 4 }),
  feeBuyUsd:       decimal('fee_buy_usd', { precision: 18, scale: 4 }),
  feeSellUsd:      decimal('fee_sell_usd', { precision: 18, scale: 4 }),
  feeNetworkUsd:   decimal('fee_network_usd', { precision: 18, scale: 4 }),
  netProfitUsd:    decimal('net_profit_usd', { precision: 18, scale: 4 }),
  netProfitPct:    decimal('net_profit_pct', { precision: 8, scale: 4 }),
  withdrawTxId:    text('withdraw_tx_id'),
  depositTxId:     text('deposit_tx_id'),
  sellOrderId:     text('sell_order_id'),
  buyOrderId:      text('buy_order_id'),
  destinationAddr: text('destination_addr'),           // address on sell exchange
  riskLevel:       text('risk_level').default('Medium'), // Low | Medium | High | Critical
  riskScore:       integer('risk_score').default(50),
  // Status pipeline
  status:          text('status').notNull().default('pending'),
  // pending → buying → withdrawing → depositing → selling → completed | failed
  statusDetail:    text('status_detail'),
  errorMessage:    text('error_message'),
  startedAt:       timestamp('started_at'),
  completedAt:     timestamp('completed_at'),
  createdAt:       timestamp('createdAt').notNull().defaultNow(),
  updatedAt:       timestamp('updatedAt').notNull().defaultNow(),
})

// --- Exchange Transfer Logs (admin cross-exchange transfers) ---

export const exchangeTransferLogs = pgTable('exchange_transfer_logs', {
  id: serial('id').primaryKey(),
  fromExchange: text('from_exchange').notNull(),
  toExchange:   text('to_exchange').notNull(),
  symbol:       text('symbol').notNull(),          // e.g. USDT, BTC, ETH
  network:      text('network').notNull(),          // e.g. TRC20, BEP20, SOL
  amount:       decimal('amount', { precision: 18, scale: 8 }).notNull(),
  fee:          decimal('fee',    { precision: 18, scale: 8 }),
  address:      text('address'),                   // destination wallet address
  txId:         text('tx_id'),                     // exchange-returned transaction ID
  status:       text('status').notNull().default('pending'), // pending | submitted | completed | failed
  errorMessage: text('error_message'),
  initiatedBy:  text('initiated_by').references(() => user.id),
  createdAt:    timestamp('createdAt').notNull().defaultNow(),
  updatedAt:    timestamp('updatedAt').notNull().defaultNow(),
})
