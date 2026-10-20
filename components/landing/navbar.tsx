'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { ArbitrageIQLogo } from '@/components/logo'

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'Markets', href: '#markets' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'AI', href: '#ai' },
  { label: 'Pricing', href: '#pricing' },
]

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#050816]/80 backdrop-blur-xl border-b border-white/[0.06]'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center group">
          <ArbitrageIQLogo size="sm" variant="full" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="px-4 py-2 text-sm text-[#98A2B3] hover:text-white transition-colors rounded-lg hover:bg-white/[0.04]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="#auth"
            className="text-sm text-[#98A2B3] hover:text-white transition-colors px-4 py-2"
          >
            Sign In
          </Link>
          <Link
            href="#auth"
            className="text-sm font-semibold px-5 py-2.5 rounded-lg bg-[#00D4FF] text-[#050816] hover:bg-[#00D4FF]/90 transition-all shadow-[0_0_20px_rgba(0,212,255,0.3)] hover:shadow-[0_0_30px_rgba(0,212,255,0.5)]"
          >
            Start Free
          </Link>
        </div>

        {/* Mobile menu toggle */}
        <button
          className="md:hidden text-[#98A2B3] hover:text-white p-2"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-[#0E1324]/95 backdrop-blur-xl border-b border-white/[0.06] px-6 pb-6"
          >
            <nav className="flex flex-col gap-1 pt-4">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="px-4 py-3 text-sm text-[#98A2B3] hover:text-white transition-colors rounded-lg hover:bg-white/[0.04]"
                >
                  {link.label}
                </a>
              ))}
              <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-white/[0.06]">
                <Link href="#auth" className="text-center py-3 text-sm text-[#98A2B3]">Sign In</Link>
                <Link
                  href="#auth"
                  className="text-center py-3 text-sm font-semibold rounded-lg bg-[#00D4FF] text-[#050816]"
                >
                  Start Free
                </Link>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
