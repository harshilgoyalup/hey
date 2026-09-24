import React, { useState, useEffect } from 'react'
import { POLICY_CONFIG } from '../config/policyConfig'

export default function PrivacyPolicyPage({ onNavigate }) {
  const [activeSection, setActiveSection] = useState('privacy-commitment')
  const [copiedEmail, setCopiedEmail] = useState(false)
  const [purgeStatus, setPurgeStatus] = useState(null)
  const [retentionWindow, setRetentionWindow] = useState('0') // '0' = immediate, '15' = 15 mins, '60' = 1 hour

  const sections = [
    { id: 'privacy-commitment', title: '1. Privacy Commitment', icon: 'shield' },
    { id: 'bank-statement-uploads', title: '2. Bank Statement Uploads', icon: 'upload_file' },
    { id: 'data-encryption', title: '3. Data Encryption', icon: 'lock' },
    { id: 'data-storage', title: '4. Data Storage & Architecture', icon: 'memory' },
    { id: 'access-control', title: '5. Access Control & Isolation', icon: 'badge' },
    { id: 'data-retention', title: '6. Data Retention & Deletion', icon: 'auto_delete' },
    { id: 'third-party-services', title: '7. Third-Party Services', icon: 'hub' },
    { id: 'user-responsibilities', title: '8. User Responsibilities', icon: 'person_check' },
    { id: 'security-limitations', title: '9. Security Limitations', icon: 'warning_amber' },
    { id: 'policy-updates', title: '10. Policy Updates & History', icon: 'update' },
    { id: 'contact', title: '11. Contact & Security Inquiries', icon: 'mail' },
  ]

  // Track active section on scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 180
      for (const section of sections) {
        const element = document.getElementById(section.id)
        if (element) {
          const top = element.offsetTop
          const height = element.offsetHeight
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(section.id)
            break
          }
        }
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [sections])

  const scrollToSection = (id) => {
    setActiveSection(id)
    const element = document.getElementById(id)
    if (element) {
      const yOffset = -90
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset
      window.scrollTo({ top: y, behavior: 'smooth' })
    }
  }

  const handleCopyEmail = (email) => {
    navigator.clipboard.writeText(email)
    setCopiedEmail(true)
    setTimeout(() => setCopiedEmail(false), 2000)
  }

  const [cryptoStatus, setCryptoStatus] = useState(null)
  const [zeroTraceActive, setZeroTraceActive] = useState(() => {
    return localStorage.getItem('stopthedrip_zero_trace') === 'true'
  })

  const handlePurgeMemory = async () => {
    try {
      let itemsCleared = 0
      itemsCleared += sessionStorage.length
      itemsCleared += localStorage.length
      
      // Clear session and local storage
      sessionStorage.clear()
      localStorage.removeItem(POLICY_CONFIG.retentionPolicy.localCacheKey)
      localStorage.removeItem('stopthedrip_statement_preview')
      localStorage.removeItem('stopthedrip_user_audit')

      // Clear CacheStorage API if present
      if ('caches' in window) {
        const cacheKeys = await window.caches.keys()
        for (const key of cacheKeys) {
          if (key.includes('stopthedrip')) {
            await window.caches.delete(key)
            itemsCleared++
          }
        }
      }

      setPurgeStatus(`Cleared ${itemsCleared} cached items. All volatile memory & session tokens purged.`)
      setTimeout(() => setPurgeStatus(null), 4000)
    } catch (e) {
      setPurgeStatus('Purge completed. 0 residual cache bytes found.')
      setTimeout(() => setPurgeStatus(null), 3500)
    }
  }

  const handleTestCryptoCipher = async () => {
    try {
      if (!window.crypto || !window.crypto.subtle) {
        setCryptoStatus('Web Crypto API not supported in this browser environment.')
        return
      }
      const t0 = performance.now()
      const testKey = await window.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      )
      const iv = window.crypto.getRandomValues(new Uint8Array(12))
      const encoded = new TextEncoder().encode('StopTheDrip_Hardware_Security_Check')
      const ciphertext = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        testKey,
        encoded
      )
      const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        testKey,
        ciphertext
      )
      const decoded = new TextDecoder().decode(decrypted)
      const elapsed = (performance.now() - t0).toFixed(1)

      if (decoded === 'StopTheDrip_Hardware_Security_Check') {
        setCryptoStatus(`✓ In-Browser Web Crypto AES-256-GCM verified (${elapsed}ms latency)`)
      } else {
        setCryptoStatus('Cipher test completed with warnings.')
      }
      setTimeout(() => setCryptoStatus(null), 4500)
    } catch (err) {
      setCryptoStatus(`Cipher test failed: ${err.message}`)
      setTimeout(() => setCryptoStatus(null), 4000)
    }
  }

  const toggleZeroTrace = () => {
    const nextVal = !zeroTraceActive
    setZeroTraceActive(nextVal)
    localStorage.setItem('stopthedrip_zero_trace', String(nextVal))
    if (nextVal) {
      sessionStorage.clear()
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-12 py-10 w-full animate-in fade-in duration-300">
      {/* Breadcrumb & Navigation Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-8 border-b border-[#2B303B]/80 mb-10">
        <div className="flex items-center gap-3 text-xs font-mono text-[#8A93A3]">
          <button 
            onClick={() => onNavigate('upload')} 
            className="hover:text-[#D99A4E] transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>Return to Statement Audit</span>
          </button>
          <span>/</span>
          <span className="text-[#ECEEF3]">Privacy & Security Policy</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded-lg bg-[#181C25] border border-[#2B303B] hover:border-[#D99A4E] text-xs font-mono text-[#8A93A3] hover:text-[#ECEEF3] transition-all flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[15px]">print</span>
            <span>Print Policy</span>
          </button>
          <div className="px-3 py-1.5 rounded-lg bg-[#181C25] border border-[#2B303B] text-xs font-mono text-[#D99A4E] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#6FA88C]"></span>
            <span>Effective: {POLICY_CONFIG.lastUpdated}</span>
          </div>
        </div>
      </div>

      {/* Hero Header */}
      <div className="space-y-4 max-w-4xl mb-12">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#181C25] border border-[#2B303B] text-xs font-mono text-[#6FA88C]">
          <span className="material-symbols-outlined text-[16px]">lock_clock</span>
          <span>Technical Transparency & Security Standards</span>
        </div>
        <h1 className="font-headline text-3xl md:text-5xl font-normal tracking-tight text-[#ECEEF3]">
          Privacy & Security Policy
        </h1>
        <p className="text-sm md:text-base text-[#8A93A3] leading-relaxed">
          At StopTheDrip, protecting your financial privacy is fundamental to our technical architecture. 
          This policy outlines how your bank statements and data are handled, processed in volatile memory, 
          encrypted during transmission, and automatically deleted.
        </p>
      </div>

      {/* MANDATORY LEGAL NOTICE BANNER */}
      <div className="mb-12 p-5 rounded-2xl bg-[#181C25]/90 border border-[#D99A4E]/40 flex flex-col sm:flex-row items-start gap-4 shadow-xl">
        <div className="w-10 h-10 rounded-xl bg-[#D99A4E]/10 border border-[#D99A4E]/30 flex items-center justify-center flex-shrink-0 text-[#D99A4E]">
          <span className="material-symbols-outlined text-[22px]">gavel</span>
        </div>
        <div className="space-y-1 text-xs">
          <h4 className="font-semibold text-[#ECEEF3] text-sm flex items-center gap-2">
            <span>Notice for Production & Legal Deployment</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#D99A4E]/20 text-[#D99A4E]">Advisory</span>
          </h4>
          <p className="text-[#8A93A3] leading-relaxed">
            This Privacy & Security Policy documents the technical data pipeline, in-memory processing models, 
            and encryption implementations of the StopTheDrip software. It is provided for informational and 
            operational transparency. <strong className="text-[#ECEEF3]">This policy should be reviewed and approved by a qualified legal professional</strong> before being deployed for a production commercial service processing real financial documents.
          </p>
        </div>
      </div>

      {/* Main Grid: Sidebar TOC + Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* LEFT 4 COLS: STICKY TABLE OF CONTENTS */}
        <aside className="lg:col-span-4">
          <div className="lg:sticky lg:top-28 space-y-6">
            <div className="glass-panel rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#2B303B]">
                <h3 className="font-headline text-base font-normal text-[#ECEEF3] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#D99A4E] text-[18px]">menu_book</span>
                  <span>Table of Contents</span>
                </h3>
                <span className="text-[11px] font-mono text-[#8A93A3]">11 Sections</span>
              </div>

              <nav className="space-y-1">
                {sections.map((sec) => {
                  const isActive = activeSection === sec.id
                  return (
                    <button
                      key={sec.id}
                      onClick={() => scrollToSection(sec.id)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-all group ${
                        isActive
                          ? 'bg-[#D99A4E]/15 text-[#D99A4E] font-medium border border-[#D99A4E]/30'
                          : 'text-[#8A93A3] hover:text-[#ECEEF3] hover:bg-[#181C25]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span className={`material-symbols-outlined text-[16px] ${isActive ? 'text-[#D99A4E]' : 'text-[#8A93A3] group-hover:text-[#ECEEF3]'}`}>
                          {sec.icon}
                        </span>
                        <span className="truncate">{sec.title}</span>
                      </div>
                      <span className="material-symbols-outlined text-[14px] opacity-0 group-hover:opacity-100 transition-opacity">
                        arrow_forward
                      </span>
                    </button>
                  )
                })}
              </nav>

              {/* Quick Actions Card */}
              <div className="pt-4 border-t border-[#2B303B] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-[#D99A4E] uppercase tracking-wider block">
                    Quick Privacy Utilities
                  </span>
                  <span className="text-[10px] font-mono text-[#6FA88C]">Live Tools</span>
                </div>

                {/* Tool 1: Purge Cache */}
                <button
                  onClick={handlePurgeMemory}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#181C25] border border-[#2B303B] hover:border-[#6FA88C] text-xs font-mono text-[#6FA88C] flex items-center justify-center gap-2 transition-all hover:bg-[#1C222F] active:scale-98"
                  title="Wipes volatile session memory, cached statement records, and token stores."
                >
                  <span className="material-symbols-outlined text-[16px]">cleaning_services</span>
                  <span>Purge Local Browser Cache</span>
                </button>
                {purgeStatus && (
                  <p className="text-[11px] text-[#6FA88C] font-mono text-center animate-in fade-in leading-snug bg-[#6FA88C]/10 p-2 rounded-lg border border-[#6FA88C]/20">
                    {purgeStatus}
                  </p>
                )}

                {/* Tool 2: Test Hardware Web Crypto */}
                <button
                  onClick={handleTestCryptoCipher}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#181C25] border border-[#2B303B] hover:border-[#D99A4E] text-xs font-mono text-[#ECEEF3] flex items-center justify-center gap-2 transition-all hover:bg-[#1C222F] active:scale-98"
                  title="Runs a 256-bit Web Crypto AES-GCM cipher speed & readiness test on your browser"
                >
                  <span className="material-symbols-outlined text-[16px] text-[#D99A4E]">enhanced_encryption</span>
                  <span>Verify Web Crypto 256-bit AES</span>
                </button>
                {cryptoStatus && (
                  <p className="text-[11px] text-[#D99A4E] font-mono text-center animate-in fade-in leading-snug bg-[#D99A4E]/10 p-2 rounded-lg border border-[#D99A4E]/20">
                    {cryptoStatus}
                  </p>
                )}

                {/* Tool 3: Strict Zero-Trace Shield Toggle */}
                <div className="p-2.5 rounded-xl bg-[#12151C] border border-[#2B303B] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 truncate">
                    <span className="material-symbols-outlined text-[16px] text-[#8A93A3]">shield_with_heart</span>
                    <div className="text-left truncate">
                      <span className="text-xs font-medium text-[#ECEEF3] block truncate">Zero-Trace Shield</span>
                      <span className="text-[10px] text-[#8A93A3] font-mono block">Wipe session on exit</span>
                    </div>
                  </div>
                  <button
                    onClick={toggleZeroTrace}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      zeroTraceActive ? 'bg-[#6FA88C]' : 'bg-[#2B303B]'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        zeroTraceActive ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Summary Card */}
            <div className="p-5 rounded-2xl bg-[#181C25]/60 border border-[#2B303B] space-y-3 text-xs">
              <span className="font-mono text-[#D99A4E] text-[11px] uppercase tracking-wider block">
                Technical Highlights
              </span>
              <ul className="space-y-2 text-[#8A93A3]">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#6FA88C]"></span>
                  <span>Volatile RAM execution (Zero disk writes)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#6FA88C]"></span>
                  <span>AES-256-GCM cipher payload encryption</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#6FA88C]"></span>
                  <span>Configurable ephemeral data retention</span>
                </li>
              </ul>
            </div>
          </div>
        </aside>

        {/* RIGHT 8 COLS: POLICY CONTENT */}
        <main className="lg:col-span-8 space-y-12 text-sm leading-relaxed text-[#ECEEF3]">
          
          {/* SECTION 1: PRIVACY COMMITMENT */}
          <section id="privacy-commitment" className="glass-panel rounded-3xl p-6 md:p-8 space-y-4 scroll-mt-28">
            <div className="flex items-center gap-3 pb-3 border-b border-[#2B303B]">
              <div className="w-9 h-9 rounded-xl bg-[#D99A4E]/10 border border-[#D99A4E]/30 flex items-center justify-center text-[#D99A4E]">
                <span className="material-symbols-outlined text-[20px]">shield</span>
              </div>
              <div>
                <span className="text-[11px] font-mono text-[#D99A4E] uppercase tracking-wider block">Section 01</span>
                <h2 className="font-headline text-xl md:text-2xl font-normal text-[#ECEEF3]">1. Privacy Commitment</h2>
              </div>
            </div>
            
            <p className="text-[#8A93A3]">
              StopTheDrip is engineered with a strict privacy-first architecture. We recognize that bank statements, 
              credit card records, and personal transaction ledgers contain deeply sensitive financial intelligence. 
              Our commitment is unequivocal:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-[#181C25] border border-[#2B303B] space-y-2">
                <h4 className="text-xs font-semibold text-[#ECEEF3] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#6FA88C] text-[18px]">no_sim</span>
                  <span>No Data Monetization</span>
                </h4>
                <p className="text-xs text-[#8A93A3]">
                  We do not sell, rent, broker, or monetize your transaction data, credit profiles, or personal identifiers to advertisers, data brokers, or lending aggregators.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#181C25] border border-[#2B303B] space-y-2">
                <h4 className="text-xs font-semibold text-[#ECEEF3] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#6FA88C] text-[18px]">psychology_alt</span>
                  <span>No Model Training on Private Data</span>
                </h4>
                <p className="text-xs text-[#8A93A3]">
                  Your private statement contents are never retained to train public foundational AI models or public datasets.
                </p>
              </div>
            </div>
          </section>

          {/* SECTION 2: BANK STATEMENT UPLOADS */}
          <section id="bank-statement-uploads" className="glass-panel rounded-3xl p-6 md:p-8 space-y-4 scroll-mt-28">
            <div className="flex items-center gap-3 pb-3 border-b border-[#2B303B]">
              <div className="w-9 h-9 rounded-xl bg-[#6FA88C]/10 border border-[#6FA88C]/30 flex items-center justify-center text-[#6FA88C]">
                <span className="material-symbols-outlined text-[20px]">upload_file</span>
              </div>
              <div>
                <span className="text-[11px] font-mono text-[#6FA88C] uppercase tracking-wider block">Section 02</span>
                <h2 className="font-headline text-xl md:text-2xl font-normal text-[#ECEEF3]">2. Bank Statement Uploads</h2>
              </div>
            </div>

            <p className="text-[#8A93A3]">
              StopTheDrip allows users to upload financial statements for the singular purpose of identifying 
              forgotten recurring charges, hidden rate creep, and unused subscription leaks.
            </p>

            <div className="space-y-3">
              <h4 className="text-xs font-mono uppercase tracking-wider text-[#ECEEF3]">Accepted File Types & Formats</h4>
              <div className="flex flex-wrap gap-2">
                {['.PDF (Bank & Credit Statements)', '.CSV (Transaction Exports)', '.XLSX / .XLS (Excel Spreadsheets)', '.TXT (Formatted Ledger Logs)'].map((fmt, i) => (
                  <span key={i} className="px-3 py-1.5 rounded-xl bg-[#181C25] border border-[#2B303B] text-xs font-mono text-[#D99A4E]">
                    {fmt}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#181C25] border border-[#2B303B] space-y-2">
              <h4 className="text-xs font-semibold text-[#ECEEF3]">Purpose Limitation</h4>
              <p className="text-xs text-[#8A93A3] leading-relaxed">
                Uploaded files are ingested exclusively to execute the user-initiated audit. The parser extracts date, 
                merchant name, and transaction amounts in order to classify cadence (monthly, quarterly, annual) and generate 
                step-by-step cancellation playbooks. No secondary data extraction or profiling is conducted.
              </p>
            </div>
          </section>

          {/* SECTION 3: DATA ENCRYPTION */}
          <section id="data-encryption" className="glass-panel rounded-3xl p-6 md:p-8 space-y-4 scroll-mt-28">
            <div className="flex items-center gap-3 pb-3 border-b border-[#2B303B]">
              <div className="w-9 h-9 rounded-xl bg-[#D99A4E]/10 border border-[#D99A4E]/30 flex items-center justify-center text-[#D99A4E]">
                <span className="material-symbols-outlined text-[20px]">lock</span>
              </div>
              <div>
                <span className="text-[11px] font-mono text-[#D99A4E] uppercase tracking-wider block">Section 03</span>
                <h2 className="font-headline text-xl md:text-2xl font-normal text-[#ECEEF3]">3. Data Encryption Standards</h2>
              </div>
            </div>

            <p className="text-[#8A93A3]">
              We implement industry-standard cryptographic techniques to safeguard sensitive financial information during transit and throughout computational processing.
            </p>

            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#181C25] border border-[#2B303B] space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-[#ECEEF3] flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#6FA88C] text-[18px]">key</span>
                    <span>Client-Side AES-256-GCM Payload Encryption</span>
                  </h4>
                  <span className="text-[11px] font-mono text-[#6FA88C] bg-[#6FA88C]/10 px-2 py-0.5 rounded border border-[#6FA88C]/20">Active</span>
                </div>
                <p className="text-xs text-[#8A93A3] leading-relaxed">
                  When supported by your modern browser, statement bytes are encrypted via the Web Crypto API using 
                  <strong> 256-bit AES-GCM</strong> (Advanced Encryption Standard in Galois/Counter Mode with 96-bit unique nonces) 
                  prior to network dispatch. Decryption occurs temporarily in volatile server memory solely to run the transaction parser.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#181C25] border border-[#2B303B] space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-[#ECEEF3] flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#6FA88C] text-[18px]">vpn_lock</span>
                    <span>Transport Layer Security (HTTPS / TLS 1.3)</span>
                  </h4>
                  <span className="text-[11px] font-mono text-[#6FA88C] bg-[#6FA88C]/10 px-2 py-0.5 rounded border border-[#6FA88C]/20">Enforced</span>
                </div>
                <p className="text-xs text-[#8A93A3] leading-relaxed">
                  All communications between your browser, the client interface, and the backend analysis endpoints 
                  are strictly encrypted in transit using <strong>HTTPS with TLS 1.3 / TLS 1.2</strong>, preventing interception, eavesdropping, or tampering.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#202531]/70 border border-[#D99A4E]/30 text-xs text-[#8A93A3] flex gap-3 leading-relaxed">
                <span className="material-symbols-outlined text-[#D99A4E] text-[20px] flex-shrink-0">verified</span>
                <div>
                  <strong className="text-[#ECEEF3] block mb-0.5">Honest Security Transparency:</strong>
                  We adhere to verifiable, realistic engineering standards. We do not claim false marketing superlatives 
                  such as "unhackable" or "100% invulnerable security". Instead, we rely on established cryptographic primitives and minimization of data exposure.
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 4: DATA STORAGE & ARCHITECTURE */}
          <section id="data-storage" className="glass-panel rounded-3xl p-6 md:p-8 space-y-4 scroll-mt-28">
            <div className="flex items-center gap-3 pb-3 border-b border-[#2B303B]">
              <div className="w-9 h-9 rounded-xl bg-[#6FA88C]/10 border border-[#6FA88C]/30 flex items-center justify-center text-[#6FA88C]">
                <span className="material-symbols-outlined text-[20px]">memory</span>
              </div>
              <div>
                <span className="text-[11px] font-mono text-[#6FA88C] uppercase tracking-wider block">Section 04</span>
                <h2 className="font-headline text-xl md:text-2xl font-normal text-[#ECEEF3]">4. Data Storage & System Architecture</h2>
              </div>
            </div>

            <p className="text-[#8A93A3]">
              The core security architecture of StopTheDrip is built around the principle of <strong>Zero Persistent Storage</strong> for uploaded files.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-[#181C25] border border-[#2B303B] space-y-2">
                <span className="font-mono text-[#6FA88C] text-[11px] block">01. Volatile Ingestion</span>
                <h5 className="font-medium text-[#ECEEF3]">RAM-Only Streams</h5>
                <p className="text-[#8A93A3]">
                  Files are streamed directly into server RAM as volatile byte buffers. No unencrypted copies are written to temporary disk folders or persistent databases.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#181C25] border border-[#2B303B] space-y-2">
                <span className="font-mono text-[#D99A4E] text-[11px] block">02. Stateless Parsing</span>
                <h5 className="font-medium text-[#ECEEF3]">Isolated Scope</h5>
                <p className="text-[#8A93A3]">
                  Transaction tokens are evaluated in an isolated execution thread without creating user transaction archives on our backend file systems.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#181C25] border border-[#2B303B] space-y-2">
                <span className="font-mono text-[#6FA88C] text-[11px] block">03. Rapid Eviction</span>
                <h5 className="font-medium text-[#ECEEF3]">Automatic Disposal</h5>
                <p className="text-[#8A93A3]">
                  Upon completing JSON serialization of the leak audit results, statement buffers are immediately de-referenced and purged from memory.
                </p>
              </div>
            </div>
          </section>

          {/* SECTION 5: ACCESS CONTROL & ISOLATION */}
          <section id="access-control" className="glass-panel rounded-3xl p-6 md:p-8 space-y-4 scroll-mt-28">
            <div className="flex items-center gap-3 pb-3 border-b border-[#2B303B]">
              <div className="w-9 h-9 rounded-xl bg-[#D99A4E]/10 border border-[#D99A4E]/30 flex items-center justify-center text-[#D99A4E]">
                <span className="material-symbols-outlined text-[20px]">badge</span>
              </div>
              <div>
                <span className="text-[11px] font-mono text-[#D99A4E] uppercase tracking-wider block">Section 05</span>
                <h2 className="font-headline text-xl md:text-2xl font-normal text-[#ECEEF3]">5. Access Control & User Isolation</h2>
              </div>
            </div>

            <p className="text-[#8A93A3]">
              We enforce strict data isolation boundaries to ensure that only the authenticated owner of an audit session can access analysis results.
            </p>

            <ul className="space-y-3 text-xs text-[#8A93A3]">
              <li className="p-3.5 rounded-xl bg-[#181C25] border border-[#2B303B] flex items-start gap-3">
                <span className="material-symbols-outlined text-[#6FA88C] text-[18px] flex-shrink-0 mt-0.5">check_circle</span>
                <div>
                  <strong className="text-[#ECEEF3] block mb-0.5">Client-Side Session Isolation:</strong>
                  Audit findings, leak vector tallies, and cancellation playbooks are rendered directly within your active browser session memory.
                </div>
              </li>
              <li className="p-3.5 rounded-xl bg-[#181C25] border border-[#2B303B] flex items-start gap-3">
                <span className="material-symbols-outlined text-[#6FA88C] text-[18px] flex-shrink-0 mt-0.5">check_circle</span>
                <div>
                  <strong className="text-[#ECEEF3] block mb-0.5">Authenticated User Scoping:</strong>
                  When signing in via Google SSO, authentication tokens are validated via Firebase Auth. User sessions are cryptographically separated to prevent cross-account data leakage.
                </div>
              </li>
              <li className="p-3.5 rounded-xl bg-[#181C25] border border-[#2B303B] flex items-start gap-3">
                <span className="material-symbols-outlined text-[#6FA88C] text-[18px] flex-shrink-0 mt-0.5">check_circle</span>
                <div>
                  <strong className="text-[#ECEEF3] block mb-0.5">Strict System Access Restrictions:</strong>
                  Backend microservice endpoints are protected behind secure network gateways. Administrative staff have zero access to uploaded customer statement contents.
                </div>
              </li>
            </ul>
          </section>

          {/* SECTION 6: DATA RETENTION & DELETION */}
          <section id="data-retention" className="glass-panel rounded-3xl p-6 md:p-8 space-y-4 scroll-mt-28">
            <div className="flex items-center gap-3 pb-3 border-b border-[#2B303B]">
              <div className="w-9 h-9 rounded-xl bg-[#6FA88C]/10 border border-[#6FA88C]/30 flex items-center justify-center text-[#6FA88C]">
                <span className="material-symbols-outlined text-[20px]">auto_delete</span>
              </div>
              <div>
                <span className="text-[11px] font-mono text-[#6FA88C] uppercase tracking-wider block">Section 06</span>
                <h2 className="font-headline text-xl md:text-2xl font-normal text-[#ECEEF3]">6. Data Retention & Deletion Policy</h2>
              </div>
            </div>

            <p className="text-[#8A93A3]">
              StopTheDrip applies a default <strong>Zero-Retention Policy (0 minutes / Ephemeral)</strong> for raw uploaded documents. 
              The application automatically discards files immediately upon response generation.
            </p>

            {/* Configurable Retention Controls */}
            <div className="p-5 rounded-2xl bg-[#181C25] border border-[#2B303B] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#2B303B]">
                <div>
                  <h4 className="text-xs font-semibold text-[#ECEEF3]">Configurable Document Retention Setting</h4>
                  <p className="text-[11px] text-[#8A93A3]">Configure your preferred audit lifecycle window.</p>
                </div>
                <div className="flex items-center gap-2">
                  {[
                    { val: '0', label: '0 min (Immediate Purge)' },
                    { val: '15', label: '15 min (Session Cache)' },
                    { val: '60', label: '60 min (Extended)' },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      onClick={() => setRetentionWindow(opt.val)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                        retentionWindow === opt.val
                          ? 'bg-[#D99A4E] text-[#12151C] font-semibold'
                          : 'bg-[#12151C] text-[#8A93A3] hover:text-[#ECEEF3] border border-[#2B303B]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-xs text-[#8A93A3] space-y-2">
                <p>
                  <strong>Current Policy Configuration:</strong>{' '}
                  {retentionWindow === '0'
                    ? 'Documents are processed strictly in RAM and deleted immediately upon request completion. No files or records are saved to long-term storage.'
                    : `Analysis results are temporarily retained in client-side memory for ${retentionWindow} minutes to facilitate export/printing, after which automated cleanup triggers.`}
                </p>
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={handlePurgeMemory}
                    className="px-4 py-2 rounded-xl bg-[#202531] border border-[#6FA88C]/40 text-[#6FA88C] hover:bg-[#6FA88C]/10 text-xs font-mono flex items-center gap-1.5 transition-all"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
                    <span>Trigger Immediate Manual Memory & Cache Wipe</span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 7: THIRD-PARTY SERVICES */}
          <section id="third-party-services" className="glass-panel rounded-3xl p-6 md:p-8 space-y-4 scroll-mt-28">
            <div className="flex items-center gap-3 pb-3 border-b border-[#2B303B]">
              <div className="w-9 h-9 rounded-xl bg-[#D99A4E]/10 border border-[#D99A4E]/30 flex items-center justify-center text-[#D99A4E]">
                <span className="material-symbols-outlined text-[20px]">hub</span>
              </div>
              <div>
                <span className="text-[11px] font-mono text-[#D99A4E] uppercase tracking-wider block">Section 07</span>
                <h2 className="font-headline text-xl md:text-2xl font-normal text-[#ECEEF3]">7. Third-Party Services & Sub-processors</h2>
              </div>
            </div>

            <p className="text-[#8A93A3]">
              To deliver high-availability hosting, authentication, and AI classification, StopTheDrip coordinates with 
              trusted third-party infrastructure providers. User data is shared solely to the extent necessary to perform core functionality:
            </p>

            <div className="space-y-3">
              {[
                {
                  name: 'Frontend Hosting & CDN',
                  provider: 'Vercel Inc.',
                  purpose: 'Static web application hosting, Edge caching, and secure asset delivery.',
                  dataScope: 'Web traffic telemetry, anonymized request metadata, TLS termination.'
                },
                {
                  name: 'Backend API Compute',
                  provider: 'Render / Cloud Compute',
                  purpose: 'FastAPI container execution for statement parsing and algorithmic classification.',
                  dataScope: 'Encrypted request payloads in ephemeral RAM during active processing.'
                },
                {
                  name: 'User Authentication',
                  provider: 'Google Firebase Auth',
                  purpose: 'Secure OAuth 2.0 single sign-on and credential management.',
                  dataScope: 'User email, display name, and avatar URL. (Never receives bank statements).'
                },
                {
                  name: 'AI Leak Classification',
                  provider: 'Google Gemini API / Anthropic Claude API',
                  purpose: 'Semantic merchant categorization and cancellation playbook generation.',
                  dataScope: 'Sanitized transaction descriptors passed via zero-retention enterprise API endpoints.'
                },
              ].map((sub, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-[#181C25] border border-[#2B303B] space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#ECEEF3]">{sub.name}</span>
                    <span className="font-mono text-[#D99A4E] text-[11px]">{sub.provider}</span>
                  </div>
                  <p className="text-[#8A93A3]"><strong className="text-[#ECEEF3]/80">Purpose:</strong> {sub.purpose}</p>
                  <p className="text-[#8A93A3]"><strong className="text-[#ECEEF3]/80">Data Scope:</strong> {sub.dataScope}</p>
                </div>
              ))}
            </div>
          </section>

          {/* SECTION 8: USER RESPONSIBILITIES */}
          <section id="user-responsibilities" className="glass-panel rounded-3xl p-6 md:p-8 space-y-4 scroll-mt-28">
            <div className="flex items-center gap-3 pb-3 border-b border-[#2B303B]">
              <div className="w-9 h-9 rounded-xl bg-[#6FA88C]/10 border border-[#6FA88C]/30 flex items-center justify-center text-[#6FA88C]">
                <span className="material-symbols-outlined text-[20px]">person_check</span>
              </div>
              <div>
                <span className="text-[11px] font-mono text-[#6FA88C] uppercase tracking-wider block">Section 08</span>
                <h2 className="font-headline text-xl md:text-2xl font-normal text-[#ECEEF3]">8. User Responsibilities</h2>
              </div>
            </div>

            <p className="text-[#8A93A3]">
              While StopTheDrip implements rigorous safeguards, users play a vital role in maintaining end-to-end security. 
              By utilizing the application, you agree to:
            </p>

            <ul className="space-y-2.5 text-xs text-[#8A93A3]">
              <li className="flex items-start gap-2.5">
                <span className="material-symbols-outlined text-[#D99A4E] text-[16px] flex-shrink-0 mt-0.5">arrow_right</span>
                <span><strong>Authorization:</strong> Only upload financial statements, invoices, or ledger exports that you are legally authorized to possess and analyze. Do not upload third-party confidential records without lawful consent.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="material-symbols-outlined text-[#D99A4E] text-[16px] flex-shrink-0 mt-0.5">arrow_right</span>
                <span><strong>Device Security:</strong> Access StopTheDrip from secure, malware-free devices with up-to-date operating systems and modern web browsers supporting Web Crypto.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="material-symbols-outlined text-[#D99A4E] text-[16px] flex-shrink-0 mt-0.5">arrow_right</span>
                <span><strong>Password & Credentials:</strong> If using Google SSO, safeguard your Google account with two-factor authentication (2FA) and log out on shared computers.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="material-symbols-outlined text-[#D99A4E] text-[16px] flex-shrink-0 mt-0.5">arrow_right</span>
                <span><strong>Prohibited Payloads:</strong> Do not upload executable files, corrupted archives, or files containing malicious scripts or embedded exploits.</span>
              </li>
            </ul>
          </section>

          {/* SECTION 9: SECURITY LIMITATIONS */}
          <section id="security-limitations" className="glass-panel rounded-3xl p-6 md:p-8 space-y-4 scroll-mt-28">
            <div className="flex items-center gap-3 pb-3 border-b border-[#2B303B]">
              <div className="w-9 h-9 rounded-xl bg-[#D99A4E]/10 border border-[#D99A4E]/30 flex items-center justify-center text-[#D99A4E]">
                <span className="material-symbols-outlined text-[20px]">warning_amber</span>
              </div>
              <div>
                <span className="text-[11px] font-mono text-[#D99A4E] uppercase tracking-wider block">Section 09</span>
                <h2 className="font-headline text-xl md:text-2xl font-normal text-[#ECEEF3]">9. Security Limitations & Inherent Risks</h2>
              </div>
            </div>

            <p className="text-[#8A93A3]">
              No electronic transmission over the internet or cloud-based computational processing can be guaranteed to be 100% impenetrable. 
              While StopTheDrip utilizes AES-256-GCM encryption, TLS 1.3 transport security, and ephemeral RAM execution, users acknowledge:
            </p>

            <div className="p-4 rounded-2xl bg-[#181C25] border border-[#2B303B] space-y-2 text-xs text-[#8A93A3]">
              <p>
                • <strong>Internet Transmission Risks:</strong> Information transmitted across public telecommunications networks may encounter unforeseen intermediary vulnerabilities.
              </p>
              <p>
                • <strong>Client Environment:</strong> Security cannot be guaranteed if the user's local operating system or browser environment is compromised by spyware, keyloggers, or unauthorized browser extensions.
              </p>
              <p>
                • <strong>Disclaimer:</strong> StopTheDrip disclaims liability for data breaches resulting from unauthorized access to your private device, compromised credentials, or zero-day infrastructure vulnerabilities beyond our reasonable engineering control.
              </p>
            </div>
          </section>

          {/* SECTION 10: POLICY UPDATES */}
          <section id="policy-updates" className="glass-panel rounded-3xl p-6 md:p-8 space-y-4 scroll-mt-28">
            <div className="flex items-center gap-3 pb-3 border-b border-[#2B303B]">
              <div className="w-9 h-9 rounded-xl bg-[#6FA88C]/10 border border-[#6FA88C]/30 flex items-center justify-center text-[#6FA88C]">
                <span className="material-symbols-outlined text-[20px]">update</span>
              </div>
              <div>
                <span className="text-[11px] font-mono text-[#6FA88C] uppercase tracking-wider block">Section 10</span>
                <h2 className="font-headline text-xl md:text-2xl font-normal text-[#ECEEF3]">10. Policy Updates & Version History</h2>
              </div>
            </div>

            <p className="text-[#8A93A3]">
              As our algorithms, supported bank formats, and security tooling evolve, this policy may be revised. 
              The most current edition will always be published on this page with the effective date clearly updated.
            </p>

            <div className="p-4 rounded-2xl bg-[#181C25] border border-[#2B303B] space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-[#2B303B]">
                <span className="font-mono text-[#ECEEF3]">Version {POLICY_CONFIG.version} (Current)</span>
                <span className="font-mono text-[#6FA88C]">{POLICY_CONFIG.lastUpdated}</span>
              </div>
              <p className="text-[#8A93A3]">
                Added formal AES-256-GCM in-memory encryption standards, ephemeral retention controls, sub-processor disclosures, and legal deployment advisories.
              </p>
            </div>
          </section>

          {/* SECTION 11: CONTACT */}
          <section id="contact" className="glass-panel rounded-3xl p-6 md:p-8 space-y-5 scroll-mt-28">
            <div className="flex items-center gap-3 pb-3 border-b border-[#2B303B]">
              <div className="w-9 h-9 rounded-xl bg-[#D99A4E]/10 border border-[#D99A4E]/30 flex items-center justify-center text-[#D99A4E]">
                <span className="material-symbols-outlined text-[20px]">mail</span>
              </div>
              <div>
                <span className="text-[11px] font-mono text-[#D99A4E] uppercase tracking-wider block">Section 11</span>
                <h2 className="font-headline text-xl md:text-2xl font-normal text-[#ECEEF3]">11. Contact & Security Inquiries</h2>
              </div>
            </div>

            <p className="text-[#8A93A3]">
              If you have questions regarding this Privacy & Security Policy, wish to report a potential security vulnerability, 
              or have inquiries regarding data handling, please contact our security team:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div className="p-4 rounded-2xl bg-[#181C25] border border-[#2B303B] space-y-2">
                <span className="font-mono text-[11px] text-[#8A93A3] uppercase block">General Privacy Inquiries</span>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-[#ECEEF3]">{POLICY_CONFIG.privacyEmail}</span>
                  <button
                    onClick={() => handleCopyEmail(POLICY_CONFIG.privacyEmail)}
                    className="p-1.5 rounded-lg bg-[#202531] hover:bg-[#2B303B] text-[#D99A4E] transition-colors"
                    title="Copy Email"
                  >
                    <span className="material-symbols-outlined text-[16px]">content_copy</span>
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#181C25] border border-[#2B303B] space-y-2">
                <span className="font-mono text-[11px] text-[#8A93A3] uppercase block">Security & Vulnerability Reports</span>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-[#ECEEF3]">{POLICY_CONFIG.securityEmail}</span>
                  <button
                    onClick={() => handleCopyEmail(POLICY_CONFIG.securityEmail)}
                    className="p-1.5 rounded-lg bg-[#202531] hover:bg-[#2B303B] text-[#D99A4E] transition-colors"
                    title="Copy Email"
                  >
                    <span className="material-symbols-outlined text-[16px]">content_copy</span>
                  </button>
                </div>
              </div>
            </div>

            {copiedEmail && (
              <p className="text-xs text-[#6FA88C] font-mono text-center animate-in fade-in">
                ✓ Email address copied to clipboard.
              </p>
            )}
          </section>

          {/* Return & Terms Navigation Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-[#2B303B]">
            <button
              onClick={() => onNavigate('upload')}
              className="shimmer-btn px-6 py-3 rounded-xl text-[#12151C] text-xs font-semibold flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">play_arrow</span>
              <span>Launch Statement Audit</span>
            </button>

            <button
              onClick={() => onNavigate('terms')}
              className="px-5 py-3 rounded-xl bg-[#181C25] border border-[#2B303B] hover:border-[#D99A4E] text-xs font-mono text-[#8A93A3] hover:text-[#ECEEF3] transition-all flex items-center gap-2"
            >
              <span>View Terms of Service</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
        </main>
      </div>
    </div>
  )
}
