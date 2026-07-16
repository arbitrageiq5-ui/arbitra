import { pgTable, text, timestamp, boolean, serial, decimal } from 'drizzle-orm/pg-core'

// --- Better Auth required tables -------------------------------------------
// Column names are camelCase to match Better Auth's defaults. Do not rename.

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
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
  apiKey: text('apiKey').notNull(),
  apiSecret: text('apiSecret').notNull(),
  passphrase: text('passphrase'),
  isActive: boolean('isActive').default(true),
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
