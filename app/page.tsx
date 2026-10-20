import dynamic from 'next/dynamic'
import { Navbar } from '@/components/landing/navbar'
import { Hero } from '@/components/landing/hero'

// Skeleton placeholder shown while below-fold sections load
function SectionSkeleton({ height = 'h-64' }: { height?: string }) {
  return (
    <div className={`w-full ${height} bg-white/[0.02] animate-pulse`} />
  )
}

// Lazy-load everything below the fold so the hero renders immediately
const LiveMarket   = dynamic(() => import('@/components/landing/live-market').then(m => ({ default: m.LiveMarket })),   { loading: () => <SectionSkeleton height="h-96" /> })
const Features     = dynamic(() => import('@/components/landing/features').then(m => ({ default: m.Features })),         { loading: () => <SectionSkeleton /> })
const HowItWorks   = dynamic(() => import('@/components/landing/how-it-works').then(m => ({ default: m.HowItWorks })),   { loading: () => <SectionSkeleton /> })
const AISection    = dynamic(() => import('@/components/landing/ai-section').then(m => ({ default: m.AISection })),       { loading: () => <SectionSkeleton /> })
const WhyChooseUs  = dynamic(() => import('@/components/landing/why-choose-us').then(m => ({ default: m.WhyChooseUs })), { loading: () => <SectionSkeleton /> })
const Pricing      = dynamic(() => import('@/components/landing/pricing').then(m => ({ default: m.Pricing })),           { loading: () => <SectionSkeleton /> })
const Testimonials = dynamic(() => import('@/components/landing/testimonials').then(m => ({ default: m.Testimonials })), { loading: () => <SectionSkeleton /> })
const FAQ          = dynamic(() => import('@/components/landing/faq').then(m => ({ default: m.FAQ })),                   { loading: () => <SectionSkeleton /> })
const Registration = dynamic(() => import('@/components/landing/registration').then(m => ({ default: m.Registration })), { loading: () => <SectionSkeleton /> })
const Footer       = dynamic(() => import('@/components/landing/footer').then(m => ({ default: m.Footer })),             { loading: () => <SectionSkeleton height="h-32" /> })

export default function Home() {
  return (
    <main style={{ backgroundColor: '#03070d', minHeight: '100vh' }}>
      <Navbar />
      <Hero />
      <LiveMarket />
      <Features />
      <HowItWorks />
      <AISection />
      <WhyChooseUs />
      <Pricing />
      <Testimonials />
      <FAQ />
      <Registration />
      <Footer />
    </main>
  )
}
