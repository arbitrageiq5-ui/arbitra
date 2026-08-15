export interface StrategyExplainer {
  tagline: string
  howItWorks: string
  entryRules: string[]
  exitRules: string[]
  riskManagement: string[]
  bestConditions: string[]
  example: string
  pros: string[]
  cons: string[]
}

export const STRATEGY_EXPLAINERS: Record<string, StrategyExplainer> = {
  // ── Top-level bot types ──────────────────────────────────────────
  dca: {
    tagline: 'Buy the dips, average down, sell the bounce.',
    howItWorks:
      'A DCA (Dollar-Cost Averaging) bot places a base order when started, then automatically places additional "safety orders" at set price deviations below that entry as the price falls. Each safety order lowers the average entry price, so a smaller bounce is needed to reach the take-profit target and close the cycle in profit.',
    entryRules: [
      'Base order fires immediately on bot start at market price',
      'Safety order N fires when price falls Price Deviation % below the previous order',
      'Each safety order size is scaled up by the Safety Order Volume multiplier',
    ],
    exitRules: [
      'Position closes fully once price rises Take Profit % above the volume-weighted average entry',
      'Bot immediately restarts a new cycle after a successful close',
      'Manual stop closes the open position at current market price',
    ],
    riskManagement: [
      'Max Safety Orders caps total capital deployed per cycle',
      'Wider Price Deviation reduces trade frequency but requires deeper drawdowns to fill',
      'Never risks more than Base + (Safety Size × Max Safety Orders) per cycle',
    ],
    bestConditions: ['Choppy or accumulating markets with regular pullbacks', 'Assets you have long-term conviction in'],
    example:
      'You start a $100 base order on BTC/USDT. Price drops 3%, triggering a $100 safety order; drops another 3%, triggering a $120 order. Price then reverses and rises 2% above your new blended average — the bot sells the whole position for profit and restarts.',
    pros: ['Removes emotion from dip-buying', 'Works in any market condition given enough safety orders', 'Simple to reason about'],
    cons: ['Can tie up large capital in prolonged downtrends', 'Not designed for strong one-directional crashes'],
  },
  grid: {
    tagline: 'Buy low, sell high, on repeat, without predicting direction.',
    howItWorks:
      'A grid bot divides a price range into evenly spaced levels and places a matching buy order below and sell order above the current price at every level. When a buy fills, a sell is placed one grid step higher; when that sell fills, profit is locked and a new buy is placed. This repeats continuously as price oscillates inside the range.',
    entryRules: [
      'Grid lines are placed at fixed intervals across the configured range',
      'Buy orders sit at every grid line below current price',
      'A filled buy immediately arms a sell order one grid line above it',
    ],
    exitRules: [
      'Each grid "rung" closes independently when its paired sell fills',
      'Bot can be stopped manually — any open buys are cancelled, filled positions can be liquidated at market',
    ],
    riskManagement: [
      'Grid range should be set around realistic support/resistance to avoid orders sitting unfilled',
      'Tighter grids trade more often but each trade profits less',
      'If price breaks decisively out of the range, unmatched buy positions become directional risk',
    ],
    bestConditions: ['Sideways, range-bound markets with regular back-and-forth volatility', 'Liquid pairs with tight spreads'],
    example:
      'A grid from $58,000–$62,000 on BTC with 20 levels ($200 spacing). Price oscillates between $59,000 and $61,000 all week, filling and re-filling buy/sell pairs dozens of times, compounding small gains each round-trip.',
    pros: ['Profits from volatility itself, no trend prediction needed', 'Runs fully automated 24/7', 'Many small realized gains'],
    cons: ['Loses effectiveness (or loses money) in a strong sustained trend out of range', 'Requires picking a sensible range'],
  },
  arbitrage: {
    tagline: 'Exploit the same asset priced differently on two exchanges.',
    howItWorks:
      'The bot continuously monitors the price of an asset across multiple connected exchanges. When the price gap between two venues exceeds fees plus a minimum profit threshold, it simultaneously buys on the cheaper exchange and sells on the more expensive one, locking in the spread before it closes.',
    entryRules: [
      'Triggers only when Exchange B price − Exchange A price > (fees + minimum spread)',
      'Requires sufficient balance already positioned on both exchanges',
      'Executes both legs as close to simultaneously as API rate limits allow',
    ],
    exitRules: [
      'The trade is inherently self-closing: buy and sell legs execute together',
      'If only one leg fills, the bot cancels/hedges the open leg immediately to avoid directional exposure',
    ],
    riskManagement: [
      'Position sizes are capped to what can be executed near-instantly on both venues',
      'Withdrawal/transfer delays are avoided by pre-funding both exchanges',
      'Slippage guards cancel the trade if the spread closes mid-execution',
    ],
    bestConditions: ['High-volatility periods that create temporary cross-exchange price dislocations', 'Deep, liquid order books on both sides'],
    example:
      'BTC trades at $60,000 on Exchange A and $60,180 on Exchange B. After fees (~$40 round-trip) the bot nets $140 by buying on A and selling on B simultaneously — a near risk-free spread capture.',
    pros: ['Market-direction neutral', 'Very low per-trade risk when executed correctly', 'Can run continuously'],
    cons: ['Spreads are usually tiny and shrinking as more bots compete', 'Requires capital pre-positioned on multiple exchanges'],
  },
  signal: {
    tagline: 'Let AI-read indicators and sentiment trigger your trades.',
    howItWorks:
      'The bot continuously scores an asset using a blend of technical indicators (RSI, MACD, Bollinger Bands), volume patterns, and social/news sentiment. When the combined signal score crosses a bullish or bearish threshold, it automatically opens or closes a position in that direction.',
    entryRules: [
      'Opens long when signal score crosses above the bullish threshold with volume confirmation',
      'Opens short (where supported) on bearish crossovers',
      'Filters out low-conviction signals during major news blackout windows',
    ],
    exitRules: [
      'Closes when the signal score reverses past the neutral zone',
      'Hard take-profit and stop-loss levels always run as a safety net alongside the signal',
    ],
    riskManagement: [
      'Position size scales down as signal confidence drops',
      'Correlated signals across multiple assets are capped to avoid concentrated exposure',
      'Signal decay timers auto-close stale positions if no new signal confirms the trend',
    ],
    bestConditions: ['Trending markets with clear technical structure', 'Assets with active news/social coverage for sentiment data'],
    example:
      'RSI dips to 28 (oversold) while MACD curls bullish and social sentiment score flips positive after a product announcement — the combined score crosses the buy threshold and the bot enters long.',
    pros: ['Combines multiple data sources, not just price', 'Adapts to changing market narratives', 'Removes manual chart-watching'],
    cons: ['Signal quality depends entirely on model tuning', 'Can whipsaw in noisy, low-volume conditions'],
  },
  momentum: {
    tagline: 'Ride confirmed breakouts, trail your stop, let winners run.',
    howItWorks:
      'The bot waits for price to break a recent high (or resistance level) accompanied by a volume surge, confirming real buying interest rather than a false move. It enters in the direction of the breakout and manages the position with a trailing stop that follows price up, locking in gains as the trend extends.',
    entryRules: [
      'Price closes above a defined resistance/breakout level',
      'Volume on the breakout candle exceeds the recent average (confirmation filter)',
      'No entry if the breakout occurs on abnormally thin volume (likely a fakeout)',
    ],
    exitRules: [
      'Trailing stop moves up as price makes new highs, exiting when price reverses by the trail distance',
      'Hard stop-loss below the breakout level protects against failed breakouts',
    ],
    riskManagement: [
      'Initial stop is placed just below the breakout structure to invalidate the trade cheaply if wrong',
      'Position size reduces on lower-confidence (lower volume) breakouts',
    ],
    bestConditions: ['Strong trending markets with clean breakout structure', 'High-volume, liquid assets to avoid slippage on entries'],
    example:
      'ETH consolidates for two weeks under $3,200 resistance, then breaks through on 3x average volume. The bot enters at $3,210 and trails the stop as price runs to $3,600, exiting for a 12% gain when the trail is hit.',
    pros: ['Captures large directional moves', 'Trailing stop protects profit automatically', 'Objective, rule-based entries'],
    cons: ['Whipsaws and false breakouts cause small repeated losses', 'Needs strong trends to be profitable'],
  },
  'mean-reversion': {
    tagline: 'Buy fear, sell greed — trade the snap-back to average.',
    howItWorks:
      'The bot tracks how far price has deviated from its statistical average (using Bollinger Bands or a Z-score against a moving average). When price stretches significantly below the lower band, it buys, expecting a reversion toward the mean; it exits once price returns to or crosses the average.',
    entryRules: [
      'Price closes below the lower Bollinger Band (or Z-score below −2)',
      'Momentum indicators (e.g. RSI) confirm oversold conditions, not a trend breakdown',
    ],
    exitRules: [
      'Position closes when price reverts to the middle band (moving average)',
      'Stop-loss triggers if price keeps falling well past the band, signalling a genuine trend change rather than noise',
    ],
    riskManagement: [
      'Avoids entries during confirmed strong downtrends where "oversold" can stay oversold',
      'Position sizing shrinks the further price has already deviated, to manage tail risk',
    ],
    bestConditions: ['Range-bound or mildly trending markets without major news shocks', 'Historically stable, mean-reverting assets'],
    example:
      'AUD/USD trades 2.3 standard deviations below its 20-period average after a short-lived risk-off spike. RSI reads 24. The bot buys, and price mean-reverts back to the average within a day for a quick, high-probability gain.',
    pros: ['High win rate in normal market regimes', 'Clear statistical entry/exit rules', 'Fast average trade duration'],
    cons: ['Dangerous during genuine trend breaks ("catching a falling knife")', 'Requires a regime filter to avoid trending markets'],
  },
  scalping: {
    tagline: 'Hundreds of tiny, fast trades that add up over a day.',
    howItWorks:
      'The bot targets very small, rapid price movements (spreads, micro-momentum, order-book imbalances) on high-volume pairs, entering and exiting within seconds to minutes. Each trade aims for a fraction of a percent, but high trade frequency compounds into meaningful daily returns.',
    entryRules: [
      'Enters on micro order-book imbalance or short-term momentum ticks',
      'Only trades pairs with tight bid/ask spreads and deep liquidity',
    ],
    exitRules: [
      'Take-profit set just above transaction costs (fees + spread) to secure a net gain',
      'Aggressive time-based exit if the micro-move doesn’t materialize within seconds',
    ],
    riskManagement: [
      'Position sizes kept small per trade since frequency, not size, drives returns',
      'Daily loss limit halts the bot if cumulative losses exceed a threshold',
    ],
    bestConditions: ['High-volume, low-spread pairs during active trading sessions', 'Stable connectivity/low-latency execution'],
    example:
      'On BTC/USDT with a 0.01% spread, the bot captures dozens of 0.05–0.1% moves per hour. Individually tiny, but 200+ trades/day compound into a meaningful daily return.',
    pros: ['Low exposure time per trade reduces overnight/event risk', 'Can be profitable in flat, low-volatility markets'],
    cons: ['Extremely fee-sensitive — needs low-cost execution to stay profitable', 'Requires very reliable, fast infrastructure'],
  },
  martingale: {
    tagline: 'Double down after every loss to force an eventual win — high risk.',
    howItWorks:
      'After a losing trade, the bot doubles (or multiplies) the next position size on the theory that an eventual win recovers all prior losses plus a profit. It keeps escalating size on each consecutive loss until a winning trade closes the whole losing streak in the green.',
    entryRules: [
      'Base position enters on the standard signal/setup',
      'On a loss, the next entry size multiplies by the configured factor (commonly 2x)',
    ],
    exitRules: [
      'A single win at any point in the sequence closes out the entire streak profitably',
      'Hard max-loss-streak limit forces a full stop before the account is wiped out',
    ],
    riskManagement: [
      'Absolute max position size and max consecutive doublings must be capped — this is non-negotiable',
      'Only ever risk capital you can fully afford to lose in a worst-case streak',
    ],
    bestConditions: ['Only appropriate for experienced traders with strict, enforced max-loss limits', 'Mean-reverting, non-trending assets'],
    example:
      'A $50 loss is followed by a $100 bet, then $200, then $400. If the fifth bet wins, all prior losses are recovered plus a profit — but six or seven straight losses can wipe out the account entirely.',
    pros: ['Can recover a losing streak in a single winning trade', 'Simple mathematical logic'],
    cons: ['Position size grows exponentially — a long losing streak causes catastrophic loss', 'Not a real edge, just bet-sizing math'],
  },
  'gold-silver': {
    tagline: '7 battle-tested strategies for tokenized precious metals.',
    howItWorks:
      'This bot family trades tokenized Gold (XAU, XAUT, PAXG) and Silver (XAG) on CoinSwitch and Delta Exchange, applying seven distinct strategy templates — from safe-haven DCA to session-based momentum and cross-metal ratio arbitrage — each tuned to how precious metals actually move (slow accumulation, macro-driven breakouts, session liquidity windows).',
    entryRules: [
      'Each of the 7 sub-strategies has its own entry logic (DCA, momentum breakout, mean reversion, grid, ratio arb, or session timing)',
      'All entries respect precious-metals-specific volatility and session-liquidity patterns',
    ],
    exitRules: ['Exit rules follow the selected sub-strategy’s take-profit / trailing-stop / mean-reversion target'],
    riskManagement: [
      'Capital exposure capped by base + safety order sizing per sub-strategy',
      'Session-based strategies avoid trading during illiquid off-hours',
    ],
    bestConditions: ['Macro uncertainty and inflation-hedging demand favor Gold strategies', 'Range-bound sessions favor grid/ratio strategies'],
    example:
      'Choose "Gold Safe-Haven DCA" to steadily accumulate XAU on dips as a long-term hedge, or "Gold/Silver Ratio Arb" to rotate between metals as their relative valuation swings.',
    pros: ['Diversifies a crypto portfolio into a traditional safe-haven asset', 'Seven templates cover conservative to active trading styles'],
    cons: ['Lower liquidity than major crypto pairs on some venues', 'Tokenized metals carry custodial/peg risk from the issuer'],
  },
  'meta-trader': {
    tagline: '7 proven strategies for forex majors, metals & indices via MT4/MT5.',
    howItWorks:
      'This bot bridges to your MetaTrader 4 or 5 terminal via an EA-compatible signal bridge (MetaTrader has no public REST API), letting you run seven forex-native strategies — trend-following, news scalping, breakout, carry-and-swing, grid, session-timing, and mean reversion — across majors, Gold/Silver, and indices.',
    entryRules: [
      'Each of the 7 sub-strategies has its own entry logic tuned to forex market structure (sessions, interest-rate carry, news volatility)',
      'Signals are relayed to your terminal, where the attached EA executes the actual order',
    ],
    exitRules: ['Exit rules follow the selected sub-strategy’s take-profit, trailing stop, or session-close logic'],
    riskManagement: [
      'Prop-firm safe risk limits available for traders operating under funded-account rules',
      'News-spike protection avoids entries during the highest-impact release windows unless the strategy specifically targets them',
    ],
    bestConditions: ['Active London/New York trading sessions', 'Clear macro/interest-rate divergence for carry strategies'],
    example:
      'Deploy "London Open Breakout" on GBP/USD to trade only the 7–9 UTC volatility window, or "XAU/USD Breakout Hunter" to ride Gold momentum through your MT5 terminal.',
    pros: ['Access to regulated forex brokers and deep FX liquidity', 'Seven strategies covering trend, scalp, carry, grid and session styles'],
    cons: ['Requires your MetaTrader terminal to stay open with Algo Trading enabled', 'Execution depends on your broker’s spread and slippage'],
  },

  // ── Crypto DCA templates (STRATEGY_TEMPLATES) ───────────────────
  'btc-conservative': {
    tagline: 'Slow, steady Bitcoin accumulation for long-term holders.',
    howItWorks:
      'A tightly-configured DCA bot on BTC/USDT with modest safety order spacing (3%) and a conservative 2% take-profit, designed to accumulate Bitcoin through normal volatility without deploying large amounts of capital per cycle.',
    entryRules: ['Base $100 order on start', 'Up to 5 safety orders spaced 3% apart, sized $100 each with 1.2x scaling'],
    exitRules: ['Closes the cycle at +2% above blended average entry', 'Immediately restarts a new base order'],
    riskManagement: ['Max cycle exposure capped near $700', 'Tight 2% take-profit keeps trade duration short'],
    bestConditions: ['Range-bound or slowly rising BTC price action', 'Long holding horizon, low urgency for large gains'],
    example: 'BTC dips 6% from entry, filling 2 safety orders, then recovers 2% above the new average — the bot locks in profit and restarts.',
    pros: ['Low risk profile suited to beginners', 'High historical win rate (82%)'],
    cons: ['Modest returns compared to more aggressive templates'],
  },
  'eth-aggressive': {
    tagline: 'High-frequency ETH DCA built for volatile dip-buying.',
    howItWorks:
      'Runs a DCA cycle on ETH/USDT with tighter 2% safety-order spacing and up to 8 safety orders, designed to catch frequent volatile pullbacks common to ETH and DeFi-correlated price action, targeting a larger 3.5% take-profit per cycle.',
    entryRules: ['Base $80 order on start', 'Up to 8 safety orders spaced 2% apart, 1.5x volume scaling'],
    exitRules: ['Closes at +3.5% above blended average entry'],
    riskManagement: ['Higher safety-order count increases total capital at risk during deep drawdowns', 'Interval checks every 1h for responsive re-entry'],
    bestConditions: ['Volatile, choppy ETH price action with frequent 2%+ swings'],
    example: 'ETH drops through 5 safety orders during a sharp correction, then rallies 4% off the new average for a profitable close.',
    pros: ['Captures frequent volatility for higher monthly returns (15–35%)'],
    cons: ['More safety orders means more capital tied up in deep drawdowns', 'Medium risk, not for conservative accounts'],
  },
  'sol-momentum': {
    tagline: 'Aggressive DCA tuned to Solana’s momentum swings.',
    howItWorks:
      'Combines DCA-style safety orders with a wider 2.5% deviation and an aggressive 5% take-profit target, designed to capture the sharper, faster swings characteristic of SOL rather than BTC’s comparatively gentle moves.',
    entryRules: ['Base $60 order, up to 6 safety orders spaced 2.5% apart, 1.3x scaling'],
    exitRules: ['Closes at +5% above blended average — wider target matches SOL’s larger swings'],
    riskManagement: ['Wider deviation reduces order frequency but requires bigger moves to fill'],
    bestConditions: ['Strong altcoin momentum phases, especially during broader crypto rallies'],
    example: 'SOL corrects 7.5%, filling 3 safety orders, then surges 6% on renewed momentum — closing well above the 5% target.',
    pros: ['Tuned specifically to SOL’s volatility profile', 'Attractive 20–45% monthly range'],
    cons: ['Altcoin volatility cuts both ways — deeper drawdowns are possible', 'Intermediate risk level, not beginner-friendly'],
  },
  'btc-futures-low': {
    tagline: 'Low-leverage BTC futures DCA for amplified but controlled returns.',
    howItWorks:
      'Applies the standard DCA safety-order mechanic to BTC futures with 2x leverage, amplifying both the base order and take-profit impact while keeping leverage low enough to avoid liquidation risk under normal volatility.',
    entryRules: ['Base $50 order at 2x leverage', 'Up to 4 safety orders spaced 2% apart'],
    exitRules: ['Closes at +2% above average entry — leverage doubles the effective return'],
    riskManagement: ['Low 2x leverage keeps liquidation distance wide', 'Capped at 4 safety orders to limit total leveraged exposure'],
    bestConditions: ['Moderate volatility BTC price action where leverage meaningfully boosts modest moves'],
    example: 'A 2% BTC move that would net 2% unleveraged returns roughly 4% on the account due to 2x leverage.',
    pros: ['Amplifies returns without excessive leverage risk', 'Still moderate risk profile'],
    cons: ['Futures liquidation risk exists even at low leverage during flash crashes', 'Funding rate costs on held positions'],
  },
  'altcoin-basket': {
    tagline: 'Diversified DCA exposure across ADA, LINK and DOT.',
    howItWorks:
      'Runs a DCA cycle centered on ADA/USDT with wide 3.5% safety-order spacing and up to 7 safety orders, giving diversified exposure to a basket of correlated mid-cap altcoins rather than concentrating risk in a single asset.',
    entryRules: ['Base $40 order, up to 7 safety orders spaced 3.5% apart, 1.4x scaling'],
    exitRules: ['Closes at +4% above blended average entry'],
    riskManagement: ['Diversification across correlated altcoins spreads single-asset risk', 'Higher safety-order count for altcoin volatility'],
    bestConditions: ['Altcoin season rallies where mid-caps outperform BTC/ETH'],
    example: 'ADA pulls back 12% across 4 safety orders during a sector-wide correction, then the basket recovers 5% for a profitable close.',
    pros: ['Diversified altcoin exposure reduces single-token risk', 'Attractive 25–60% monthly range'],
    cons: ['Med-High risk — altcoins can underperform for extended periods', 'Advanced strategy, requires monitoring'],
  },
  'doge-meme': {
    tagline: 'High-risk, high-reward DCA built for meme coin volatility.',
    howItWorks:
      'A very wide, aggressively-scaled DCA cycle on DOGE/USDT with up to 10 safety orders spaced 5% apart and 2x volume scaling, designed to absorb the extreme, sentiment-driven volatility swings typical of meme coins and capture outsized 8% take-profit targets.',
    entryRules: ['Base $30 order, up to 10 safety orders spaced 5% apart, 2x scaling per order'],
    exitRules: ['Closes at +8% above blended average — sized for meme-coin-scale swings'],
    riskManagement: ['10 safety orders with 2x scaling means late orders are large — strict max-order cap is essential', 'Best used with capital you can afford to lose entirely'],
    bestConditions: ['Meme coin hype cycles and viral social-media driven rallies'],
    example: 'DOGE crashes 35% through most safety orders during a sentiment shift, then spikes 10% on a viral moment — closing the cycle in profit.',
    pros: ['Can capture explosive meme-coin rallies', 'High theoretical return range (30–150%)'],
    cons: ['High risk of prolonged, deep drawdowns with no bounce', 'Sentiment-driven assets are highly unpredictable'],
  },

  // ── Gold & Silver strategies ─────────────────────────────────────
  'xau-safe-haven': {
    tagline: 'Steady Gold accumulation as an inflation/uncertainty hedge.',
    howItWorks:
      'A DCA strategy with a trend filter on tokenized Gold (XAU/USDT via CoinSwitch), accumulating on dips with wide safety-order spacing suited to Gold’s slower, steadier price action, targeting a conservative 2.5% take-profit per cycle.',
    entryRules: ['Base $200 order, up to 5 safety orders spaced 1.5% apart', 'Trend filter avoids adding into a confirmed downtrend'],
    exitRules: ['Closes at +2.5% above blended average entry'],
    riskManagement: ['Low safety-order deviation matches Gold’s lower volatility', 'Trend filter reduces buying into sustained declines'],
    bestConditions: ['Macro uncertainty, inflation concerns, or risk-off market sentiment driving Gold demand'],
    example: 'Gold dips 3% on a strong jobs report, filling 2 safety orders, then recovers as risk-off sentiment returns — closing +2.5% above average.',
    pros: ['88% historical win rate — the most reliable Gold template', 'Low risk, beginner friendly'],
    cons: ['Modest 3–8% monthly return ceiling by design'],
  },
  'xau-momentum': {
    tagline: 'Catch Gold breakouts above resistance with a trailing stop.',
    howItWorks:
      'Enters on confirmed Gold breakouts above key resistance with volume confirmation via Delta Exchange, then rides the move with a trailing stop rather than a fixed take-profit, letting macro-driven Gold surges run further than a standard DCA cycle would.',
    entryRules: ['Breakout above resistance with volume confirmation', 'Base $150 order, up to 3 safety orders for entry refinement'],
    exitRules: ['Trailing stop locks in gains as price extends', 'Take-profit ceiling at +4.0% if no further momentum'],
    riskManagement: ['Volume filter avoids entering low-conviction fakeout breakouts', 'Fewer safety orders (3) than DCA templates — this is a breakout, not an averaging strategy'],
    bestConditions: ['Macro shocks, rate-cut expectations, or geopolitical events driving decisive Gold rallies'],
    example: 'Gold breaks above $2,050 resistance on a surprise rate-cut signal with strong volume — the bot enters and trails the stop as price runs to $2,120.',
    pros: ['Captures larger macro-driven moves than DCA templates', 'Trailing stop protects gains automatically'],
    cons: ['Medium risk — breakouts can fail (72% win rate, lower than DCA templates)'],
  },
  'xau-mean-reversion': {
    tagline: 'Buy Gold when it’s statistically oversold vs. its 20-day average.',
    howItWorks:
      'Uses Bollinger Bands around a 20-day average to identify when Gold has deviated significantly below its normal range, entering on the expectation of a snap-back reversion, which historically happens often given Gold’s range-bound tendencies outside major macro shocks.',
    entryRules: ['Price closes below the lower Bollinger Band on the 4h chart', 'Base $100 order, up to 4 safety orders spaced 1.2% apart'],
    exitRules: ['Closes at +1.8% as price reverts toward the mean'],
    riskManagement: ['Tight 1.8% take-profit keeps trades short and reduces exposure to genuine trend breaks', '4h interval avoids over-trading on noise'],
    bestConditions: ['Range-bound Gold price action without a major sustained macro catalyst'],
    example: 'Gold dips to the lower Bollinger Band after a strong dollar rally, then mean-reverts back to the 20-day average within 2 days for a quick, high-probability gain.',
    pros: ['84% win rate with consistent small gains', 'Low risk, frequent trade opportunities'],
    cons: ['Underperforms if Gold enters a genuine sustained trend rather than reverting'],
  },
  'xag-dca': {
    tagline: 'Aggressive Silver accumulation exploiting its higher volatility.',
    howItWorks:
      'Silver is more volatile than Gold, so this DCA strategy uses wider spacing (2.5%) and more safety orders (up to 8) with aggressive 1.5x scaling to fully exploit the larger, more frequent price swings XAG offers relative to Gold.',
    entryRules: ['Base $80 order on Delta Exchange, up to 8 safety orders spaced 2.5% apart, 1.5x scaling'],
    exitRules: ['Closes at +4.0% above blended average entry'],
    riskManagement: ['Higher order count matches Silver’s deeper, more frequent pullbacks', 'Aggressive scaling requires monitoring total capital deployed'],
    bestConditions: ['Silver’s characteristically choppier, higher-beta price action relative to Gold'],
    example: 'Silver swings 15% intraday during a volatile session, filling 5 safety orders, then rallies 5% for a profitable close well above target.',
    pros: ['Higher volatility means more frequent profitable cycles (79% win rate)', 'Attractive 8–20% monthly range'],
    cons: ['Low–Medium risk — deeper drawdowns possible than Gold strategies'],
  },
  'xau-xag-arb': {
    tagline: 'Trade the Gold:Silver ratio reversion — a classic macro hedge.',
    howItWorks:
      'Monitors the Gold-to-Silver price ratio, which has historically oscillated in a predictable range. When the ratio is unusually high (Gold expensive relative to Silver), the strategy favors Silver; when unusually low, it favors Gold — profiting as the ratio reverts toward its historical norm.',
    entryRules: ['Ratio above 80 → rotate exposure toward Silver', 'Ratio below 60 → rotate exposure toward Gold', 'Base $120 order, up to 4 safety orders spaced 2.0% apart'],
    exitRules: ['Closes at +3.0% as the ratio reverts and the favored metal outperforms'],
    riskManagement: ['Cross-asset structure diversifies pure directional Gold or Silver risk', 'Ratio thresholds prevent chasing extreme, already-reverting moves'],
    bestConditions: ['Periods where Gold and Silver diverge meaningfully from their historical ratio band'],
    example: 'The Gold:Silver ratio spikes to 85 during a Gold-specific rally. The bot rotates into Silver, which subsequently outperforms as the ratio reverts to 75.',
    pros: ['Classic, historically-grounded macro hedge (81% win rate)', 'Reduces single-metal directional risk'],
    cons: ['Ratio reversion can take longer than expected during structural regime shifts'],
  },
  'paxg-grid': {
    tagline: 'A tight grid bot capturing every micro-oscillation in range-bound Gold.',
    howItWorks:
      'Runs a classic grid strategy on PAXG (a Gold-backed token) across Binance/Delta, placing tightly-spaced buy/sell pairs (0.8% apart) to capture Gold’s smaller intraday oscillations during quiet, range-bound sessions where directional strategies would sit idle.',
    entryRules: ['Grid buy orders placed every 0.8% within the configured range', 'Base $100 order establishes the initial grid position'],
    exitRules: ['Each grid rung closes independently at +1.2% per level'],
    riskManagement: ['Tight grid spacing means high trade frequency but small per-trade profit', 'Best confined to genuinely range-bound periods to avoid directional risk'],
    bestConditions: ['Quiet, sideways Gold market sessions with regular small back-and-forth moves'],
    example: 'PAXG oscillates in a tight $10 range for a full week, filling and refilling grid rungs dozens of times for compounding small gains.',
    pros: ['Highest win rate of all Gold templates (91%)', 'Profits without needing directional conviction'],
    cons: ['Underperforms if Gold breaks decisively out of the grid range'],
  },
  'xau-session': {
    tagline: 'Trade Gold only during peak London/NY liquidity windows.',
    howItWorks:
      'Restricts trading to the London (8–12 UTC) and New York (13–17 UTC) sessions when Gold liquidity and volume are highest, avoiding the low-volume, noisy off-hours where spreads widen and false signals are more common.',
    entryRules: ['Entries only permitted within the defined London/NY session windows', 'Base $150 order, up to 3 safety orders spaced 1.5% apart'],
    exitRules: ['Closes at +2.0% above blended average entry', 'Any open position outside session hours is managed conservatively until the next window'],
    riskManagement: ['Session restriction avoids trading in illiquid, wide-spread off-hours', 'Reduces exposure to low-conviction overnight noise'],
    bestConditions: ['Standard weekday Gold trading during active global market hours'],
    example: 'The bot stays flat during the quiet Asian session, then enters as London opens and a clean, liquidity-backed move develops through the NY overlap.',
    pros: ['86% win rate by avoiding low-quality off-hours setups', 'Lower risk from tighter spreads during active sessions'],
    cons: ['Misses any moves that occur entirely outside the defined session windows'],
  },

  // ── MetaTrader 4/5 forex strategies ──────────────────────────────
  'eurusd-trend-rider': {
    tagline: 'EMA crossover trend-following on the most liquid FX pair.',
    howItWorks:
      'Uses a 20/50 EMA crossover on EUR/USD to identify the dominant trend direction, entering when the faster EMA crosses the slower one and holding the position while the trend extends, exiting once momentum fades or the take-profit target is hit.',
    entryRules: ['20 EMA crosses above 50 EMA → enter long', '20 EMA crosses below 50 EMA → enter short', 'Base 200 unit position, up to 4 safety orders spaced 0.6% apart'],
    exitRules: ['Closes at +1.2% take-profit above blended entry', 'Exits early if the EMA crossover reverses against the position'],
    riskManagement: ['Trading the most liquid FX pair minimizes slippage', 'Low 0.6% deviation keeps risk tightly controlled'],
    bestConditions: ['Clear directional trends on EUR/USD, common during major central bank policy divergence periods'],
    example: 'The 20 EMA crosses above the 50 EMA as the ECB signals a hawkish shift. The bot enters long and rides the trend to the 1.2% target over several hours.',
    pros: ['Most consistent win rate across all MT4/MT5 majors templates (85%)', 'Low risk, beginner friendly on the most liquid pair'],
    cons: ['Underperforms in choppy, range-bound EUR/USD conditions with frequent EMA whipsaws'],
  },
  'gbpusd-news-scalper': {
    tagline: 'Captures the volatility spike right after high-impact news.',
    howItWorks:
      'Positions to capture the sharp volatility burst that follows high-impact economic releases (FOMC, NFP, BoE decisions) on GBP/USD, entering in the direction of the initial spike and exiting quickly with a tight take-profit before the move mean-reverts.',
    entryRules: ['Enters immediately following confirmed directional momentum on a scheduled high-impact release', 'Base 100 unit position, up to 2 safety orders spaced 0.3% apart'],
    exitRules: ['Tight +0.5% take-profit to bank the spike before reversal', 'Fast time-based exit if momentum doesn’t confirm within minutes'],
    riskManagement: ['Small 2-order safety cap limits exposure during unpredictable news volatility', 'Only trades scheduled, known release windows — no ambient news guessing'],
    bestConditions: ['FOMC, NFP and BoE rate decision days', 'Requires low-latency execution to capture the initial spike'],
    example: 'NFP beats expectations sharply; GBP/USD spikes 40 pips in seconds. The bot rides the initial leg and exits at +0.5% before the post-news reversion.',
    pros: ['Targets specific, scheduled high-volatility windows', 'Fast trade duration limits market exposure'],
    cons: ['Medium risk — news reactions can reverse violently and unpredictably', 'Requires precise timing around release schedules'],
  },
  'xauusd-breakout-hunter': {
    tagline: 'Rides Gold breakouts through your MT5 terminal with a trailing stop.',
    howItWorks:
      'Waits for XAU/USD to break key resistance or support with volume/momentum confirmation, then enters in the breakout direction and manages the trade with a trailing stop, letting strong Gold momentum moves run further than a fixed target would allow.',
    entryRules: ['Confirmed break of a key level with momentum confirmation', 'Base 150 unit position, up to 3 safety orders spaced 1.0% apart'],
    exitRules: ['Trailing stop locks in gains as the move extends', 'Take-profit ceiling at +3.5% if momentum stalls'],
    riskManagement: ['Momentum confirmation filter reduces false-breakout entries', '4h interval avoids over-trading intraday noise'],
    bestConditions: ['Macro-driven Gold momentum phases — rate decisions, risk-off shocks, dollar weakness'],
    example: 'Gold breaks above a multi-week resistance level on a weak dollar print. The bot enters and trails the stop as the move extends to +5%, banking well above the 3.5% floor.',
    pros: ['Top-performing MT4/MT5 template on Gold pairs (76% win rate, +10–22% monthly)', 'Trailing stop captures extended moves'],
    cons: ['Medium risk — Gold breakouts can fail and reverse sharply on macro surprises'],
  },
  'usdjpy-carry-swing': {
    tagline: 'Blends positive interest-rate carry with multi-day swing entries.',
    howItWorks:
      'Combines the positive interest-rate carry available on USD/JPY (holding USD against JPY typically earns rollover interest) with swing entries on pullbacks, letting positions run for multiple days to both capture price appreciation and accumulate rollover credit.',
    entryRules: ['Enters on pullbacks within the prevailing carry-favorable trend', 'Base 180 unit position, up to 4 safety orders spaced 0.8% apart'],
    exitRules: ['Closes at +1.8% or on a multi-day swing target', 'Positions held longer than typical templates to accrue rollover interest'],
    riskManagement: ['4h interval suits the multi-day holding horizon', 'Carry trades unwind quickly if rate differentials shift — monitored via interval checks'],
    bestConditions: ['Positive and stable interest-rate differential between USD and JPY', 'Orderly, non-volatile trending conditions'],
    example: 'USD/JPY pulls back 0.8% within an uptrend supported by a wide rate differential. The bot enters, holds for two days earning rollover credit, and exits at the 1.8% target.',
    pros: ['Earns rollover interest while the trade is open, on top of price gains', '80% win rate, low-medium risk'],
    cons: ['Carry trades can unwind fast and violently if rate expectations shift suddenly'],
  },
  'fx-basket-grid': {
    tagline: 'A tight grid across EUR/USD, GBP/USD and AUD/USD in quiet sessions.',
    howItWorks:
      'Runs a grid strategy across a basket of major FX pairs during range-bound sessions, placing tightly-spaced buy/sell pairs (0.4%) to harvest small, frequent oscillations rather than betting on any single directional move.',
    entryRules: ['Grid buy orders placed every 0.4% within the configured range across the basket', 'Base 120 unit position per pair'],
    exitRules: ['Each grid rung closes independently at +0.7% per level'],
    riskManagement: ['Basket diversification spreads risk across three major pairs rather than one', 'Best confined to genuinely quiet, range-bound sessions'],
    bestConditions: ['Low-volatility, sideways FX sessions common in Asian trading hours or holiday periods'],
    example: 'During a quiet holiday-week session, EUR/USD, GBP/USD and AUD/USD all oscillate within tight ranges, filling grid rungs repeatedly for small compounding gains.',
    pros: ['Highest win rate among MT4/MT5 templates (89%) in quiet markets', 'Diversified across three major pairs'],
    cons: ['Underperforms sharply if any of the three pairs breaks trend during a volatility spike'],
  },
  'london-open-breakout': {
    tagline: 'Trades the volatility breakout at the London session open.',
    howItWorks:
      'Tracks the initial trading range established in the first minutes of the London session (7–9 UTC) and enters only in the direction of the confirmed breakout from that range, capturing the reliable volatility expansion that typically accompanies the London open.',
    entryRules: ['Initial range established in the first minutes of the London session', 'Entry only on a confirmed directional break of that range', 'Base 150 unit position, up to 3 safety orders spaced 0.5% apart'],
    exitRules: ['Closes at +1.0% take-profit', 'No new entries once the session’s volatility window has passed'],
    riskManagement: ['Session restriction avoids trading during illiquid off-hours', 'Range confirmation filter reduces false breakout entries'],
    bestConditions: ['Standard weekday London session opens with typical liquidity-driven volatility expansion'],
    example: 'GBP/USD builds a tight 15-pip range in the first 20 minutes of London trading, then breaks decisively higher — the bot enters and banks the 1.0% target within the hour.',
    pros: ['87% win rate by trading only proven, liquidity-backed session volatility', 'Low risk, well-defined trade window'],
    cons: ['Misses moves that develop outside the London open window'],
  },
  'audusd-mean-reversion': {
    tagline: 'Buys AUD/USD when statistically oversold vs. its 20-period average.',
    howItWorks:
      'Uses Bollinger Bands around a 20-period average on AUD/USD to identify when price has deviated significantly from its normal range, entering on the expectation of a reversion — a pattern AUD/USD exhibits reliably during non-trending, range-bound periods.',
    entryRules: ['Price closes below the lower Bollinger Band on the 4h chart', 'Base 100 unit position, up to 5 safety orders spaced 0.5% apart'],
    exitRules: ['Closes at +0.8% as price reverts toward the mean'],
    riskManagement: ['Tight 0.8% take-profit keeps trades short, limiting exposure to genuine trend breaks', '4h interval avoids over-trading on noise'],
    bestConditions: ['Range-bound AUD/USD price action without a strong commodity or risk-sentiment trend driving it'],
    example: 'AUD/USD dips to the lower Bollinger Band after a short risk-off wobble, then reverts to the mean within a session for a quick, high-probability gain.',
    pros: ['High win rate (83%) with low drawdown on range days', 'Low risk, consistent small gains'],
    cons: ['Underperforms if AUD/USD enters a genuine sustained trend rather than reverting'],
  },
  'xau-xag-smart-averaging': {
    tagline: 'The flagship averaging engine for Gold and Silver — lower your cost basis on every dip, exit the whole basket together.',
    howItWorks:
      'This is a wide-grid DCA (Dollar-Cost Averaging) strategy purpose-built for precious metals volatility. Instead of one fixed entry, it opens a base order on XAU/USD (or XAG/USD if you switch the pair) then automatically layers in safety orders as price drifts lower, each spaced 0.8% apart and sized up by a 1.4x multiplier. Every safety order pulls the volume-weighted average entry price down, so the whole basket only needs a modest bounce — not a full recovery — to close in profit. Gold and Silver both trend in long, grinding waves with sharp intraday pullbacks, which is exactly the price behavior this averaging logic is designed to harvest.',
    entryRules: [
      'Base order of $220 fires at market when the bot starts',
      'Safety order fires each time price falls 0.8% below the last filled order, up to 6 safety orders',
      'Each new safety order is sized 1.4x larger than the previous one, weighting the average entry toward the deepest, most attractive prices',
      'Runs on the 4h timeframe to filter out intraday noise and only react to meaningful pullbacks',
    ],
    exitRules: [
      'Entire basket closes together once price rises 2.0% above the volume-weighted average entry of all filled orders',
      'A fresh cycle starts immediately after a successful close — no manual restart needed',
      'Manual stop closes the open position at the current market price',
    ],
    riskManagement: [
      'Max Safety Orders (6) caps total capital exposure per cycle — you always know the worst-case deployed size upfront',
      'Wide 0.8% spacing between safety orders avoids over-committing capital on shallow, insignificant dips',
      'Best run with a Broker Account connected via the MT4/MT5 bridge and Algo Trading enabled so orders execute even if you step away',
      'Consider running Gold and Silver as two separate bot instances (one per pair) rather than doubling size on a single pair, to diversify metal-specific risk',
    ],
    bestConditions: [
      'Long-term bullish or range-bound bias on precious metals — this strategy is not designed to fight a sustained one-directional crash',
      'Periods of elevated Gold/Silver volatility (rate-decision weeks, dollar weakness, safe-haven demand) that create the frequent pullbacks the averaging ladder needs',
      'Traders who want to accumulate a metals position gradually rather than timing a single entry',
    ],
    example:
      'You start the bot on XAU/USD with a $220 base order at $1,950. Gold pulls back to $1,934 (−0.8%), triggering a $308 safety order (1.4x sizing); it drifts further to $1,919, triggering a $431 order. Your blended average is now roughly $1,928. Gold then reverses and rises 2% above that average to about $1,967 — the bot closes the entire basket in profit and immediately restarts a fresh cycle, ready for the next dip.',
    pros: [
      'Highest win rate in the MT4/MT5 lineup (88%) — small bounces are enough to close a cycle in profit',
      'One config works identically on both XAU/USD and XAG/USD — just swap the pair',
      'Removes the emotional pressure of picking a single "perfect" entry on a volatile metal',
      'Fully automated once your MetaTrader account is bridged — no manual order placement needed',
    ],
    cons: [
      'Can tie up meaningfully more capital than a single-entry strategy during a deep, sustained drawdown',
      'Not designed for a sharp one-directional crash in Gold or Silver with no pullbacks to average into',
      'Wider take-profit (2.0%) means cycles can take longer to close than tighter scalping strategies',
    ],
  },
}
