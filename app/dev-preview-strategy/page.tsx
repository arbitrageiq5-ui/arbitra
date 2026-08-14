'use client'

import { useState } from 'react'
import { StrategyExplainerModal } from '@/components/strategy-explainer-modal'

export default function DevPreviewStrategy() {
  const [id, setId] = useState<string | null>('gold-silver')
  return (
    <div className="min-h-screen bg-slate-950 p-10">
      <button className="text-white border p-2" onClick={() => setId('xau-xag-arb')}>open</button>
      {id && (
        <StrategyExplainerModal
          strategyId={id}
          name="Gold & Silver Bot"
          stats={{ risk: 'Medium', monthly: '+10-20%', winRate: '80%' }}
          onClose={() => setId(null)}
        />
      )}
    </div>
  )
}
