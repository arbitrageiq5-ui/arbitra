// Single barrel re-export for all admin server actions.
// Importing from one stable path prevents Turbopack from creating multiple
// async-loader chunks (one per file) that go stale across rebuilds.
// NOTE: Do NOT add 'use server' here — re-exports are not allowed in 'use server' files.
// The individual source files already declare 'use server' themselves.

export {
  getAllUsers,
  changeUserRole,
  getUserById,
  deleteUser,
  createAdminUser,
  createProTraderUser,
  resetUserPassword,
  updateUserProfile,
} from '@/app/actions/users'

export {
  getDepositAddresses,
  getAllDepositAddresses,
  upsertDepositAddress,
  deleteDepositAddress,
  submitFundRequest,
  submitFundRequestQuick,
  getMyFundRequests,
  getAllFundRequests,
  reviewFundRequest,
} from '@/app/actions/deposits'

export {
  createAutoTradePlan,
  updateAutoTradePlanStatus,
  getAllAutoTradePlans,
  selfFundAutoTrade,
  getMyAutoTradePlan,
} from '@/app/actions/auto-trade'

export {
  creditIncomeCommission,
  ensureReferralCode,
  getMyReferralCode,
  getMyReferralData,
  getActivationStatus,
  submitActivationFee,
  getActivationFeeRequests,
  approveActivationFee,
  rejectActivationFee,
  validateReferralCode,
} from '@/app/actions/referral'

export {
  invalidateBalanceCache,
  computeWalletBalance,
  getWalletBalanceFast,
  getWalletSummary,
  checkWithdrawalAvailable,
  requestWithdrawal,
  requestWithdrawalQuick,
  cancelWithdrawal,
  getAllTraderBalances,
  getAllWithdrawals,
  reviewWithdrawal,
} from '@/app/actions/wallet'

export {
  getExchangeApiKeys,
  saveExchangeApiKey,
  deleteExchangeApiKey,
  toggleExchangeEnabled,
  testExchangeConnection,
  testAllExchanges,
  adminFetchLivePrices,
  generateAiArbitrageStrategy,
  getSavedAiStrategy,
  getTransferRoutes,
  getExchangeBalances,
  executeExchangeTransfer,
  getBotConfig,
  saveBotConfig,
  evaluateRiskFilters,
  getBotAnalytics,
  executeBotTrade,
  getTransferHistory,
  getSniperBotConfig,
  saveSniperBotConfig,
  grabLiveOpportunities,
  getDepositAddress,
  adminGetTradersWithExchanges,
  adminTestTraderExchange,
  adminFetchTraderBalance,
} from '@/app/actions/admin-arbitrage'
