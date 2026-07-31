'use client'

export function TraderClient({ user, isActivated }: { user: { id: string; name?: string | null; email?: string }; isActivated: boolean }) {
  return (
    <div className="w-full h-full flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold">Trading Platform</h2>
        <p className="text-muted-foreground max-w-md">
          The trading dashboard is currently unavailable. This is a temporary placeholder while we fix a compatibility issue. Please try refreshing the page.
        </p>
      </div>
    </div>
  )
}
