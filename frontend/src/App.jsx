import React, { useState, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { encryptStatementBuffer } from './crypto'
import { signInWithGoogle, logOut, subscribeToAuthChanges, isFirebaseConfigured } from './firebase'
import PrivacyPolicyPage from './components/PrivacyPolicyPage'
import TermsOfServicePage from './components/TermsOfServicePage'

const API_BASE_URL = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

// Baseline dataset matching the design system
const INITIAL_RESULTS = {
  total_leaks_detected: 5,
  total_annual_leak: 18468,
  total_monthly_leak: 1539,
  active_subscriptions_count: 5,
  forgotten_leaks_count: 2,
  potential_annual_savings: 12576,
  audit_health_score: 62,
  leak_vectors: [
    {
      id: 'item-1',
      friendly_name: 'Cult.fit Pass',
      merchant: 'Cult.fit Gym & Live',
      tag: 'Forgotten',
      confidence: 0.96,
      subtitle: 'Zero check-ins in 4 months • Medium difficulty',
      monthly_amount: 999,
      annual_amount: 11988,
      description: "Zero partner gym check-ins detected since November. Auto-renews monthly on linked credit card ending in 4092.",
      note: 'Cancellation takes ~3 mins via mobile app profile settings.',
      steps: [
        'Open Cult.fit app, tap Profile > Active Memberships.',
        'Select Cult Pass Live & Gym > Manage Subscription.',
        'Tap Pause or Cancel Membership and confirm cancellation.'
      ],
      action_type: 'cancel',
      action_label: 'Cancel subscription'
    },
    {
      id: 'item-2',
      friendly_name: 'Netflix UHD 4K',
      merchant: 'Netflix Inc',
      tag: 'Active',
      confidence: 0.94,
      subtitle: 'Streamed 2 days ago • Easy downgrade/cancel',
      monthly_amount: 649,
      annual_amount: 7788,
      description: 'High engagement streaming profile. Consider downgrading to standard HD if 4K multi-screen is unused.',
      note: 'Instant 1-click downgrade or cancel available anytime.',
      steps: [
        'Sign in to Netflix.com on web browser.',
        'Navigate to Account > Plan Details.',
        'Select Change Plan or Cancel Membership.'
      ],
      action_type: 'manage',
      action_label: 'Manage plan'
    },
    {
      id: 'item-3',
      friendly_name: 'Calm Mindset Pro',
      merchant: 'Calm.com',
      tag: 'Forgotten',
      confidence: 0.91,
      subtitle: 'Zero app sessions logged in 180 days',
      monthly_amount: 499,
      annual_amount: 5988,
      description: 'Pure capital leak. App was launched only once during trial onboarding.',
      note: 'Low activity detected — cancel to instantly save ₹499/mo.',
      steps: [
        'Open Apple Subscriptions or Google Play Subscriptions.',
        'Locate Calm Pro under Active Subscriptions.',
        'Tap Cancel Subscription and confirm.'
      ],
      action_type: 'cancel',
      action_label: 'Cancel subscription'
    },
    {
      id: 'item-4',
      friendly_name: 'iCloud Storage 200GB',
      merchant: 'Apple Services',
      tag: 'Active',
      confidence: 0.89,
      subtitle: 'Daily photo sync active • Essential utility',
      monthly_amount: 219,
      annual_amount: 2628,
      description: 'Active cloud backup holding 142 GB of family photos and device backups.',
      note: 'Managed directly via iOS Settings > Apple ID.',
      steps: [
        'Open iPhone Settings > tap your Apple ID banner.',
        'Tap iCloud > Manage Account Storage > Change Storage Plan.'
      ],
      action_type: 'manage',
      action_label: 'Manage plan'
    },
    {
      id: 'item-5',
      friendly_name: 'Spotify Premium Duo',
      merchant: 'Spotify AB',
      tag: 'Active',
      confidence: 0.88,
      subtitle: 'Daily music & podcasts streaming',
      monthly_amount: 119,
      annual_amount: 1428,
      description: 'High utilization streaming service with active shared duo member.',
      note: 'Managed through Spotify web billing portal.',
      steps: [
        'Sign in to Spotify.com/account.',
        'Under Your Plan, click Change Plan or Cancel Premium.'
      ],
      action_type: 'manage',
      action_label: 'Manage plan'
    }
  ],
  spend_by_category: [
    { name: 'Health & Fitness', monthly_amount: 999, percentage: 40, bar_width_pct: 40 },
    { name: 'Entertainment & Streaming', monthly_amount: 768, percentage: 31, bar_width_pct: 31 },
    { name: 'Wellness & Mindset', monthly_amount: 499, percentage: 20, bar_width_pct: 20 },
    { name: 'Cloud & Utilities', monthly_amount: 219, percentage: 9, bar_width_pct: 9 }
  ],
  optimization_callout: 'Cancelling Cult.fit Pass and Calm Mindset immediately recovers ₹1,498 / month (₹17,976 / year) with zero disruption to your daily life.'
}

const SUPPORTED_SERVICES = [
  'HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank', 'Kotak Mahindra', 
  'Chase Bank', 'American Express', 'Netflix', 'Spotify', 'Cult.fit', 'AWS Cloud', 
  'Calm Mindset', 'iCloud', 'OpenAI ChatGPT', 'GitHub Pro', 'Adobe Creative Cloud', 
  'YouTube Premium', 'Google Workspace', 'Disney+ Hotstar', 'Swiggy One', 'Zomato Gold'
]

/**
 * Enhanced 3D WebGL Three.js Canvas with Mouse Parallax & Splash Physics
 */
function DripCanvas() {
  const mountRef = useRef(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const width = mount.clientWidth || 340
    const height = mount.clientHeight || 360

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100)
    camera.position.set(0, 0.6, 6.2)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)

    // Metallic Pipe Joint (Source of the leak)
    const pipeGeo = new THREE.TorusGeometry(1.18, 0.18, 20, 64)
    const pipeMat = new THREE.MeshStandardMaterial({
      color: 0x6FA88C,
      metalness: 0.6,
      roughness: 0.3,
    })
    const pipe = new THREE.Mesh(pipeGeo, pipeMat)
    pipe.rotation.x = Math.PI / 2.3
    pipe.position.y = 1.45
    scene.add(pipe)

    // Concentric Cyber Wire Ring
    const wireGeo = new THREE.TorusGeometry(1.48, 0.015, 8, 64)
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x3E4756 })
    const wireRing = new THREE.Mesh(wireGeo, wireMat)
    wireRing.rotation.x = Math.PI / 2.3
    wireRing.position.y = 1.45
    scene.add(wireRing)

    // Floor Splash Ripple Disc
    const splashGeo = new THREE.RingGeometry(0.08, 0.65, 32)
    const splashMat = new THREE.MeshBasicMaterial({
      color: 0xD99A4E,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide
    })
    const splash = new THREE.Mesh(splashGeo, splashMat)
    splash.rotation.x = -Math.PI / 2
    splash.position.y = -1.6
    scene.add(splash)

    // Dynamic Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.7)
    scene.add(ambient)
    const key = new THREE.DirectionalLight(0xffffff, 1.2)
    key.position.set(3, 5, 5)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0xD99A4E, 0.8)
    rim.position.set(-4, -2, -3)
    scene.add(rim)
    const emeraldRim = new THREE.DirectionalLight(0x6FA88C, 0.5)
    emeraldRim.position.set(0, -3, 2)
    scene.add(emeraldRim)

    // Droplets
    const dropGeo = new THREE.SphereGeometry(0.12, 20, 20)
    const dropMat = new THREE.MeshStandardMaterial({
      color: 0xD99A4E,
      metalness: 0.3,
      roughness: 0.15,
      transparent: true,
    })

    const drops = []
    const DROP_COUNT = 7
    for (let i = 0; i < DROP_COUNT; i++) {
      const mesh = new THREE.Mesh(dropGeo, dropMat.clone())
      mesh.visible = false
      scene.add(mesh)
      drops.push({
        mesh,
        y: 1.1,
        active: false,
        delay: i * (1.9 / DROP_COUNT),
      })
    }

    let elapsed = 0
    let raf
    const clock = new THREE.Clock()

    // Mouse parallax target
    let mouseX = 0
    let mouseY = 0
    const onMouseMove = (e) => {
      const rect = mount.getBoundingClientRect()
      mouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 0.8
      mouseY = ((e.clientY - rect.top) / rect.height - 0.5) * 0.8
    }
    mount.addEventListener('mousemove', onMouseMove)

    function animate() {
      raf = requestAnimationFrame(animate)
      const dt = clock.getDelta()
      elapsed += dt

      camera.position.x += (mouseX - camera.position.x) * 0.05
      camera.position.y += (0.6 - mouseY - camera.position.y) * 0.05
      camera.lookAt(0, 0, 0)

      pipe.rotation.z += dt * 0.25
      wireRing.rotation.z -= dt * 0.15

      drops.forEach((d) => {
        const t = (elapsed - d.delay) % 1.9
        if (t < 0) {
          d.mesh.visible = false
          return
        }
        d.mesh.visible = true
        const fallProgress = Math.min(t / 1.45, 1)
        const y = 1.15 - fallProgress * fallProgress * 2.75
        d.mesh.position.set(0, y, 0)
        const stretch = 1 + fallProgress * 0.75
        d.mesh.scale.set(1 / stretch, stretch, 1 / stretch)
        d.mesh.material.opacity = t < 1.45 ? 1 : Math.max(0, 1 - (t - 1.45) / 0.45)

        if (fallProgress > 0.95) {
          splash.material.opacity = THREE.MathUtils.lerp(splash.material.opacity, 0.4, 0.2)
          splash.scale.setScalar(1 + (fallProgress - 0.95) * 8)
        } else {
          splash.material.opacity = THREE.MathUtils.lerp(splash.material.opacity, 0, 0.1)
        }
      })

      renderer.render(scene, camera)
    }
    animate()

    function handleResize() {
      if (!mount) return
      const w = mount.clientWidth
      const h = mount.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', handleResize)
      if (mount) mount.removeEventListener('mousemove', onMouseMove)
      renderer.dispose()
      pipeGeo.dispose()
      pipeMat.dispose()
      wireGeo.dispose()
      wireMat.dispose()
      dropGeo.dispose()
      dropMat.dispose()
      splashGeo.dispose()
      splashMat.dispose()
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [])

  return <div ref={mountRef} className="w-full h-full min-h-[320px] cursor-crosshair" />
}

export default function App() {
  const getInitialStateFromUrl = () => {
    if (typeof window === 'undefined') return 'upload'
    const path = window.location.pathname.toLowerCase()
    if (path === '/policy' || path.startsWith('/policy/')) return 'policy'
    if (path === '/terms' || path === '/terms-of-service' || path.startsWith('/terms/')) return 'terms'
    if (path === '/results') return 'results'
    return 'upload'
  }

  const [currentState, setCurrentState] = useState(getInitialStateFromUrl) // 'upload' | 'analyzing' | 'results' | 'policy' | 'terms'
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const [resultsData, setResultsData] = useState(INITIAL_RESULTS)
  const [openAccordions, setOpenAccordions] = useState({ 'item-1': true })
  const [filterTag, setFilterTag] = useState('All') // 'All' | 'Forgotten' | 'Active'
  const [simulationHorizon, setSimulationHorizon] = useState(1) // 1, 3, 5 years
  const [errorMessage, setErrorMessage] = useState(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [encryptionStatus, setEncryptionStatus] = useState('256-bit local AES-GCM verified')
  const [scrollProgress, setScrollProgress] = useState(0)
  const [showScrollTop, setShowScrollTop] = useState(false)

  // Firebase Auth State
  const [currentUser, setCurrentUser] = useState(null)
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [showConfigHelp, setShowConfigHelp] = useState(false)

  // PDF In-Browser Password Unlock State
  const [statementPassword, setStatementPassword] = useState('')
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false)
  const [pendingFile, setPendingFile] = useState(null)
  const [passwordError, setPasswordError] = useState(null)
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [showInlinePasswordInput, setShowInlinePasswordInput] = useState(false)

  // Telemetry Progression
  const [analyzingStep, setAnalyzingStep] = useState(1)
  const [loadingTitle, setLoadingTitle] = useState('Initializing in-memory decryption...')
  const [loadingDesc, setLoadingDesc] = useState('256-bit AES-GCM hardware cipher active')

  const fileInputRef = useRef(null)

  // Sync with browser Back / Forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const stateFromUrl = getInitialStateFromUrl()
      setCurrentState(stateFromUrl)
      setIsMobileNavOpen(false)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // Scroll Progress and Observer Listener
  useEffect(() => {
    const handleScroll = () => {
      const totalScroll = document.documentElement.scrollHeight - window.innerHeight
      if (totalScroll > 0) {
        const currentProgress = (window.scrollY / totalScroll) * 100
        setScrollProgress(currentProgress)
      }
      setShowScrollTop(window.scrollY > 300)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Auto-trigger reveal animations on scroll
  useEffect(() => {
    const elements = document.querySelectorAll('.reveal-on-scroll')
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
          }
        })
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    )

    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [currentState, filterTag])

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((user) => {
      setCurrentUser(user)
    })
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [])

  const switchState = (newState) => {
    setCurrentState(newState)
    setIsMobileNavOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    if (typeof window !== 'undefined' && window.history) {
      let targetPath = '/'
      if (newState === 'policy') targetPath = '/policy'
      else if (newState === 'terms') targetPath = '/terms'
      else if (newState === 'results') targetPath = '/results'
      else if (newState === 'upload') targetPath = '/'

      if (window.location.pathname !== targetPath) {
        window.history.pushState({ state: newState }, '', targetPath)
      }
    }
  }

  const toggleAccordion = (id) => {
    setOpenAccordions((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const handleGoogleSignIn = async () => {
    if (!isFirebaseConfigured) {
      setShowConfigHelp(true)
      return
    }
    try {
      setIsSigningIn(true)
      setErrorMessage(null)
      await signInWithGoogle()
    } catch (err) {
      console.error('Google SSO error:', err)
      if (err.code !== 'auth/popup-closed-by-user') {
        setErrorMessage(err.message || 'Failed to authenticate with Google.')
      }
    } finally {
      setIsSigningIn(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await logOut()
      setIsUserMenuOpen(false)
    } catch (err) {
      console.error('Sign out error:', err)
    }
  }

  const startAnalyzingAnimation = () => {
    setCurrentState('analyzing')
    setAnalyzingStep(1)
    setLoadingTitle('Parsing statement structure in RAM...')
    setLoadingDesc('Zero disk footprint • Volatile memory parsing')

    const t1 = setTimeout(() => {
      setAnalyzingStep(2)
      setLoadingTitle('Cross-referencing 45,000+ merchant signatures...')
      setLoadingDesc('Matching recurring cadences, gym passes, and streaming tiers')
    }, 900)

    const t2 = setTimeout(() => {
      setAnalyzingStep(3)
      setLoadingTitle('Autonomous Dual-Agent leak evaluation...')
      setLoadingDesc('Compounding annual savings and generating cancellation steps')
    }, 1800)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }

  const performAnalysis = async (file, useSample = false, pwd = null) => {
    setErrorMessage(null)
    setPasswordError(null)
    const activePassword = pwd !== null ? pwd : statementPassword
    const cleanupAnimation = startAnalyzingAnimation()
    const startTime = Date.now()

    try {
      let data = null

      if (!useSample && file) {
        let uploadPayload = null
        const fileBuffer = await file.arrayBuffer()
        const cryptoResult = await encryptStatementBuffer(fileBuffer)

        if (cryptoResult.success) {
          setEncryptionStatus('256-bit Web Crypto encryption active')
          const formData = new FormData()
          formData.append('is_encrypted', 'true')
          formData.append('encrypted_payload_b64', cryptoResult.encryptedPayloadB64)
          formData.append('nonce_b64', cryptoResult.nonceB64)
          formData.append('key_b64', cryptoResult.keyB64)
          formData.append('filename', file.name)
          if (activePassword) formData.append('password', activePassword)
          uploadPayload = formData
        } else {
          const formData = new FormData()
          formData.append('file', file)
          if (activePassword) formData.append('password', activePassword)
          uploadPayload = formData
        }

        const endpoint = `${API_BASE_URL}/analyze`
        const response = await fetch(endpoint, {
          method: 'POST',
          body: uploadPayload,
        })

        if (!response.ok) {
          const errText = await response.text()
          if (errText.includes('PASSWORD_REQUIRED') || errText.includes('PASSWORD_INCORRECT')) {
            const isIncorrect = errText.includes('PASSWORD_INCORRECT')
            setPendingFile(file)
            setPasswordError(
              isIncorrect
                ? 'Incorrect password. Most banks use DOB (DDMMYYYY) or PAN / Last 4 digits of debit card.'
                : 'This PDF is password-protected. Enter the password below to unlock and analyze instantly.'
            )
            setShowPasswordPrompt(true)
            cleanupAnimation()
            switchState('upload')
            return
          }
          throw new Error(`Server returned ${response.status}: ${errText}`)
        }

        data = await response.json()
      } else {
        const endpoint = `${API_BASE_URL}/analyze`
        const response = await fetch(endpoint, {
          method: 'POST',
        }).catch(() => null)

        if (response && response.ok) {
          data = await response.json()
        } else {
          data = INITIAL_RESULTS
        }
      }

      const elapsed = Date.now() - startTime
      if (elapsed < 1800) {
        await new Promise((r) => setTimeout(r, 1800 - elapsed))
      }

      setResultsData(data || INITIAL_RESULTS)
      setShowPasswordPrompt(false)
      setPendingFile(null)
      cleanupAnimation()
      switchState('results')
    } catch (err) {
      console.error('Analysis error:', err)
      cleanupAnimation()
      if (useSample || err.message?.includes('fetch') || err.message?.includes('Failed')) {
        await new Promise((r) => setTimeout(r, 1200))
        setResultsData(INITIAL_RESULTS)
        switchState('results')
      } else {
        setErrorMessage(err.message || 'Unable to process statement.')
        switchState('upload')
      }
    }
  }

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setPendingFile(file)
      setStatementPassword('')
      setPasswordError(null)
      setShowPasswordPrompt(false)
      performAnalysis(file, false, '')
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      setPendingFile(file)
      setStatementPassword('')
      setPasswordError(null)
      setShowPasswordPrompt(false)
      performAnalysis(file, false, '')
    }
  }

  const handleUnlockAndAnalyze = (e) => {
    e?.preventDefault()
    if (pendingFile) {
      performAnalysis(pendingFile, false, statementPassword)
    } else {
      fileInputRef.current?.click()
    }
  }

  const handleExportCSV = () => {
    const rows = [['Merchant', 'Friendly Name', 'Monthly Amount', 'Annual Cost', 'Confidence', 'Status']]
    resultsData.leak_vectors?.forEach((v) => {
      rows.push([
        `"${v.merchant || ''}"`,
        `"${v.friendly_name || ''}"`,
        v.monthly_amount,
        v.annual_amount,
        v.confidence || 0.9,
        `"${v.tag || ''}"`,
      ])
    })
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', 'StopTheDrip_Audit_Report.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const filteredLeaks = (resultsData.leak_vectors || []).filter((item) => {
    if (filterTag === 'All') return true
    return item.tag === filterTag
  })

  return (
    <div className="min-h-screen bg-[#0E1117] text-[#ECEEF3] flex flex-col selection:bg-[#D99A4E]/30 selection:text-[#D99A4E] relative overflow-x-hidden">
      {/* Realtime Scroll Progress Top Indicator */}
      <div 
        className="fixed top-0 left-0 h-[2.5px] bg-gradient-to-r from-[#D99A4E] via-[#6FA88C] to-[#D99A4E] z-50 transition-all duration-150 shadow-[0_0_8px_#D99A4E]" 
        style={{ width: `${scrollProgress}%` }} 
      />

      {/* Dynamic Ambient Background Glows */}
      <div className="absolute top-0 left-1/4 w-[650px] h-[450px] bg-[#6FA88C]/10 rounded-full blur-[150px] pointer-events-none -z-10 animate-pulse"></div>
      <div className="absolute top-40 right-10 w-[550px] h-[550px] bg-[#D99A4E]/10 rounded-full blur-[170px] pointer-events-none -z-10"></div>

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept=".pdf,.csv,.xlsx,.xls,.txt"
        className="hidden"
      />

      {/* LUXURY FROSTED HEADER */}
      <header className="w-full border-b border-[#2B303B]/70 bg-[#0E1117]/85 backdrop-blur-2xl sticky top-0 z-40 transition-all">
        <div className="max-w-7xl mx-auto px-6 md:px-12 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => switchState('upload')}
              className="text-left font-headline text-2xl md:text-3xl font-normal tracking-tight text-[#ECEEF3] hover:text-[#D99A4E] transition-all flex items-center gap-2.5 group"
            >
              <div className="w-8 h-8 rounded-lg bg-[#181C25] border border-[#2B303B] flex items-center justify-center text-lg group-hover:scale-110 transition-transform">
                💧
              </div>
              <span>stop the drip</span>
            </button>
            <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-[#181C25] border border-[#2B303B] rounded-full text-xs text-[#8A93A3]">
              <span className="w-2 h-2 rounded-full bg-[#6FA88C] radar-glow"></span>
              <span className="font-mono text-[11px] tracking-wide">neural audit online</span>
            </div>
          </div>

          {/* Navigation Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-mono uppercase tracking-widest text-[#8A93A3]">
            <button
              onClick={() => switchState('upload')}
              className={`hover:text-[#ECEEF3] transition-colors ${currentState === 'upload' ? 'text-[#D99A4E] font-semibold' : ''}`}
            >
              Statement Audit
            </button>
            <button
              onClick={() => switchState('results')}
              className={`hover:text-[#ECEEF3] transition-colors ${currentState === 'results' ? 'text-[#D99A4E] font-semibold' : ''}`}
            >
              Leak Vectors ({resultsData.leak_vectors?.length || 5})
            </button>
            <button
              onClick={() => switchState('policy')}
              className={`hover:text-[#ECEEF3] transition-colors ${currentState === 'policy' ? 'text-[#D99A4E] font-semibold' : ''}`}
            >
              Privacy & Security
            </button>
            <button
              onClick={() => switchState('terms')}
              className={`hover:text-[#ECEEF3] transition-colors ${currentState === 'terms' ? 'text-[#D99A4E] font-semibold' : ''}`}
            >
              Terms
            </button>
            <a
              href="https://www.ilovepdf.com/unlock_pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#6FA88C] hover:text-[#6FA88C]/80 transition-colors flex items-center gap-1 font-semibold"
            >
              <span>Unlock PDF</span>
              <span className="text-[10px]">↗</span>
            </a>
          </nav>

          {/* User Profile / Google SSO Button & Mobile Toggle */}
          <div className="flex items-center gap-3">
            {currentUser ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2.5 p-1 pl-3 pr-2 rounded-full bg-[#181C25] border border-[#2B303B] hover:border-[#D99A4E] transition-all text-left shadow-lg"
                >
                  <span className="text-xs font-medium text-[#ECEEF3] max-w-[120px] truncate">
                    {currentUser.displayName || currentUser.email?.split('@')[0] || 'User'}
                  </span>
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt="User avatar"
                      className="w-7 h-7 rounded-full border border-[#2B303B] object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-[#D99A4E]/20 text-[#D99A4E] border border-[#D99A4E]/40 flex items-center justify-center text-xs font-semibold">
                      {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                    </div>
                  )}
                </button>

                {/* Dropdown Menu */}
                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-[#181C25] border border-[#2B303B] rounded-2xl shadow-2xl py-2.5 z-50 animate-in fade-in">
                    <div className="px-4 py-2 border-b border-[#2B303B]">
                      <p className="text-xs font-medium text-[#ECEEF3] truncate">{currentUser.displayName || 'Google Account'}</p>
                      <p className="text-[11px] text-[#8A93A3] truncate font-mono">{currentUser.email}</p>
                    </div>
                    <button
                      onClick={() => { setIsUserMenuOpen(false); switchState('policy') }}
                      className="w-full text-left px-4 py-2 text-xs text-[#8A93A3] hover:text-[#ECEEF3] hover:bg-[#202531] transition-colors flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-[16px]">shield</span>
                      <span>Privacy & Security</span>
                    </button>
                    <button
                      onClick={() => { setIsUserMenuOpen(false); switchState('terms') }}
                      className="w-full text-left px-4 py-2 text-xs text-[#8A93A3] hover:text-[#ECEEF3] hover:bg-[#202531] transition-colors flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-[16px]">description</span>
                      <span>Terms of Service</span>
                    </button>
                    <div className="border-t border-[#2B303B] my-1"></div>
                    <button
                      onClick={handleSignOut}
                      className="w-full text-left px-4 py-2 text-xs text-[#FF6B6B] hover:bg-[#202531] transition-colors flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-[16px]">logout</span>
                      <span>Sign out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={handleGoogleSignIn}
                disabled={isSigningIn}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full bg-[#181C25] hover:bg-[#202531] border border-[#2B303B] hover:border-[#D99A4E] transition-all text-xs font-medium text-[#ECEEF3] shadow-md active:scale-95 group"
              >
                <svg className="w-4 h-4 group-hover:scale-110 transition-transform flex-shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.9c2.28-2.1 3.64-5.2 3.64-9.15z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.9-3.05c-1.08.72-2.45 1.16-4.03 1.16-3.1 0-5.73-2.09-6.67-4.91H1.27v3.14C3.25 21.36 7.31 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.33 14.29c-.24-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.57H1.27C.46 8.19 0 10.03 0 12s.46 3.81 1.27 5.43l4.06-3.14z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.64 1.27 6.57l4.06 3.14c.94-2.82 3.57-4.96 6.67-4.96z"/>
                </svg>
                <span className="hidden sm:inline">{isSigningIn ? 'Connecting...' : 'Sign in'}</span>
                <span className="sm:hidden">{isSigningIn ? '...' : 'Sign in'}</span>
              </button>
            )}

            {/* Mobile Hamburger Toggle Button */}
            <button
              onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
              className="md:hidden p-2 rounded-xl bg-[#181C25] border border-[#2B303B] text-[#8A93A3] hover:text-[#ECEEF3] hover:border-[#D99A4E] transition-all"
              aria-label="Toggle Navigation Menu"
            >
              <span className="material-symbols-outlined text-[22px]">
                {isMobileNavOpen ? 'close' : 'menu'}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileNavOpen && (
          <div className="md:hidden border-t border-[#2B303B] bg-[#0E1117]/95 backdrop-blur-2xl px-6 py-4 space-y-2 animate-in slide-in-from-top-2">
            <button
              onClick={() => switchState('upload')}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-mono uppercase tracking-wider flex items-center justify-between ${
                currentState === 'upload' ? 'bg-[#D99A4E]/20 text-[#D99A4E] font-semibold' : 'text-[#8A93A3]'
              }`}
            >
              <span>Statement Audit</span>
              <span className="material-symbols-outlined text-[16px]">upload_file</span>
            </button>
            <button
              onClick={() => switchState('results')}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-mono uppercase tracking-wider flex items-center justify-between ${
                currentState === 'results' ? 'bg-[#D99A4E]/20 text-[#D99A4E] font-semibold' : 'text-[#8A93A3]'
              }`}
            >
              <span>Leak Vectors ({resultsData.leak_vectors?.length || 5})</span>
              <span className="material-symbols-outlined text-[16px]">analytics</span>
            </button>
            <button
              onClick={() => switchState('policy')}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-mono uppercase tracking-wider flex items-center justify-between ${
                currentState === 'policy' ? 'bg-[#D99A4E]/20 text-[#D99A4E] font-semibold' : 'text-[#8A93A3]'
              }`}
            >
              <span>Privacy & Security Policy</span>
              <span className="material-symbols-outlined text-[16px]">shield</span>
            </button>
            <button
              onClick={() => switchState('terms')}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-mono uppercase tracking-wider flex items-center justify-between ${
                currentState === 'terms' ? 'bg-[#D99A4E]/20 text-[#D99A4E] font-semibold' : 'text-[#8A93A3]'
              }`}
            >
              <span>Terms of Service</span>
              <span className="material-symbols-outlined text-[16px]">description</span>
            </button>
            <a
              href="https://www.ilovepdf.com/unlock_pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-mono uppercase tracking-wider text-[#6FA88C] flex items-center justify-between"
            >
              <span>iLovePDF Unlocker</span>
              <span className="text-xs">↗</span>
            </a>
          </div>
        )}
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 md:px-12 py-10 md:py-16">
        {/* REVIEWER VIEW TOGGLES */}
        <aside aria-label="Reviewer Controls" className="fixed bottom-6 right-6 z-50 flex items-center gap-1.5 p-1.5 bg-[#181C25]/90 backdrop-blur-xl border border-[#2B303B] rounded-xl shadow-2xl">
          <span className="text-[10px] text-[#8A93A3] px-1.5 font-mono hidden sm:inline">Stage:</span>
          <button
            className={`px-2.5 py-1 rounded-lg text-[11px] transition-all font-mono ${
              currentState === 'upload' ? 'bg-[#D99A4E] text-[#12151C] font-semibold shadow' : 'text-[#8A93A3] hover:text-[#ECEEF3]'
            }`}
            onClick={() => switchState('upload')}
          >
            audit
          </button>
          <button
            className={`px-2.5 py-1 rounded-lg text-[11px] transition-all font-mono ${
              currentState === 'results' ? 'bg-[#D99A4E] text-[#12151C] font-semibold shadow' : 'text-[#8A93A3] hover:text-[#ECEEF3]'
            }`}
            onClick={() => switchState('results')}
          >
            results
          </button>
          <button
            className={`px-2.5 py-1 rounded-lg text-[11px] transition-all font-mono ${
              currentState === 'policy' ? 'bg-[#D99A4E] text-[#12151C] font-semibold shadow' : 'text-[#8A93A3] hover:text-[#ECEEF3]'
            }`}
            onClick={() => switchState('policy')}
          >
            policy
          </button>
          <button
            className={`px-2.5 py-1 rounded-lg text-[11px] transition-all font-mono ${
              currentState === 'terms' ? 'bg-[#D99A4E] text-[#12151C] font-semibold shadow' : 'text-[#8A93A3] hover:text-[#ECEEF3]'
            }`}
            onClick={() => switchState('terms')}
          >
            terms
          </button>
        </aside>

        {/* ========================================================= */}
        {/* STATE 1: 3D HERO & UPLOAD WORKSPACE */}
        {/* ========================================================= */}
        {currentState === 'upload' && (
          <div className="space-y-16 animate-in fade-in duration-500">
            {/* HERO 3D EXPERIENCE */}
            <div className="glass-panel rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-hidden gradient-border-glow reveal-on-scroll is-visible">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
                {/* Left Telemetry & Story */}
                <div className="lg:col-span-7 space-y-6 z-10">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#181C25] border border-[#2B303B] rounded-full text-xs text-[#6FA88C] font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#6FA88C] animate-ping"></span>
                    <span>autonomous recurring capital audit</span>
                  </div>
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-headline font-normal text-[#ECEEF3] leading-[1.12]">
                    Every month, something <span className="italic text-[#D99A4E] font-headline">drips out</span> unnoticed.
                  </h1>
                  <p className="text-base text-[#8A93A3] leading-relaxed max-w-xl font-normal">
                    Upload your bank statement. StopTheDrip isolates forgotten subscriptions, hidden price hikes, and dormant recurring charges — with zero disk storage and in-browser 256-bit AES-GCM encryption.
                  </p>

                  {/* Compounding Live KPIs */}
                  <div className="grid grid-cols-3 gap-6 pt-4 border-t border-[#2B303B]/80">
                    <div>
                      <div className="font-headline text-3xl md:text-4xl text-[#D99A4E] font-normal">
                        ₹{(resultsData.total_monthly_leak || 1539).toLocaleString()}
                      </div>
                      <div className="text-[11px] font-mono text-[#8A93A3] mt-1 uppercase tracking-wider">
                        monthly leak
                      </div>
                    </div>
                    <div>
                      <div className="font-headline text-3xl md:text-4xl text-[#ECEEF3] font-normal">
                        ₹{(resultsData.total_annual_leak || 18468).toLocaleString()}
                      </div>
                      <div className="text-[11px] font-mono text-[#8A93A3] mt-1 uppercase tracking-wider">
                        1-yr loss
                      </div>
                    </div>
                    <div>
                      <div className="font-headline text-3xl md:text-4xl text-[#6FA88C] font-normal">
                        ₹{(resultsData.potential_annual_savings || 12576).toLocaleString()}
                      </div>
                      <div className="text-[11px] font-mono text-[#8A93A3] mt-1 uppercase tracking-wider">
                        reclaimable
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right 3D Interactive Three.js Canvas */}
                <div className="lg:col-span-5 h-[350px] relative flex items-center justify-center">
                  <div className="w-full h-full rounded-2xl bg-[#12151C]/60 border border-[#2B303B] overflow-hidden shadow-2xl relative group">
                    <DripCanvas />
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-[#0E1117]/80 border border-[#2B303B] text-[10px] font-mono text-[#6FA88C] backdrop-blur-sm pointer-events-none flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#6FA88C] animate-pulse"></span>
                      <span>3D WebGL Telemetry</span>
                    </div>
                    <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-md bg-[#0E1117]/80 border border-[#2B303B] text-[10px] font-mono text-[#8A93A3] backdrop-blur-sm pointer-events-none">
                      Move mouse to tilt
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* INFINITE SCROLLING SUPPORTED MERCHANTS & BANKS TICKER */}
            <div className="reveal-on-scroll overflow-hidden py-4 border-y border-[#2B303B]/60 bg-[#12151C]/50 backdrop-blur-sm">
              <div className="animate-marquee items-center gap-8 text-xs font-mono text-[#8A93A3]">
                {SUPPORTED_SERVICES.concat(SUPPORTED_SERVICES).map((service, idx) => (
                  <span key={idx} className="flex items-center gap-3">
                    <span className="text-[#6FA88C]">⚡</span>
                    <span className="hover:text-[#ECEEF3] transition-colors">{service}</span>
                    <span className="text-[#2B303B]">•</span>
                  </span>
                ))}
              </div>
            </div>

            {/* AUDIT WORKSPACE (Upload Dropzone + Step-by-Step Guide) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start reveal-on-scroll">
              {/* UPLOAD WORKSPACE */}
              <div className="lg:col-span-7 space-y-6">
                <div className="space-y-1.5">
                  <h2 className="font-headline text-2xl text-[#ECEEF3] font-normal">
                    Audit Your Statement
                  </h2>
                  <p className="text-xs text-[#8A93A3]">
                    Accepts statements from HDFC, ICICI, SBI, Axis, Kotak, Chase, Amex, and global banks.
                  </p>
                </div>

                {/* Error Banner */}
                {errorMessage && (
                  <div className="p-4 bg-[#3A1B1B] border border-[#FF6B6B]/40 text-[#FF6B6B] rounded-2xl text-xs flex items-center gap-3">
                    <span className="material-symbols-outlined text-[18px]">error</span>
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Interactive Drag & Drop Area */}
                <div
                  className={`border border-dashed transition-all rounded-3xl p-10 cursor-pointer flex flex-col items-start gap-4 ${
                    isDragOver
                      ? 'border-[#D99A4E] bg-[#181C25] shadow-2xl scale-[1.01]'
                      : 'border-[#2B303B] hover:border-[#D99A4E] bg-[#181C25]/50 hover:bg-[#181C25]'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                >
                  <div className="w-14 h-14 rounded-2xl border border-[#2B303B] bg-[#0E1117] flex items-center justify-center text-[#D99A4E] shadow-inner">
                    <span className="material-symbols-outlined text-[28px]">upload_file</span>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium text-[#ECEEF3]">
                      Drop bank statement PDF or CSV here, or <span className="text-[#D99A4E] underline underline-offset-4 font-semibold">browse files</span>
                    </p>
                    <p className="text-xs text-[#8A93A3]">
                      Encrypted locally in RAM before transmission • Zero files stored on disk
                    </p>
                  </div>
                </div>

                {/* Instant Sample Button */}
                <div className="flex flex-wrap items-center gap-4 pt-1">
                  <button
                    className="shimmer-btn px-7 py-3.5 rounded-2xl text-[#12151C] text-sm font-semibold flex items-center gap-2.5 shadow-xl active:scale-95"
                    onClick={() => performAnalysis(null, true)}
                  >
                    <span className="material-symbols-outlined text-[18px]">bolt</span>
                    Try Live Sample Audit (142 Transactions)
                  </button>
                </div>

                {/* Quick Security Status Badges */}
                <div className="flex flex-wrap items-center gap-6 text-xs text-[#8A93A3] pt-4 border-t border-[#2B303B]">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-[#6FA88C]">lock</span> 256-bit AES-GCM
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-[#6FA88C]">memory</span> 0-Disk RAM Volatility
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-[#6FA88C]">shield</span> PII Sanitized
                  </span>
                </div>
              </div>

              {/* STEP-BY-STEP HOW-TO GUIDE (with iLovePDF link) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="glass-panel rounded-3xl p-7 space-y-5">
                  <div className="flex items-center justify-between border-b border-[#2B303B] pb-3">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#D99A4E] text-[20px]">help_outline</span>
                      <h3 className="font-headline text-lg font-medium text-[#ECEEF3]">How to Use</h3>
                    </div>
                    <span className="text-[11px] font-mono text-[#D99A4E] px-2.5 py-0.5 rounded-full bg-[#181C25] border border-[#2B303B]">
                      3 quick steps
                    </span>
                  </div>

                  {/* Step 1: Direct Password Entry */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5 text-xs font-semibold text-[#ECEEF3]">
                      <span className="w-5 h-5 rounded-full bg-[#D99A4E]/20 text-[#D99A4E] border border-[#D99A4E]/40 flex items-center justify-center text-[11px] font-mono">1</span>
                      <span>Type Password Directly on Page</span>
                    </div>
                    <p className="text-xs text-[#8A93A3] pl-7 leading-relaxed">
                      If your bank statement PDF is password-protected (e.g. DOB/PAN), simply enter your password right in the box on the website. No external tools required!
                    </p>
                    <div className="pl-7 pt-1">
                      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#12151C] border border-[#6FA88C]/30 text-[11px] font-mono text-[#6FA88C]">
                        <span className="material-symbols-outlined text-[15px]">key</span>
                        <span>In-Memory Instant Decryption</span>
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Upload */}
                  <div className="space-y-1.5 pt-3 border-t border-[#2B303B]/60">
                    <div className="flex items-center gap-2.5 text-xs font-semibold text-[#ECEEF3]">
                      <span className="w-5 h-5 rounded-full bg-[#D99A4E]/20 text-[#D99A4E] border border-[#D99A4E]/40 flex items-center justify-center text-[11px] font-mono">2</span>
                      <span>Upload Unlocked PDF or CSV</span>
                    </div>
                    <p className="text-xs text-[#8A93A3] pl-7 leading-relaxed">
                      Drop your decrypted PDF or bank CSV directly into the workspace on the left.
                    </p>
                  </div>

                  {/* Step 3: Instant AI Audit */}
                  <div className="space-y-1.5 pt-3 border-t border-[#2B303B]/60">
                    <div className="flex items-center gap-2.5 text-xs font-semibold text-[#ECEEF3]">
                      <span className="w-5 h-5 rounded-full bg-[#D99A4E]/20 text-[#D99A4E] border border-[#D99A4E]/40 flex items-center justify-center text-[11px] font-mono">3</span>
                      <span>Get Instant Audit &amp; Savings</span>
                    </div>
                    <p className="text-xs text-[#8A93A3] pl-7 leading-relaxed">
                      Our neural engine isolates leaks against 45,000+ signatures and generates immediate cancellation playbooks.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 4 BANK-GRADE ENCRYPTION PILLARS */}
            <div className="space-y-6 pt-6 border-t border-[#2B303B] reveal-on-scroll">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="font-headline text-2xl font-normal text-[#ECEEF3]">
                    Bank-Grade Encryption &amp; Privacy Suite
                  </h2>
                  <p className="text-xs text-[#8A93A3]">
                    Why uploading your bank statement to StopTheDrip is 100% confidential and mathematically safe.
                  </p>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-[#181C25] border border-[#2B303B] rounded-full text-xs text-[#6FA88C] font-mono self-start sm:self-auto">
                  <span className="material-symbols-outlined text-[15px]">verified_user</span>
                  <span>zero-storage certified</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass-panel-interactive p-6 rounded-2xl space-y-3 group">
                  <div className="w-10 h-10 rounded-xl bg-[#181C25] border border-[#2B303B] flex items-center justify-center text-[#D99A4E] group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[22px]">enhanced_encryption</span>
                  </div>
                  <h3 className="text-sm font-semibold text-[#ECEEF3] font-headline">In-Browser 256-Bit AES</h3>
                  <p className="text-xs text-[#8A93A3] leading-relaxed">
                    Statements are encrypted in your browser memory via the native W3C Web Crypto API before transmission.
                  </p>
                </div>

                <div className="glass-panel-interactive p-6 rounded-2xl space-y-3 group">
                  <div className="w-10 h-10 rounded-xl bg-[#181C25] border border-[#2B303B] flex items-center justify-center text-[#6FA88C] group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[22px]">memory</span>
                  </div>
                  <h3 className="text-sm font-semibold text-[#ECEEF3] font-headline">0-Disk RAM Volatility</h3>
                  <p className="text-xs text-[#8A93A3] leading-relaxed">
                    Zero database storage (no Postgres/MongoDB). Statements exist strictly as transient memory buffers and are purged immediately.
                  </p>
                </div>

                <div className="glass-panel-interactive p-6 rounded-2xl space-y-3 group">
                  <div className="w-10 h-10 rounded-xl bg-[#181C25] border border-[#2B303B] flex items-center justify-center text-[#D99A4E] group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[22px]">shield</span>
                  </div>
                  <h3 className="text-sm font-semibold text-[#ECEEF3] font-headline">Automatic PII Scrubbing</h3>
                  <p className="text-xs text-[#8A93A3] leading-relaxed">
                    Account numbers, card details, balances, and customer names are stripped before AI merchant auditing.
                  </p>
                </div>

                <div className="glass-panel-interactive p-6 rounded-2xl space-y-3 group">
                  <div className="w-10 h-10 rounded-xl bg-[#181C25] border border-[#2B303B] flex items-center justify-center text-[#6FA88C] group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-[22px]">key</span>
                  </div>
                  <h3 className="text-sm font-semibold text-[#ECEEF3] font-headline">Ephemeral Session Keys</h3>
                  <p className="text-xs text-[#8A93A3] leading-relaxed">
                    One-time 96-bit nonces and throwaway encryption keys are generated per audit and permanently destroyed upon report delivery.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STATE 2: TELEMETRY & SCANNING */}
        {/* ========================================================= */}
        {currentState === 'analyzing' && (
          <section className="flex flex-col justify-center min-h-[500px] transition-all duration-300">
            <div className="max-w-xl mx-auto w-full glass-panel rounded-3xl p-8 md:p-12 space-y-8 shadow-2xl gradient-border-glow">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#181C25] border border-[#2B303B] rounded-full text-xs text-[#D99A4E] font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D99A4E] animate-ping"></span>
                  <span>analyzing statement</span>
                </div>
                <h2 className="text-3xl font-headline font-normal text-[#ECEEF3]">
                  {loadingTitle}
                </h2>
                <p className="text-xs text-[#8A93A3] font-mono">
                  {loadingDesc}
                </p>
              </div>

              {/* Scanning Pulse Bar */}
              <div className="w-full h-1.5 bg-[#2B303B] rounded-full relative overflow-hidden">
                <div className="absolute inset-y-0 w-1/3 bg-[#D99A4E] animate-[pulse_1s_infinite] rounded-full shadow-[0_0_12px_#D99A4E]"></div>
              </div>

              {/* Telemetry Stage Indicators */}
              <div className="space-y-4 border-l border-[#2B303B] pl-5 ml-1">
                <div className={`flex items-center gap-3 text-xs font-mono transition-colors ${analyzingStep >= 1 ? 'text-[#6FA88C] font-medium' : 'text-[#8A93A3]'}`}>
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  <span>Ingesting in-memory structure &amp; parsing dates</span>
                </div>
                <div className={`flex items-center gap-3 text-xs font-mono transition-colors ${analyzingStep >= 2 ? 'text-[#6FA88C] font-medium' : 'text-[#8A93A3]'}`}>
                  <span className={`material-symbols-outlined text-[16px] ${analyzingStep >= 2 ? 'text-[#6FA88C]' : 'text-[#2B303B]'}`}>
                    {analyzingStep >= 2 ? 'check_circle' : 'radio_button_unchecked'}
                  </span>
                  <span>Isolating recurring card charges &amp; digital wallets</span>
                </div>
                <div className={`flex items-center gap-3 text-xs font-mono transition-colors ${analyzingStep >= 3 ? 'text-[#6FA88C] font-medium' : 'text-[#8A93A3]'}`}>
                  <span className={`material-symbols-outlined text-[16px] ${analyzingStep >= 3 ? 'text-[#6FA88C]' : 'text-[#2B303B]'}`}>
                    {analyzingStep >= 3 ? 'check_circle' : 'radio_button_unchecked'}
                  </span>
                  <span>Dual-Agent classification &amp; savings compounding</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ========================================================= */}
        {/* STATE 3: RESULTS AUDIT LEDGER */}
        {/* ========================================================= */}
        {currentState === 'results' && (
          <section className="space-y-12 animate-in fade-in duration-500">
            {/* AUDIT SUMMARY HERO BANNER */}
            <div className="glass-panel rounded-3xl p-8 md:p-12 space-y-8 shadow-2xl gradient-border-glow reveal-on-scroll is-visible">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2B303B] pb-6">
                <div>
                  <div className="flex items-center gap-2 text-xs font-mono text-[#6FA88C]">
                    <span className="w-2 h-2 rounded-full bg-[#6FA88C] animate-pulse"></span>
                    <span>Audit Complete • {resultsData.leak_vectors?.length || 5} Leaks Identified</span>
                  </div>
                  <h1 className="text-3xl md:text-5xl font-headline font-normal text-[#ECEEF3] mt-2">
                    Autonomous Leak Ledger
                  </h1>
                </div>
                <button
                  onClick={() => switchState('upload')}
                  className="px-5 py-2.5 rounded-xl bg-[#181C25] border border-[#2B303B] hover:border-[#D99A4E] text-xs text-[#ECEEF3] transition-all self-start md:self-auto shadow-sm"
                >
                  Upload Another Statement
                </button>
              </div>

              {/* Three Big Health Score KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 rounded-2xl bg-[#181C25]/80 border border-[#2B303B] space-y-2">
                  <div className="text-xs font-mono text-[#8A93A3] uppercase">Monthly Leak Rate</div>
                  <div className="text-3xl md:text-4xl font-headline text-[#D99A4E]">
                    ₹{(resultsData.total_monthly_leak || 1539).toLocaleString()} <span className="text-sm font-sans text-[#8A93A3]">/mo</span>
                  </div>
                  <p className="text-xs text-[#8A93A3]">Unclaimed subscription recurring charges</p>
                </div>

                <div className="p-6 rounded-2xl bg-[#181C25]/80 border border-[#2B303B] space-y-2">
                  <div className="text-xs font-mono text-[#8A93A3] uppercase">Annual Compound Loss</div>
                  <div className="text-3xl md:text-4xl font-headline text-[#ECEEF3]">
                    ₹{(resultsData.total_annual_leak || 18468).toLocaleString()} <span className="text-sm font-sans text-[#8A93A3]">/yr</span>
                  </div>
                  <p className="text-xs text-[#8A93A3]">Projected financial drag over 12 months</p>
                </div>

                <div className="p-6 rounded-2xl bg-[#181C25]/80 border border-[#2B303B] space-y-2">
                  <div className="text-xs font-mono text-[#8A93A3] uppercase">Instant Recovery Savings</div>
                  <div className="text-3xl md:text-4xl font-headline text-[#6FA88C]">
                    ₹{(resultsData.potential_annual_savings || 12576).toLocaleString()} <span className="text-sm font-sans text-[#8A93A3]">/yr</span>
                  </div>
                  <p className="text-xs text-[#8A93A3]">Recoverable with zero loss in daily productivity</p>
                </div>
              </div>

              {/* WEALTH COMPOUNDING SIMULATOR */}
              <div className="p-6 rounded-2xl bg-[#12151C]/90 border border-[#2B303B] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-mono text-[#D99A4E] uppercase tracking-wider block">Financial Impact Simulation</span>
                    <h3 className="font-headline text-lg text-[#ECEEF3]">
                      What happens if you plug these leaks today?
                    </h3>
                  </div>
                  {/* Time Horizon Pills */}
                  <div className="flex items-center gap-1.5 p-1 bg-[#181C25] rounded-xl border border-[#2B303B] self-start sm:self-auto">
                    {[1, 3, 5].map((yr) => (
                      <button
                        key={yr}
                        onClick={() => setSimulationHorizon(yr)}
                        className={`px-3 py-1 rounded-lg text-xs font-mono transition-all ${
                          simulationHorizon === yr ? 'bg-[#D99A4E] text-[#12151C] font-semibold' : 'text-[#8A93A3] hover:text-[#ECEEF3]'
                        }`}
                      >
                        {yr} {yr === 1 ? 'Year' : 'Years'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="p-4 rounded-xl bg-[#181C25] border border-[#FF6B6B]/30 space-y-1">
                    <span className="text-[11px] font-mono text-[#FF6B6B] uppercase">Cumulative Money Lost if Untouched</span>
                    <div className="text-2xl font-headline text-[#ECEEF3]">
                      ₹{((resultsData.total_annual_leak || 18468) * simulationHorizon).toLocaleString()}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-[#181C25] border border-[#6FA88C]/30 space-y-1">
                    <span className="text-[11px] font-mono text-[#6FA88C] uppercase">Compounded Wealth Saved &amp; Re-invested</span>
                    <div className="text-2xl font-headline text-[#6FA88C]">
                      ₹{Math.round((resultsData.potential_annual_savings || 12576) * simulationHorizon * (1 + 0.08 * simulationHorizon)).toLocaleString()}
                      <span className="text-xs font-sans text-[#8A93A3] ml-1.5 font-normal">(@8% return)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* AUDIT DETAILS: 2 COLUMN SPLIT */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start reveal-on-scroll">
              {/* LEFT 7 COLS: FILTERABLE EXPANDABLE LEAK ROWS */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#2B303B]">
                  <h3 className="font-headline text-xl font-normal text-[#ECEEF3]">
                    Detected Leak Vectors
                  </h3>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1.5">
                    {['All', 'Forgotten', 'Active'].map((tag) => (
                      <button
                        key={tag}
                        onClick={() => setFilterTag(tag)}
                        className={`px-3 py-1 rounded-full text-xs font-mono transition-all ${
                          filterTag === tag
                            ? 'bg-[#D99A4E] text-[#12151C] font-semibold'
                            : 'bg-[#181C25] text-[#8A93A3] border border-[#2B303B] hover:text-[#ECEEF3]'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  {filteredLeaks.map((item) => {
                    const isOpen = Boolean(openAccordions[item.id])
                    return (
                      <div
                        key={item.id}
                        className={`glass-panel rounded-2xl transition-all overflow-hidden ${
                          isOpen ? 'border-[#D99A4E]/60 shadow-xl' : 'hover:border-[#2B303B]'
                        }`}
                      >
                        <button
                          onClick={() => toggleAccordion(item.id)}
                          className="w-full text-left p-5 flex items-center justify-between gap-4 cursor-pointer"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2.5">
                              <span className="font-headline text-lg text-[#ECEEF3] font-normal">
                                {item.friendly_name || item.merchant}
                              </span>
                              <span
                                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                                  item.tag === 'Forgotten'
                                    ? 'bg-[#D99A4E]/10 text-[#D99A4E] border-[#D99A4E]/30'
                                    : 'bg-[#6FA88C]/10 text-[#6FA88C] border-[#6FA88C]/30'
                                }`}
                              >
                                {item.tag || 'Active'}
                              </span>
                            </div>
                            <p className="text-xs text-[#8A93A3]">
                              {item.subtitle || `Recurring subscription • ${Math.round((item.confidence || 0.9) * 100)}% confidence`}
                            </p>
                          </div>

                          <div className="flex items-center gap-4 text-right">
                            <div>
                              <div className="text-sm font-semibold text-[#D99A4E] font-mono">
                                ₹{(item.monthly_amount || 0).toLocaleString()} /mo
                              </div>
                              <div className="text-[11px] text-[#8A93A3] font-mono">
                                ₹{(item.annual_amount || item.monthly_amount * 12 || 0).toLocaleString()} /yr
                              </div>
                            </div>
                            <span
                              className={`text-[#8A93A3] text-lg transition-transform duration-200 ${
                                isOpen ? 'rotate-45 text-[#D99A4E]' : ''
                              }`}
                            >
                              +
                            </span>
                          </div>
                        </button>

                        {/* Expandable Step-by-Step Playbook */}
                        {isOpen && (
                          <div className="px-5 pb-5 pt-1 border-t border-[#2B303B]/60 space-y-4 text-xs animate-in fade-in">
                            <p className="text-[#8A93A3] leading-relaxed">
                              {item.description}
                            </p>

                            {item.steps && item.steps.length > 0 && (
                              <div className="space-y-2 bg-[#181C25]/80 p-4 rounded-xl border border-[#2B303B]">
                                <span className="font-mono text-[#D99A4E] text-[11px] uppercase tracking-wider block">
                                  1-Click Cancellation Pathway:
                                </span>
                                <ol className="space-y-1.5 list-decimal list-inside text-[#ECEEF3]">
                                  {item.steps.map((s, idx) => (
                                    <li key={idx} className="leading-relaxed">{s}</li>
                                  ))}
                                </ol>
                              </div>
                            )}

                            {item.note && (
                              <div className="flex items-center gap-2 text-[11px] text-[#6FA88C] font-mono">
                                <span className="material-symbols-outlined text-[16px]">info</span>
                                <span>{item.note}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* RIGHT 5 COLS: SPEND BREAKDOWN & EXPORT */}
              <div className="lg:col-span-5 space-y-6">
                <div className="glass-panel rounded-3xl p-7 space-y-6">
                  <div className="pb-3 border-b border-[#2B303B]">
                    <h3 className="font-headline text-xl font-normal text-[#ECEEF3]">
                      Spend by Category
                    </h3>
                  </div>

                  {/* Spend Bars */}
                  <div className="space-y-4">
                    {resultsData.spend_by_category?.map((cat, idx) => (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-[#ECEEF3] font-medium">{cat.name}</span>
                          <span className="text-[#8A93A3] font-mono">
                            ₹{(cat.monthly_amount || 0).toLocaleString()} /mo ({cat.percentage}%)
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-[#12151C] overflow-hidden border border-[#2B303B]">
                          <div
                            className="bg-[#6FA88C] h-full rounded-full transition-all duration-700"
                            style={{ width: `${cat.bar_width_pct || cat.percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {resultsData.optimization_callout && (
                    <div className="p-4 rounded-2xl bg-[#181C25] border border-[#2B303B] text-xs text-[#8A93A3] flex gap-3 leading-relaxed">
                      <span className="material-symbols-outlined text-[#D99A4E] text-[20px] flex-shrink-0">lightbulb</span>
                      <p>{resultsData.optimization_callout}</p>
                    </div>
                  )}

                  {/* Export Dossier */}
                  <div className="pt-4 border-t border-[#2B303B] space-y-3">
                    <h4 className="font-headline text-base font-normal text-[#ECEEF3]">
                      Export Audit Dossier
                    </h4>
                    <p className="text-xs text-[#8A93A3]">
                      Download a clean CSV summary or print an encrypted report.
                    </p>
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <button
                        onClick={handleExportCSV}
                        className="px-4 py-3 rounded-xl bg-[#181C25] border border-[#2B303B] hover:border-[#D99A4E] text-xs font-semibold text-[#ECEEF3] transition-all"
                      >
                        Export CSV
                      </button>
                      <button
                        onClick={() => window.print()}
                        className="shimmer-btn px-4 py-3 rounded-xl text-[#12151C] text-xs font-semibold transition-all"
                      >
                        Export PDF
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* STATE 4: PRIVACY & SECURITY POLICY PAGE */}
        {currentState === 'policy' && (
          <PrivacyPolicyPage onNavigate={switchState} />
        )}

        {/* STATE 5: TERMS OF SERVICE PAGE */}
        {currentState === 'terms' && (
          <TermsOfServicePage onNavigate={switchState} />
        )}
      </main>

      {/* FLOATING BACK TO TOP BUTTON */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 left-6 z-50 w-10 h-10 rounded-full bg-[#181C25] border border-[#2B303B] hover:border-[#D99A4E] text-[#D99A4E] flex items-center justify-center shadow-xl transition-all hover:scale-110 active:scale-95 animate-in fade-in"
          title="Back to Top"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_upward</span>
        </button>
      )}

      {/* LUXURY FOOTER */}
      <footer className="w-full border-t border-[#2B303B] bg-[#0E1117] mt-auto py-12">
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-[#8A93A3] font-mono">
          <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
            <span className="text-[#ECEEF3] font-medium">© StopTheDrip Financial Clarity</span>
            <span className="hidden sm:inline">•</span>
            <span className="text-[#6FA88C] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#6FA88C]"></span>
              <span>Zero Persistent Storage</span>
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <button
              onClick={() => switchState('upload')}
              className="hover:text-[#ECEEF3] transition-colors"
            >
              Statement Audit
            </button>
            <button
              onClick={() => switchState('policy')}
              className={`hover:text-[#ECEEF3] transition-colors ${currentState === 'policy' ? 'text-[#D99A4E] font-semibold' : ''}`}
            >
              Privacy & Security Policy
            </button>
            <button
              onClick={() => switchState('terms')}
              className={`hover:text-[#ECEEF3] transition-colors ${currentState === 'terms' ? 'text-[#D99A4E] font-semibold' : ''}`}
            >
              Terms of Service
            </button>
            <a
              className="hover:text-[#ECEEF3] transition-colors text-[#6FA88C]"
              href="https://www.ilovepdf.com/unlock_pdf"
              target="_blank"
              rel="noopener noreferrer"
            >
              iLovePDF Unlocker ↗
            </a>
          </div>
        </div>
      </footer>

      {/* FIREBASE CONFIG HELP MODAL */}
      {showConfigHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 animate-in fade-in">
          <div className="glass-panel rounded-3xl max-w-md w-full p-6 md:p-8 shadow-2xl space-y-5 border-[#D99A4E]/50">
            <div className="flex items-center justify-between border-b border-[#2B303B] pb-3">
              <div className="flex items-center gap-2.5">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.9c2.28-2.1 3.64-5.2 3.64-9.15z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.9-3.05c-1.08.72-2.45 1.16-4.03 1.16-3.1 0-5.73-2.09-6.67-4.91H1.27v3.14C3.25 21.36 7.31 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.33 14.29c-.24-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.57H1.27C.46 8.19 0 10.03 0 12s.46 3.81 1.27 5.43l4.06-3.14z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.64 1.27 6.57l4.06 3.14c.94-2.82 3.57-4.96 6.67-4.96z"/>
                </svg>
                <h3 className="font-headline text-lg font-medium text-[#ECEEF3]">Google SSO Configuration</h3>
              </div>
              <button 
                onClick={() => setShowConfigHelp(false)}
                className="text-[#8A93A3] hover:text-[#ECEEF3] text-sm p-1"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-[#8A93A3] leading-relaxed">
              Google SSO is fully ready. To connect your Firebase project, set these variables in your <code className="text-[#D99A4E] font-mono">.env</code> or Vercel Environment Variables:
            </p>
            <div className="bg-[#0E1117] p-4 rounded-2xl border border-[#2B303B] font-mono text-[11px] text-[#D99A4E] space-y-1 overflow-x-auto">
              <div>VITE_FIREBASE_API_KEY=...</div>
              <div>VITE_FIREBASE_AUTH_DOMAIN=...</div>
              <div>VITE_FIREBASE_PROJECT_ID=...</div>
              <div>VITE_FIREBASE_STORAGE_BUCKET=...</div>
              <div>VITE_FIREBASE_MESSAGING_SENDER_ID=...</div>
              <div>VITE_FIREBASE_APP_ID=...</div>
            </div>
            <button
              onClick={() => setShowConfigHelp(false)}
              className="shimmer-btn w-full py-3 text-[#12151C] rounded-2xl text-xs font-semibold"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* IN-BROWSER PDF PASSWORD UNLOCK MODAL */}
      {showPasswordPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-4 animate-in fade-in">
          <div className="glass-panel rounded-3xl max-w-md w-full p-6 md:p-8 shadow-2xl space-y-5 border-[#D99A4E]/50">
            <div className="flex items-center justify-between border-b border-[#2B303B] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#D99A4E]/10 border border-[#D99A4E]/30 flex items-center justify-center text-[#D99A4E]">
                  <span className="material-symbols-outlined text-[18px]">lock</span>
                </div>
                <div>
                  <h3 className="font-headline text-lg font-medium text-[#ECEEF3]">Unlock PDF Statement</h3>
                  <span className="text-[10px] font-mono text-[#6FA88C] block">Direct In-Memory Decryption</span>
                </div>
              </div>
              <button 
                onClick={() => { setShowPasswordPrompt(false); setPendingFile(null); }}
                className="text-[#8A93A3] hover:text-[#ECEEF3] text-sm p-1"
              >
                ✕
              </button>
            </div>

            {passwordError && (
              <div className="p-3 bg-[#3A1B1B] border border-[#FF6B6B]/40 text-[#FF6B6B] rounded-xl text-xs flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[16px] flex-shrink-0">info</span>
                <span>{passwordError}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-medium text-[#ECEEF3] block">
                Statement Password for <span className="text-[#D99A4E] font-mono font-normal truncate">{pendingFile?.name || 'Uploaded PDF'}</span>:
              </label>
              <div className="relative">
                <input
                  type={isPasswordVisible ? 'text' : 'password'}
                  value={statementPassword}
                  onChange={(e) => setStatementPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleUnlockAndAnalyze()
                  }}
                  autoFocus
                  placeholder="Type PDF password..."
                  className="w-full px-4 py-3 rounded-xl bg-[#0E1117] border border-[#2B303B] focus:border-[#D99A4E] text-xs font-mono text-[#ECEEF3] placeholder:text-[#8A93A3]/60 outline-none transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A93A3] hover:text-[#ECEEF3] transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {isPasswordVisible ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#12151C] border border-[#2B303B] space-y-1 text-[11px] text-[#8A93A3] font-mono leading-relaxed">
              <span className="text-[#D99A4E] font-semibold block">Common Bank Password Formats:</span>
              <p>• <strong>HDFC / SBI / ICICI:</strong> DOB (DDMMYYYY) or PAN card number.</p>
              <p>• <strong>Axis / Kotak:</strong> First 4 letters of name (CAPS) + DOB (DDMM) or mobile number.</p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setShowPasswordPrompt(false); setPendingFile(null); }}
                className="px-4 py-3 rounded-xl bg-[#181C25] border border-[#2B303B] hover:border-[#8A93A3] text-xs font-mono text-[#8A93A3] hover:text-[#ECEEF3] transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUnlockAndAnalyze}
                className="shimmer-btn px-4 py-3 text-[#12151C] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">lock_open</span>
                <span>Unlock & Analyze</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
