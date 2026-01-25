/**
 * WorkProof Landing Page
 * Public marketing page with full SEO optimization
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
} from 'lucide-react'

const problems = [
  {
    icon: Camera,
    title: 'Photos Everywhere',
    description:
      'Camera roll mixed with family photos, holiday snaps, and that dodgy consumer unit from 6 months ago.',
  },
  {
    icon: Clock,
    title: 'No Timestamps',
    description:
      'When was that photo taken? Which job was it? Good luck proving it to the assessor.',
  },
  {
    icon: MapPin,
    title: 'No Location Data',
    description:
      'That photo could be from anywhere. No GPS proof means no credibility.',
  },
]

const features = [
  {
    icon: MapPin,
    title: 'GPS-Tagged',
    description:
      'Every photo includes precise GPS coordinates. Prove you were on-site, not in the van.',
  },
  {
    icon: Clock,
    title: 'Timestamped',
    description:
      'Device timestamp captured at the moment of shutter click. Cannot be backdated.',
  },
  {
    icon: Lock,
    title: 'Tamper-Proof Hash',
    description:
      'SHA-256 cryptographic hash locks in the evidence. Any modification is detected.',
  },
  {
    icon: CloudOff,
    title: 'Works Offline',
    description:
      'No signal in that basement? No problem. Capture now, sync later.',
  },
  {
    icon: FileCheck,
    title: 'Audit Pack Generation',
    description:
      'Filter by date, site, or task. Export NICEIC-ready PDF with hash verification.',
  },
  {
    icon: Smartphone,
    title: 'Any Device',
    description:
      'Works on iPhone, Android, tablet, or desktop. No app store download required.',
  },
]

const steps = [
  {
    step: '1',
    title: 'Create a Job',
    description: 'Enter the address, client name, and select your task types.',
  },
  {
    step: '2',
    title: 'Capture Evidence',
    description:
      'Follow the checklist. Each photo is GPS-tagged, timestamped, and hashed automatically.',
  },
  {
    step: '3',
    title: 'Generate Audit Pack',
    description:
      'Filter by date range, export PDF with hash verification. Assessment ready.',
  },
]

const taskTypes = [
  'Consumer Unit Replacement',
  'EICR Inspection',
  'EV Charger Install',
  'Solar PV Install',
  'Full Rewire',
  'Emergency Lighting',
  'Fire Alarm Test',
  'PAT Testing',
  'Fault Finding',
  'New Circuit',
]

const planFeatures = [
  'Unlimited jobs',
  'Unlimited evidence photos',
  '5GB cloud storage',
  '2 audit packs per month',
  'Works offline',
  'Email support',
]

export default function Landing() {
  return (
    <>
      <Helmet>
        <title>WorkProof | Electrical Compliance Evidence for NICEIC Assessments</title>
        <meta
          name="description"
          content="Capture, organise, and export compliance evidence for NICEIC assessments. GPS-tagged, timestamped, tamper-proof photos for UK electricians. Start free trial."
        />
        <link rel="canonical" href="https://workproof.co.uk/" />
      </Helmet>

      <div className="min-h-screen bg-white">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <span className="font-bold text-xl text-gray-900">WorkProof</span>
            </div>
            <nav className="flex items-center gap-4">
              <Link
                to="/login"
                className="text-gray-600 hover:text-gray-900 font-medium text-sm"
              >
                Sign in
              </Link>
              <Link to="/login" className="btn-primary text-sm">
                Start Free Trial
              </Link>
            </nav>
          </div>
        </header>

        {/* Hero Section */}
        <section className="py-16 md:py-24 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Zap className="w-4 h-4" />
              <span>Built for NICEIC Approved Contractors</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              Your certificates say what you tested.{' '}
              <span className="text-green-600">WorkProof proves you did the work.</span>
            </h1>

            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Capture GPS-tagged, timestamped, tamper-proof evidence photos. Generate
              NICEIC-ready audit packs in seconds. Works offline on any device.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/login"
                className="btn-primary text-lg px-8 py-4 w-full sm:w-auto flex items-center justify-center gap-2"
              >
                Start Free Trial
                <ArrowRight className="w-5 h-5" />
              </Link>
              
                href="#features"
                className="btn-secondary text-lg px-8 py-4 w-full sm:w-auto"
              >
                See How It Works
              </a>
            </div>

            <p className="text-sm text-gray-500 mt-4">
              No credit card required • 14-day free trial • Cancel anytime
            </p>
          </div>
        </section>

        {/* Problem Section */}
        <section className="py-16 bg-gray-50 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-4">
              NICEIC Assessment Coming Up?
            </h2>
            <p className="text-xl text-gray-600 text-center mb-12 max-w-2xl mx-auto">
              You know the drill. Folders of PDFs, phone photos scattered across albums,
              emails everywhere. Assessor arrives, you spend 2 days hunting for evidence.
            </p>

            <div className="grid md:grid-cols-3 gap-6">
              {problems.map((item, index) => (
                <div key={index} className="bg-white rounded-xl p-6 border border-gray-200">
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                    <item.icon className="w-6 h-6 text-red-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
                  <p className="text-gray-600 text-sm">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-4">
              Evidence That Stands Up to Scrutiny
            </h2>
            <p className="text-xl text-gray-600 text-center mb-12 max-w-2xl mx-auto">
              Every photo captured with WorkProof includes immutable metadata that proves
              when, where, and who.
            </p>

            <div className="grid md:grid-cols-2 gap-8">
              {features.map((feature, index) => (
                <div key={index} className="flex gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <feature.icon className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">{feature.title}</h3>
                    <p className="text-gray-600 text-sm">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-16 bg-gray-50 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
              How It Works
            </h2>

            <div className="grid md:grid-cols-3 gap-8">
              {steps.map((item, index) => (
                <div key={index} className="text-center">
                  <div className="w-12 h-12 bg-green-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                    {item.step}
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
                  <p className="text-gray-600 text-sm">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Task Types */}
        <section className="py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-4">
              Built for Electrical Work
            </h2>
            <p className="text-xl text-gray-600 text-center mb-12">
              Pre-configured evidence checklists for every task type
            </p>

            <div className="flex flex-wrap justify-center gap-3">
              {taskTypes.map((task) => (
                <span
                  key={task}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm font-medium"
                >
                  {task}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="py-16 bg-gray-50 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
              Simple Pricing
            </h2>

            <div className="max-w-sm mx-auto bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="bg-green-600 text-white px-6 py-4">
                <h3 className="font-bold text-xl">Solo Electrician</h3>
                <p className="text-green-100 text-sm">Everything you need</p>
              </div>
              <div className="px-6 py-8">
                <div className="flex items-baseline gap-2 mb-6">
                  <span className="text-4xl font-bold text-gray-900">£29</span>
                  <span className="text-gray-500">/month</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {planFeatures.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-gray-600">
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/login"
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  Start Free Trial
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <p className="text-center text-xs text-gray-500 mt-3">
                  14 days free, then £29/month
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Ready for Your Next NICEIC Assessment?
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              Start capturing evidence today. Be ready in minutes, not days.
            </p>
            <Link
              to="/login"
              className="btn-primary text-lg px-8 py-4 inline-flex items-center gap-2"
            >
              Start Free Trial
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-gray-900 text-white py-12 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <span className="font-bold text-xl">WorkProof</span>
              </div>
              <nav className="flex items-center gap-6 text-sm text-gray-400">
                <a href="/privacy" className="hover:text-white">Privacy</a>
                <a href="/terms" className="hover:text-white">Terms</a>
                <a href="mailto:hello@workproof.co.uk" className="hover:text-white">Contact</a>
              </nav>
            </div>
            <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-500">
              © {new Date().getFullYear()} WorkProof. All rights reserved.
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
