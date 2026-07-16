import { Navbar } from '@/components/landing/navbar'
import { Hero } from '@/components/landing/hero'
import { LiveMarket } from '@/components/landing/live-market'
import { Features } from '@/components/landing/features'
import { HowItWorks } from '@/components/landing/how-it-works'
import { AISection } from '@/components/landing/ai-section'
import { WhyChooseUs } from '@/components/landing/why-choose-us'
import { Testimonials } from '@/components/landing/testimonials'
import { FAQ } from '@/components/landing/faq'
import { Registration } from '@/components/landing/registration'
import { Footer } from '@/components/landing/footer'

export default function Home() {
  return (
    <main style={{ backgroundColor: '#050816', minHeight: '100vh' }}>
      <Navbar />
      <Hero />
      <LiveMarket />
      <Features />
      <HowItWorks />
      <AISection />
      <WhyChooseUs />
      <Testimonials />
      <FAQ />
      <Registration />
      <Footer />
    </main>
  )
}
