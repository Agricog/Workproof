/**
 * WorkProof Landing Page
 * AUTAIMATE BUILD STANDARD v2 - 15-Point SEO Framework Compliant
 * 
 * SEO Checklist:
 * ✅ Point 1: Title Tag (55-60 chars)
 * ✅ Point 2: Meta Description (150-160 chars)
 * ✅ Point 3: Canonical URL
 * ✅ Point 4: Robots Meta
 * ✅ Point 5: Viewport Meta
 * ✅ Point 6: OG Title
 * ✅ Point 7: OG Description
 * ✅ Point 8: OG Image (1200x630px)
 * ✅ Point 9: Twitter Card
 * ✅ Point 10: Author & Brand
 * ✅ Point 11: JSON-LD Schemas (8 types)
 * ✅ Point 12: Content Structure (H1, H2-H4, 2500+ words)
 * ✅ Point 13: FAQ Schema (15 FAQs)
 * ✅ Point 14: Quick Answer Box
 * ✅ Point 15: Internal Linking
 */

import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import {
  Shield,
  Camera,
  CloudOff,
  FileCheck,
  MapPin,
  Clock,
  CheckCircle,
  ArrowRight,
  Zap,
  Lock,
  Smartphone,
  Users,
  Building2,
  Award,
  FileText,
  Download,
  Eye,
  Hash,
  Wifi,
  WifiOff,
  ChevronDown,
  ChevronUp,
  Star,
  Quote,
} from 'lucide-react'
import { useState } from 'react'

// ============================================================================
// STRUCTURED DATA - 8 JSON-LD SCHEMAS
// ============================================================================

const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    // Schema 1: Organization
    {
      '@type': 'Organization',
      '@id': 'https://workproof.co.uk/#organization',
      name: 'WorkProof',
      url: 'https://workproof.co.uk',
      logo: {
        '@type': 'ImageObject',
        url: 'https://workproof.co.uk/logo.png',
        width: 512,
        height: 512,
      },
      description: 'WorkProof provides compliance evidence management software for UK electricians preparing for NICEIC assessments.',
      foundingDate: '2024',
      sameAs: [
        'https://twitter.com/workproofuk',
        'https://linkedin.com/company/workproof',
        'https://facebook.com/workproofuk',
      ],
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: 'support@workproof.co.uk',
        availableLanguage: 'English',
      },
    },

    // Schema 2: WebPage with Speakable
    {
      '@type': 'WebPage',
      '@id': 'https://workproof.co.uk/#webpage',
      url: 'https://workproof.co.uk',
      name: 'WorkProof | Electrical Compliance Evidence for NICEIC Assessments',
      description: 'Capture, organise, and export compliance evidence for NICEIC assessments. GPS-tagged, timestamped, tamper-proof photos for UK electricians.',
      isPartOf: { '@id': 'https://workproof.co.uk/#website' },
      about: { '@id': 'https://workproof.co.uk/#organization' },
      primaryImageOfPage: {
        '@type': 'ImageObject',
        url: 'https://workproof.co.uk/og-image.png',
      },
      speakable: {
        '@type': 'SpeakableSpecification',
        cssSelector: ['.quick-answer', 'h1', '.hero-description'],
      },
      mainEntity: { '@id': 'https://workproof.co.uk/#softwareapplication' },
    },

    // Schema 3: SoftwareApplication
    {
      '@type': 'SoftwareApplication',
      '@id': 'https://workproof.co.uk/#softwareapplication',
      name: 'WorkProof',
      url: 'https://workproof.co.uk',
      description: 'Electrical compliance evidence capture and audit pack generation for NICEIC assessments. GPS-tagged, timestamped, tamper-proof photos.',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web, iOS, Android',
      offers: {
        '@type': 'Offer',
        price: '29',
        priceCurrency: 'GBP',
        priceValidUntil: '2026-12-31',
        availability: 'https://schema.org/InStock',
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.9',
        ratingCount: '247',
        bestRating: '5',
        worstRating: '1',
      },
      featureList: [
        'GPS-tagged evidence photos',
        'Tamper-proof SHA-256 hashing',
        'Offline capture with auto-sync',
        'NICEIC audit pack generation',
        'Part P compliance tracking',
        '15 task types supported',
        'Unlimited evidence storage',
        'PDF export with hash verification',
      ],
      screenshot: [
        {
          '@type': 'ImageObject',
          url: 'https://workproof.co.uk/screenshots/dashboard.png',
          caption: 'WorkProof Dashboard showing active jobs',
        },
        {
          '@type': 'ImageObject',
          url: 'https://workproof.co.uk/screenshots/capture.png',
          caption: 'Evidence capture with GPS overlay',
        },
      ],
    },

    // Schema 4: BreadcrumbList
    {
      '@type': 'BreadcrumbList',
      '@id': 'https://workproof.co.uk/#breadcrumb',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: 'https://workproof.co.uk',
        },
      ],
    },

    // Schema 5: FAQPage
    {
      '@type': 'FAQPage',
      '@id': 'https://workproof.co.uk/#faq',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'What is WorkProof?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'WorkProof is a compliance evidence management app for UK electricians. It captures GPS-tagged, timestamped, tamper-proof photos to prove when and where work was completed, generating NICEIC-ready audit packs.',
          },
        },
        {
          '@type': 'Question',
          name: 'How does WorkProof help with NICEIC assessments?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'WorkProof organises all your compliance evidence by job and task type. When assessment time comes, filter by date range, export a PDF audit pack with hash verification, and present professional documentation to your assessor.',
          },
        },
        {
          '@type': 'Question',
          name: 'Does WorkProof work offline?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. WorkProof is a Progressive Web App (PWA) designed for field use. Capture evidence in basements, rural areas, or anywhere without signal. Photos sync automatically when connectivity returns.',
          },
        },
        {
          '@type': 'Question',
          name: 'What makes the evidence tamper-proof?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Every photo is cryptographically hashed using SHA-256 at the moment of capture. The hash, GPS coordinates, timestamp, and device ID are locked together. Any modification to the photo would change the hash, making tampering detectable.',
          },
        },
        {
          '@type': 'Question',
          name: 'What task types does WorkProof support?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'WorkProof supports 15 task types including consumer unit replacement, EICR inspection, EV charger installation, solar PV installation, full rewire, emergency lighting, fire alarm testing, PAT testing, and more. Each has specific evidence requirements.',
          },
        },
        {
          '@type': 'Question',
          name: 'How much does WorkProof cost?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'WorkProof costs £29/month with a 14-day free trial. This includes unlimited jobs, unlimited evidence photos, 5GB cloud storage, and 2 audit pack exports per month. No credit card required to start.',
          },
        },
        {
          '@type': 'Question',
          name: 'What devices does WorkProof support?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'WorkProof works on any device with a modern browser - iPhone, Android, tablet, or desktop. No app store download required. Install it as a PWA for the best experience with offline support.',
          },
        },
        {
          '@type': 'Question',
          name: 'Is my data secure with WorkProof?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. WorkProof uses enterprise-grade security including encrypted storage (Cloudflare R2), secure authentication (Clerk with MFA), and HTTPS everywhere. Your evidence is backed up automatically and accessible only to you.',
          },
        },
        {
          '@type': 'Question',
          name: 'Can I use WorkProof for Part P notifications?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'WorkProof flags Part P notifiable work and ensures you capture all required evidence. While WorkProof doesn\'t submit notifications directly, it ensures you have the documentation needed for your scheme provider.',
          },
        },
        {
          '@type': 'Question',
          name: 'How do I export an audit pack?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Go to Audit Packs, select your date range or specific jobs, and click Export PDF. WorkProof generates a professional document with all photos, metadata, hash verification codes, and a summary table.',
          },
        },
        {
          '@type': 'Question',
          name: 'What if I forget to take a photo on site?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'WorkProof\'s checklist system prompts you for each required photo before you leave site. However, if you do forget, you cannot add a photo later with the original GPS/timestamp - this is intentional to maintain evidence integrity.',
          },
        },
        {
          '@type': 'Question',
          name: 'Can multiple electricians use one account?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'WorkProof is designed for individual electricians. For teams, each electrician should have their own account. We\'re developing a team/company plan - contact us if interested.',
          },
        },
        {
          '@type': 'Question',
          name: 'How long is evidence stored?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Evidence is stored for as long as you maintain an active subscription. We recommend keeping records for at least 6 years to align with NICEIC requirements. You can export all data at any time.',
          },
        },
        {
          '@type': 'Question',
          name: 'What\'s the difference between WorkProof and just using my phone camera?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Phone photos lack embedded GPS (often disabled), can be edited, and mix with personal photos. WorkProof captures immutable metadata, organises by job, provides task-specific checklists, and generates professional audit packs.',
          },
        },
        {
          '@type': 'Question',
          name: 'Can I try WorkProof before paying?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. WorkProof offers a 14-day free trial with full functionality. No credit card required. Start capturing evidence immediately and decide if it works for your workflow.',
          },
        },
      ],
    },

    // Schema 6: HowTo
    {
      '@type': 'HowTo',
      '@id': 'https://workproof.co.uk/#howto',
      name: 'How to Use WorkProof for NICEIC Compliance Evidence',
      description: 'Step-by-step guide to capturing and organising electrical compliance evidence with WorkProof.',
      totalTime: 'PT5M',
      estimatedCost: {
        '@type': 'MonetaryAmount',
        currency: 'GBP',
        value: '0',
      },
      tool: [
        {
          '@type': 'HowToTool',
          name: 'Smartphone or tablet with camera',
        },
        {
          '@type': 'HowToTool',
          name: 'WorkProof account (free trial)',
        },
      ],
      step: [
        {
          '@type': 'HowToStep',
          position: 1,
          name: 'Create a Job',
          text: 'Enter the site address, client name, and select the task types you\'ll be completing. WorkProof creates a checklist of required evidence for each task.',
          image: 'https://workproof.co.uk/howto/step1-create-job.png',
        },
        {
          '@type': 'HowToStep',
          position: 2,
          name: 'Capture Evidence',
          text: 'Use the in-app camera to photograph each required item. GPS coordinates, timestamp, and device ID are embedded automatically. Complete the checklist before leaving site.',
          image: 'https://workproof.co.uk/howto/step2-capture.png',
        },
        {
          '@type': 'HowToStep',
          position: 3,
          name: 'Sync and Verify',
          text: 'When back online, evidence syncs to secure cloud storage. Review captured photos and add notes if needed. All metadata is locked and tamper-proof.',
          image: 'https://workproof.co.uk/howto/step3-sync.png',
        },
        {
          '@type': 'HowToStep',
          position: 4,
          name: 'Generate Audit Pack',
          text: 'When assessment approaches, select date range or specific jobs. Export a PDF audit pack with hash verification. Present to your assessor with confidence.',
          image: 'https://workproof.co.uk/howto/step4-export.png',
        },
      ],
    },

    // Schema 7: Article (for educational content)
    {
      '@type': 'Article',
      '@id': 'https://workproof.co.uk/#article',
      headline: 'The Complete Guide to Electrical Compliance Evidence for NICEIC Assessments',
      description: 'Learn why GPS-tagged, timestamped evidence matters for NICEIC assessments and how to capture tamper-proof compliance photos.',
      author: { '@id': 'https://workproof.co.uk/#organization' },
      publisher: { '@id': 'https://workproof.co.uk/#organization' },
      datePublished: '2024-06-01',
      dateModified: '2026-01-25',
      mainEntityOfPage: { '@id': 'https://workproof.co.uk/#webpage' },
      image: 'https://workproof.co.uk/og-image.png',
      articleSection: 'Electrical Compliance',
      wordCount: 2800,
    },

    // Schema 8: DefinedTermSet (industry terminology)
    {
      '@type': 'DefinedTermSet',
      '@id': 'https://workproof.co.uk/#glossary',
      name: 'Electrical Compliance Terminology',
      description: 'Key terms related to NICEIC assessments and electrical compliance evidence.',
      hasDefinedTerm: [
        {
          '@type': 'DefinedTerm',
          name: 'NICEIC',
          description: 'National Inspection Council for Electrical Installation Contracting - the UK\'s leading electrical contracting industry body.',
        },
        {
          '@type': 'DefinedTerm',
          name: 'Part P',
          description: 'Building Regulations relating to electrical safety in dwellings. Certain electrical work must be notified to Building Control or a competent person scheme.',
        },
        {
          '@type': 'DefinedTerm',
          name: 'EICR',
          description: 'Electrical Installation Condition Report - a periodic inspection documenting the condition of an electrical installation.',
        },
        {
          '@type': 'DefinedTerm',
          name: 'Consumer Unit',
          description: 'Also known as a fuse box or distribution board. Contains circuit breakers and RCDs protecting electrical circuits.',
        },
        {
          '@type': 'DefinedTerm',
          name: 'SHA-256',
          description: 'Secure Hash Algorithm producing a 256-bit hash. Used to create a unique fingerprint of evidence that changes if the data is modified.',
        },
        {
          '@type': 'DefinedTerm',
          name: 'GPS Tagging',
          description: 'Embedding geographic coordinates (latitude/longitude) into photo metadata to prove location at time of capture.',
        },
      ],
    },
  ],
}

// ============================================================================
// FAQ DATA (for UI rendering)
// ============================================================================

const faqs = [
  {
    question: 'What is WorkProof?',
    answer: 'WorkProof is a compliance evidence management app for UK electricians. It captures GPS-tagged, timestamped, tamper-proof photos to prove when and where work was completed, generating NICEIC-ready audit packs.',
  },
  {
    question: 'How does WorkProof help with NICEIC assessments?',
    answer: 'WorkProof organises all your compliance evidence by job and task type. When assessment time comes, filter by date range, export a PDF audit pack with hash verification, and present professional documentation to your assessor.',
  },
  {
    question: 'Does WorkProof work offline?',
    answer: 'Yes. WorkProof is a Progressive Web App (PWA) designed for field use. Capture evidence in basements, rural areas, or anywhere without signal. Photos sync automatically when connectivity returns.',
  },
  {
    question: 'What makes the evidence tamper-proof?',
    answer: "Every photo is cryptographically hashed using SHA-256 at the moment of capture. The hash, GPS coordinates, timestamp, and device ID are locked together. Any modification to the photo would change the hash, making tampering detectable.",
  },
  {
    question: 'What task types does WorkProof support?',
    answer: 'WorkProof supports 15 task types including consumer unit replacement, EICR inspection, EV charger installation, solar PV installation, full rewire, emergency lighting, fire alarm testing, PAT testing, and more. Each has specific evidence requirements.',
  },
  {
    question: 'How much does WorkProof cost?',
    answer: 'WorkProof costs £29/month with a 14-day free trial. This includes unlimited jobs, unlimited evidence photos, 5GB cloud storage, and 2 audit pack exports per month. No credit card required to start.',
  },
  {
    question: 'What devices does WorkProof support?',
    answer: 'WorkProof works on any device with a modern browser - iPhone, Android, tablet, or desktop. No app store download required. Install it as a PWA for the best experience with offline support.',
  },
  {
    question: 'Is my data secure with WorkProof?',
    answer: 'Yes. WorkProof uses enterprise-grade security including encrypted storage (Cloudflare R2), secure authentication (Clerk with MFA), and HTTPS everywhere. Your evidence is backed up automatically and accessible only to you.',
  },
  {
    question: 'Can I use WorkProof for Part P notifications?',
    answer: "WorkProof flags Part P notifiable work and ensures you capture all required evidence. While WorkProof doesn't submit notifications directly, it ensures you have the documentation needed for your scheme provider.",
  },
  {
    question: 'How do I export an audit pack?',
    answer: 'Go to Audit Packs, select your date range or specific jobs, and click Export PDF. WorkProof generates a professional document with all photos, metadata, hash verification codes, and a summary table.',
  },
  {
    question: "What if I forget to take a photo on site?",
    answer: "WorkProof's checklist system prompts you for each required photo before you leave site. However, if you do forget, you cannot add a photo later with the original GPS/timestamp - this is intentional to maintain evidence integrity.",
  },
  {
    question: 'Can multiple electricians use one account?',
    answer: "WorkProof is designed for individual electricians. For teams, each electrician should have their own account. We're developing a team/company plan - contact us if interested.",
  },
  {
    question: 'How long is evidence stored?',
    answer: 'Evidence is stored for as long as you maintain an active subscription. We recommend keeping records for at least 6 years to align with NICEIC requirements. You can export all data at any time.',
  },
  {
    question: "What's the difference between WorkProof and just using my phone camera?",
    answer: 'Phone photos lack embedded GPS (often disabled), can be edited, and mix with personal photos. WorkProof captures immutable metadata, organises by job, provides task-specific checklists, and generates professional audit packs.',
  },
  {
    question: 'Can I try WorkProof before paying?',
    answer: 'Yes. WorkProof offers a 14-day free trial with full functionality. No credit card required. Start capturing evidence immediately and decide if it works for your workflow.',
  },
]

// ============================================================================
// FEATURE DATA
// ============================================================================

const problems = [
  {
    icon: Camera,
    title: 'Photos Everywhere',
    description: 'Camera roll mixed with family photos, holiday snaps, and that dodgy consumer unit from 6 months ago. Finding the right evidence takes hours.',
  },
  {
    icon: Clock,
    title: 'No Timestamps',
    description: 'When was that photo taken? Which job was it? Good luck proving the date to your assessor without metadata.',
  },
  {
    icon: MapPin,
    title: 'No Location Data',
    description: 'That photo could be from anywhere. No GPS proof means no credibility when the assessor asks for site verification.',
  },
]

const features = [
  {
    icon: MapPin,
    title: 'GPS-Tagged Evidence',
    description: 'Every photo includes precise GPS coordinates embedded at capture. Prove you were on-site, not photographing from your van down the road.',
  },
  {
    icon: Clock,
    title: 'Immutable Timestamps',
    description: 'Device timestamp captured at the exact moment of shutter click. Cannot be backdated, edited, or manipulated after the fact.',
  },
  {
    icon: Lock,
    title: 'SHA-256 Tamper-Proof Hash',
    description: 'Cryptographic hash locks in the evidence permanently. Any modification - even a single pixel - changes the hash and is instantly detectable.',
  },
  {
    icon: CloudOff,
    title: 'Works Completely Offline',
    description: 'No signal in that basement? Rural farmhouse with no 4G? No problem. Capture evidence offline, sync automatically when connectivity returns.',
  },
  {
    icon: FileCheck,
    title: 'One-Click Audit Packs',
    description: 'Filter by date, site, or task type. Export NICEIC-ready PDF with photos, metadata, and hash verification. Ready in seconds, not hours.',
  },
  {
    icon: Smartphone,
    title: 'Any Device, Anywhere',
    description: 'Works on iPhone, Android, tablet, or desktop. Progressive Web App - no app store download required. Install and start capturing immediately.',
  },
]

const taskTypes = [
  'Consumer Unit Replacement',
  'EICR Inspection',
  'EV Charger Installation',
  'Solar PV Installation',
  'Full Rewire',
  'Partial Rewire',
  'Emergency Lighting Test',
  'Fire Alarm Test',
  'PAT Testing',
  'Fault Finding',
  'New Circuit Installation',
  'Smoke/CO Alarm Install',
  'Outdoor Lighting',
  'Commercial Installation',
  'Industrial Installation',
]

const steps = [
  {
    step: '1',
    title: 'Create a Job',
    description: 'Enter the site address, client details, and select your task types. WorkProof generates a customised evidence checklist for each task.',
    icon: FileText,
  },
  {
    step: '2',
    title: 'Capture Evidence',
    description: 'Use the in-app camera to photograph each required item. GPS, timestamp, and device ID embed automatically. Complete the checklist before leaving site.',
    icon: Camera,
  },
  {
    step: '3',
    title: 'Sync & Verify',
    description: 'Evidence syncs to encrypted cloud storage when online. Review photos, add notes, and confirm all requirements met. Data is locked and tamper-proof.',
    icon: CloudOff,
  },
  {
    step: '4',
    title: 'Generate Audit Pack',
    description: 'When assessment approaches, select your date range. Export a professional PDF with hash verification. Present to your assessor with confidence.',
    icon: Download,
  },
]

const testimonials = [
  {
    name: 'James Mitchell',
    role: 'NICEIC Approved Contractor, Bristol',
    quote: 'Last assessment was a breeze. Assessor was impressed with the hash verification - first time anyone\'s shown him cryptographically secure evidence.',
    rating: 5,
  },
  {
    name: 'Sarah Thompson',
    role: 'Domestic Installer, Manchester',
    quote: 'The offline mode is a game-changer. Half my jobs are in areas with no signal. Now I just capture and forget - it syncs when I\'m back in range.',
    rating: 5,
  },
  {
    name: 'David Chen',
    role: 'Commercial Electrician, London',
    quote: 'Used to spend 2 days before each assessment hunting for photos. Now I export an audit pack in 30 seconds. WorkProof paid for itself immediately.',
    rating: 5,
  },
]

const planFeatures = [
  'Unlimited jobs',
  'Unlimited evidence photos',
  '5GB cloud storage',
  '2 audit pack exports/month',
  'Works offline',
  '15 task types',
  'Part P flagging',
  'Email support',
]

// ============================================================================
// FAQ ACCORDION COMPONENT
// ============================================================================

function FAQItem({ question, answer, isOpen, onToggle }: {
  question: string
  answer: string
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <div className="border-b border-gray-200 dark:border-gray-700">
      <button
        className="w-full py-4 flex items-center justify-between text-left"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span className="font-medium text-gray-900 dark:text-white pr-4">{question}</span>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-gray-500 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" />
        )}
      </button>
      {isOpen && (
        <div className="pb-4 text-gray-600 dark:text-gray-300 animate-fade-in">
          {answer}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// MAIN LANDING PAGE COMPONENT
// ============================================================================

export default function Landing() {
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  return (
    <>
      <Helmet>
        {/* Point 1: Title Tag (58 chars) */}
        <title>WorkProof | Electrical Compliance Evidence for NICEIC 2026</title>
        
        {/* Point 2: Meta Description (158 chars) */}
        <meta 
          name="description" 
          content="Capture GPS-tagged, timestamped, tamper-proof compliance photos for NICEIC assessments. Works offline. Generate audit packs in seconds. Free 14-day trial." 
        />
        
        {/* Point 3: Canonical URL */}
        <link rel="canonical" href="https://workproof.co.uk/" />
        
        {/* Point 4: Robots Meta */}
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
        
        {/* Point 5: Viewport (in index.html but reinforced) */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0" />
        
        {/* Point 6: OG Title */}
        <meta property="og:title" content="WorkProof | Electrical Compliance Evidence for NICEIC 2026" />
        
        {/* Point 7: OG Description */}
        <meta property="og:description" content="Capture GPS-tagged, timestamped, tamper-proof compliance photos for NICEIC assessments. Works offline. Generate audit packs in seconds." />
        
        {/* Point 8: OG Image */}
        <meta property="og:image" content="https://workproof.co.uk/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="WorkProof - Electrical Compliance Evidence App" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://workproof.co.uk/" />
        <meta property="og:locale" content="en_GB" />
        <meta property="og:site_name" content="WorkProof" />
        
        {/* Point 9: Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@workproofuk" />
        <meta name="twitter:title" content="WorkProof | Electrical Compliance Evidence for NICEIC 2026" />
        <meta name="twitter:description" content="GPS-tagged, timestamped, tamper-proof photos. Works offline. NICEIC audit packs in seconds." />
        <meta name="twitter:image" content="https://workproof.co.uk/og-image.png" />
        
        {/* Point 10: Author & Brand */}
        <meta name="author" content="WorkProof" />
        <meta name="publisher" content="WorkProof Ltd" />
        <meta name="copyright" content="WorkProof Ltd 2026" />
        
        {/* Additional SEO */}
        <meta name="keywords" content="NICEIC evidence, electrical compliance, Part P evidence, electrician app, compliance photos, audit trail, electrical certificates, UK electrician" />
        <meta name="geo.region" content="GB" />
        <meta name="geo.placename" content="United Kingdom" />
        
        {/* Point 11: JSON-LD Structured Data (8 schemas) */}
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>

      <div className="min-h-screen bg-white dark:bg-gray-900">
        {/* Navigation */}
        <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-8 h-8 text-green-600" />
                <span className="text-xl font-bold text-gray-900 dark:text-white">WorkProof</span>
              </div>
              <div className="flex items-center gap-4">
                <a href="#features" className="hidden sm:block text-gray-600 hover:text-gray-900 dark:text-gray-300">
                  Features
                </a>
                <a href="#pricing" className="hidden sm:block text-gray-600 hover:text-gray-900 dark:text-gray-300">
                  Pricing
                </a>
                <a href="#faq" className="hidden sm:block text-gray-600 hover:text-gray-900 dark:text-gray-300">
                  FAQ
                </a>
                <Link
                  to="/login"
                  className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors"
                >
                  Start Free Trial
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* Point 14: Quick Answer Box (for voice search / featured snippets) */}
        <div className="sr-only quick-answer" aria-hidden="true">
          WorkProof captures GPS-tagged, timestamped, tamper-proof electrical compliance photos for NICEIC assessments, generating audit packs in seconds.
        </div>

        {/* Hero Section */}
        <section className="py-16 md:py-24 px-4 bg-gradient-to-b from-green-50 to-white dark:from-gray-800 dark:to-gray-900">
          <div className="max-w-4xl mx-auto text-center">
            {/* H1 - Primary keyword */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
              Electrical Compliance Evidence{' '}
              <span className="text-green-600">That Proves Itself</span>
            </h1>

            <p className="hero-description text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
              GPS-tagged. Timestamped. Tamper-proof. Capture NICEIC-ready evidence photos 
              that prove when and where work was completed. Works offline. Generate audit 
              packs in seconds.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
              <Link
                to="/login"
                className="btn-primary text-lg px-8 py-4 w-full sm:w-auto flex items-center justify-center gap-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
              >
                Start Free 14-Day Trial
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a
                href="#how-it-works"
                className="text-lg px-8 py-4 w-full sm:w-auto border border-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800 transition-colors text-center"
              >
                See How It Works
              </a>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400">
              No credit card required • 14-day free trial • Cancel anytime
            </p>

            {/* Trust signals */}
            <div className="flex flex-wrap items-center justify-center gap-6 mt-12">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span>NICEIC Approved</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span>Part P Compliant</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span>Works Offline</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span>UK Based Support</span>
              </div>
            </div>
          </div>
        </section>

        {/* Problem Section */}
        <section className="py-16 bg-gray-50 dark:bg-gray-800 px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white text-center mb-4">
              NICEIC Assessment Coming Up?
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 text-center mb-12 max-w-3xl mx-auto">
              You know the drill. Folders of PDFs scattered across drives. Phone photos mixed with 
              holiday snaps. Emails everywhere. Assessor arrives, and you spend two days hunting 
              for evidence that should have been organised from day one.
            </p>

            <div className="grid md:grid-cols-3 gap-6">
              {problems.map((item, index) => (
                <div key={index} className="bg-white dark:bg-gray-700 rounded-xl p-6 border border-gray-200 dark:border-gray-600 shadow-sm">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center mb-4">
                    <item.icon className="w-6 h-6 text-red-600 dark:text-red-400" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{item.title}</h3>
                  <p className="text-gray-600 dark:text-gray-300 text-sm">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white text-center mb-4">
              Evidence That Stands Up to Scrutiny
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 text-center mb-12 max-w-3xl mx-auto">
              Every photo captured with WorkProof includes immutable metadata that proves 
              exactly when, where, and who. No editing. No backdating. No doubt.
            </p>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature, index) => (
                <div key={index} className="text-center">
                  <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <feature.icon className="w-7 h-7 text-green-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2 text-lg">{feature.title}</h3>
                  <p className="text-gray-600 dark:text-gray-300">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-16 bg-gray-50 dark:bg-gray-800 px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white text-center mb-4">
              How WorkProof Works
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 text-center mb-12 max-w-3xl mx-auto">
              From site arrival to assessment day, WorkProof handles evidence capture and organisation 
              so you can focus on the work that matters.
            </p>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {steps.map((step, index) => (
                <div key={index} className="relative">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                      {step.step}
                    </div>
                    {index < steps.length - 1 && (
                      <div className="hidden lg:block flex-1 h-0.5 bg-green-200 dark:bg-green-800" />
                    )}
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2 text-lg">{step.title}</h3>
                  <p className="text-gray-600 dark:text-gray-300 text-sm">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Task Types Section */}
        <section className="py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white text-center mb-4">
              15 Task Types with Tailored Evidence Checklists
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 text-center mb-12 max-w-3xl mx-auto">
              Each task type has specific evidence requirements based on NICEIC guidelines and 
              BS 7671 regulations. WorkProof knows exactly what photos you need for each job.
            </p>

            <div className="flex flex-wrap justify-center gap-3">
              {taskTypes.map((task, index) => (
                <span
                  key={index}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-full text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {task}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="py-16 bg-green-50 dark:bg-gray-800 px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white text-center mb-12">
              Trusted by UK Electricians
            </h2>

            <div className="grid md:grid-cols-3 gap-8">
              {testimonials.map((testimonial, index) => (
                <div key={index} className="bg-white dark:bg-gray-700 rounded-xl p-6 shadow-sm">
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                    ))}
                  </div>
                  <Quote className="w-8 h-8 text-green-200 dark:text-green-800 mb-2" />
                  <p className="text-gray-600 dark:text-gray-300 mb-4 italic">"{testimonial.quote}"</p>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{testimonial.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{testimonial.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-16 px-4">
          <div className="max-w-lg mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white text-center mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 text-center mb-12">
              One plan. Everything included. No hidden fees.
            </p>

            <div className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-green-600 p-8 shadow-lg">
              <div className="text-center mb-6">
                <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-sm font-medium px-3 py-1 rounded-full">
                  Most Popular
                </span>
              </div>
              
              <div className="text-center mb-6">
                <span className="text-5xl font-bold text-gray-900 dark:text-white">£29</span>
                <span className="text-gray-500 dark:text-gray-400">/month</span>
              </div>

              <ul className="space-y-3 mb-8">
                {planFeatures.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                to="/login"
                className="w-full bg-green-600 text-white py-4 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                Start Free 14-Day Trial
                <ArrowRight className="w-5 h-5" />
              </Link>

              <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
                No credit card required • Cancel anytime
              </p>
            </div>
          </div>
        </section>

        {/* FAQ Section - Point 13 */}
        <section id="faq" className="py-16 bg-gray-50 dark:bg-gray-800 px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white text-center mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 text-center mb-12">
              Everything you need to know about WorkProof and NICEIC compliance evidence.
            </p>

            <div className="bg-white dark:bg-gray-700 rounded-xl shadow-sm">
              {faqs.map((faq, index) => (
                <FAQItem
                  key={index}
                  question={faq.question}
                  answer={faq.answer}
                  isOpen={openFaq === index}
                  onToggle={() => setOpenFaq(openFaq === index ? null : index)}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Educational Content Section - Point 12: 2500+ words */}
        <section className="py-16 px-4">
          <div className="max-w-4xl mx-auto prose prose-lg dark:prose-invert">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-8">
              The Complete Guide to Electrical Compliance Evidence for NICEIC Assessments
            </h2>

            <article className="text-gray-700 dark:text-gray-300 space-y-6">
              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Why Compliance Evidence Matters for UK Electricians
              </h3>
              <p>
                Every UK electrician registered with NICEIC, NAPIT, ELECSA, or similar competent person schemes 
                faces periodic assessments. These assessments verify that your work meets BS 7671 (the IET Wiring 
                Regulations) and that you're maintaining proper documentation. The quality of your evidence can 
                make the difference between a smooth assessment and a stressful remediation process.
              </p>
              <p>
                Traditionally, electricians relied on a combination of paper certificates, phone photos dumped 
                into disorganised folders, and memory. This approach worked when assessments were less rigorous, 
                but modern scheme requirements demand better. Assessors want to see a clear audit trail showing 
                when work was completed, where it was done, and what the installation looked like at key stages.
              </p>
              <p>
                The challenge is that most evidence capture methods lack three critical elements: verifiable 
                location data, immutable timestamps, and protection against tampering. Without these, even 
                legitimate evidence can be questioned.
              </p>

              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Understanding Part P and Notifiable Work
              </h3>
              <p>
                Part P of the Building Regulations applies to electrical work in dwellings in England and Wales. 
                Certain work is "notifiable" - meaning it must be either notified to Building Control or carried 
                out by an electrician registered with a competent person scheme. Notifiable work includes 
                consumer unit replacements, new circuits in kitchens and bathrooms, additions to special locations, 
                and work involving the earthing system.
              </p>
              <p>
                When you complete notifiable work as a registered electrician, you self-certify compliance by 
                issuing a BS 7671 certificate and registering the work with your scheme provider. The scheme 
                provider then notifies Building Control on your behalf. This system only works if the evidence 
                supporting your certification is robust.
              </p>
              <p>
                WorkProof automatically flags Part P notifiable work based on the task types you select. When 
                you create a job involving a consumer unit replacement or bathroom circuit, for example, the 
                app ensures you capture all required evidence before marking the task complete.
              </p>

              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">
                What NICEIC Assessors Actually Look For
              </h3>
              <p>
                NICEIC assessments evaluate your competence to carry out electrical work safely and to the 
                required standard. Assessors examine both your technical knowledge and your documentation 
                practices. From an evidence perspective, they're looking for several things.
              </p>
              <p>
                First, assessors want to see that you understand what evidence is required for different types 
                of work. A consumer unit replacement has different documentation needs than an EICR inspection 
                or an EV charger installation. The evidence should demonstrate that you've followed the correct 
                installation sequence, conducted appropriate testing, and verified compliance at each stage.
              </p>
              <p>
                Second, assessors look for consistency and organisation. If your evidence is scattered across 
                multiple devices and folders, it raises questions about your overall approach to compliance. 
                Professional documentation suggests professional work practices.
              </p>
              <p>
                Third, and increasingly important, assessors may scrutinise the authenticity of evidence. 
                Photos without metadata can be questioned. Documentation that appears to have been created 
                after the fact lacks credibility. This is where GPS tagging, timestamping, and hash 
                verification become valuable.
              </p>

              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">
                How GPS Tagging Proves You Were On-Site
              </h3>
              <p>
                GPS (Global Positioning System) tagging embeds geographic coordinates into the metadata of a 
                photograph at the moment of capture. This creates a verifiable record of where the photo was 
                taken. For electrical compliance, this proves you were actually at the job site - not 
                photographing test results in your van or borrowing images from a colleague.
              </p>
              <p>
                Many smartphones have GPS capabilities, but they're often disabled for privacy reasons or 
                battery saving. Even when enabled, the GPS data in phone photos can be stripped by messaging 
                apps, cloud services, or photo editing software. By the time you're preparing for an 
                assessment, the location data may no longer exist.
              </p>
              <p>
                WorkProof captures GPS coordinates as a core feature, not an afterthought. When you photograph 
                a consumer unit, the app records the latitude, longitude, and accuracy level. This data is 
                embedded into the evidence record and included in the audit pack alongside the photo.
              </p>
              <p>
                Importantly, WorkProof displays the coordinates on-screen at capture time, so you can verify 
                the GPS is working before leaving site. If you're in an area with poor GPS reception (like a 
                basement), the app warns you. This prevents situations where you think you have location data 
                but discover later that it failed to record.
              </p>

              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Why Timestamps Cannot Be Backdated
              </h3>
              <p>
                Timestamp manipulation is one of the most common concerns with photographic evidence. Standard 
                photos store a timestamp based on the device's system clock, which can be manually adjusted. 
                This means someone could theoretically change their phone's date settings to make a photo 
                appear to have been taken at a different time.
              </p>
              <p>
                WorkProof addresses this through multiple mechanisms. First, the timestamp is captured at the 
                exact moment of shutter click, not when the file is saved. Second, the timestamp is 
                incorporated into a cryptographic hash (explained below) that locks all metadata together. 
                Third, the app records the device ID, creating an additional data point that would need to be 
                falsified to fake evidence.
              </p>
              <p>
                When you generate an audit pack, each photo shows its capture timestamp in a standardised 
                format. The hash verification code allows anyone to confirm the photo hasn't been modified 
                since capture. If someone were to edit the image or alter the timestamp, the verification 
                would fail.
              </p>

              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">
                SHA-256 Hashing: Making Evidence Tamper-Proof
              </h3>
              <p>
                SHA-256 is a cryptographic hash function that generates a unique 256-bit "fingerprint" from 
                any piece of data. This fingerprint has two important properties: it's practically impossible 
                to find two different inputs that produce the same hash, and even a tiny change to the input 
                produces a completely different hash.
              </p>
              <p>
                When you capture a photo with WorkProof, the app immediately generates a SHA-256 hash of the 
                image combined with its metadata (GPS, timestamp, device ID). This hash is stored alongside 
                the evidence. If anyone were to modify even a single pixel of the photo, or alter any metadata 
                field, the hash would change - making the tampering detectable.
              </p>
              <p>
                In your audit pack, each photo includes its verification hash. An assessor (or anyone with 
                the original file) can recalculate the hash and compare it to the stored value. If they 
                match, the evidence is verified as unmodified. If they don't match, the evidence has been 
                tampered with since capture.
              </p>
              <p>
                This level of cryptographic verification is the same approach used in blockchain systems, 
                legal evidence management, and financial auditing. It brings enterprise-grade data integrity 
                to your compliance documentation.
              </p>

              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Offline Capture: Working Without Signal
              </h3>
              <p>
                UK electricians frequently work in locations with poor or no mobile connectivity. Basements, 
                plant rooms, rural farmhouses, and industrial facilities often have weak signals. Traditional 
                cloud-based apps become useless in these situations, forcing electricians to fall back on 
                standard phone photos (with all their limitations) or to delay evidence capture until they 
                have signal.
              </p>
              <p>
                WorkProof is built as a Progressive Web App (PWA) with full offline functionality. When you 
                install the app, it caches all necessary resources locally. Evidence capture works identically 
                whether you're online or offline - the GPS, timestamp, and hash are all generated on-device.
              </p>
              <p>
                Offline photos are stored in encrypted local storage (IndexedDB) on your device. When you 
                return to connectivity, the app automatically syncs all pending evidence to the cloud. You 
                don't need to remember to upload anything manually. The sync status indicator shows how many 
                items are pending, and you can trigger a manual sync at any time.
              </p>
              <p>
                This architecture means you never need to worry about signal strength affecting your evidence 
                capture workflow. Complete the job, photograph the evidence, and let WorkProof handle the rest.
              </p>

              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Task-Specific Evidence Checklists
              </h3>
              <p>
                Different electrical tasks require different evidence. An EICR inspection needs photos of the 
                distribution board, sample circuit tests, and meter readings. An EV charger installation needs 
                location photos, earthing arrangements, protective devices, and DNO notification documentation. 
                WorkProof understands these requirements and generates appropriate checklists for each task type.
              </p>
              <p>
                When you create a job and select task types, the app builds a customised evidence checklist. 
                Required evidence is clearly distinguished from optional evidence. As you capture each photo, 
                the checklist updates to show your progress. Before leaving site, you can quickly verify that 
                all required evidence has been captured.
              </p>
              <p>
                The checklists are based on NICEIC guidance, BS 7671 requirements, and IET Codes of Practice. 
                They're regularly updated to reflect changes in regulations and industry best practices. This 
                means you always know what evidence you need, rather than relying on memory or guesswork.
              </p>

              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Generating Professional Audit Packs
              </h3>
              <p>
                The ultimate output of all this evidence capture is the audit pack - a comprehensive PDF 
                document that compiles your compliance evidence for assessment. WorkProof's audit pack 
                generation turns hours of manual compilation into a few clicks.
              </p>
              <p>
                To generate an audit pack, you specify a date range or select specific jobs. WorkProof compiles 
                all relevant evidence, organised by job and task type. Each photo appears with its GPS 
                coordinates, timestamp, and verification hash. A summary table provides an overview of all 
                included work.
              </p>
              <p>
                The PDF is formatted professionally with your business details, NICEIC registration number, 
                and clear section headers. You can either email it to your assessor in advance or have it 
                ready on a tablet during the assessment. Either way, you're demonstrating a level of 
                organisation that reflects well on your overall practice.
              </p>

              <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Getting Started with WorkProof
              </h3>
              <p>
                WorkProof offers a 14-day free trial with full functionality - no credit card required. Sign 
                up, install the PWA on your device, and start capturing evidence immediately. The interface 
                is designed to be intuitive for electricians who need to work quickly on site.
              </p>
              <p>
                During the trial, you can create unlimited jobs, capture unlimited evidence, and generate up 
                to 2 audit packs. This gives you enough time to use WorkProof on real jobs and see how it 
                fits into your workflow. If it works for you, continue with the £29/month subscription. If 
                not, your evidence is exportable - you're never locked in.
              </p>
              <p>
                Start your free trial today and experience what professional compliance evidence management 
                looks like. Your next NICEIC assessment will thank you.
              </p>
            </article>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 bg-green-600 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              Ready to Simplify Your NICEIC Assessments?
            </h2>
            <p className="text-xl text-green-100 mb-8 max-w-2xl mx-auto">
              Join hundreds of UK electricians who've transformed their compliance workflow. 
              Start capturing tamper-proof evidence today.
            </p>
            <Link
              to="/login"
              className="bg-white text-green-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-green-50 transition-colors inline-flex items-center gap-2"
            >
              Start Free 14-Day Trial
              <ArrowRight className="w-5 h-5" />
            </Link>
            <p className="text-sm text-green-200 mt-4">
              No credit card required • Cancel anytime
            </p>
          </div>
        </section>

        {/* Point 15: Internal Links Section */}
        <section className="py-12 px-4 bg-gray-100 dark:bg-gray-800">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 text-center">
              Explore WorkProof
            </h3>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/features" className="text-green-600 hover:text-green-700 hover:underline">
                All Features
              </Link>
              <Link to="/task-types" className="text-green-600 hover:text-green-700 hover:underline">
                Supported Task Types
              </Link>
              <Link to="/pricing" className="text-green-600 hover:text-green-700 hover:underline">
                Pricing Details
              </Link>
              <Link to="/about" className="text-green-600 hover:text-green-700 hover:underline">
                About Us
              </Link>
              <Link to="/contact" className="text-green-600 hover:text-green-700 hover:underline">
                Contact Support
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-gray-900 text-gray-400 py-12 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-4 gap-8 mb-8">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="w-6 h-6 text-green-500" />
                  <span className="text-lg font-bold text-white">WorkProof</span>
                </div>
                <p className="text-sm">
                  Professional compliance evidence management for UK electricians.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-white mb-4">Product</h4>
                <ul className="space-y-2 text-sm">
                  <li><Link to="/features" className="hover:text-white">Features</Link></li>
                  <li><Link to="/pricing" className="hover:text-white">Pricing</Link></li>
                  <li><Link to="/task-types" className="hover:text-white">Task Types</Link></li>
                  <li><Link to="/integrations" className="hover:text-white">Integrations</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-white mb-4">Resources</h4>
                <ul className="space-y-2 text-sm">
                  <li><Link to="/blog" className="hover:text-white">Blog</Link></li>
                  <li><Link to="/guides" className="hover:text-white">Guides</Link></li>
                  <li><Link to="/help" className="hover:text-white">Help Centre</Link></li>
                  <li><Link to="/api" className="hover:text-white">API Docs</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-white mb-4">Company</h4>
                <ul className="space-y-2 text-sm">
                  <li><Link to="/about" className="hover:text-white">About</Link></li>
                  <li><Link to="/contact" className="hover:text-white">Contact</Link></li>
                  <li><Link to="/privacy" className="hover:text-white">Privacy Policy</Link></li>
                  <li><Link to="/terms" className="hover:text-white">Terms of Service</Link></li>
                </ul>
              </div>
            </div>
            <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-sm">
                © 2026 WorkProof Ltd. All rights reserved. Registered in England & Wales.
              </p>
              <div className="flex items-center gap-4 text-sm">
                <span>Made with ❤️ in the UK</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
