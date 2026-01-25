import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Shield, Camera, MapPin, Clock, CheckCircle, ArrowRight } from 'lucide-react'

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      <Helmet>
        <title>WorkProof | Electrical Compliance Evidence</title>
        <meta name="description" content="Capture compliance evidence for NICEIC assessments." />
      </Helmet>

      <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-xl text-gray-900">WorkProof</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link to="/login" className="text-gray-600 hover:text-gray-900 font-medium text-sm">
              Sign in
            </Link>
            <Link to="/login" className="btn-primary text-sm">
              Start Free Trial
            </Link>
          </nav>
        </div>
      </header>

      <section className="py-16 md:py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Your certificates say what you tested.
            <span className="text-green-600"> WorkProof proves you did the work.</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Capture GPS-tagged, timestamped, tamper-proof evidence photos. 
            Generate NICEIC-ready audit packs in seconds.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/login" className="btn-primary text-lg px-8 py-4 w-full sm:w-auto flex items-center justify-center gap-2">
              Start Free Trial
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            No credit card required - 14-day free trial
          </p>
        </div>
      </section>

      <section className="py-16 bg-gray-50 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">Key Features</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <MapPin className="w-8 h-8 text-green-600 mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">GPS-Tagged</h3>
              <p className="text-gray-600 text-sm">Every photo includes precise GPS coordinates.</p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <Clock className="w-8 h-8 text-green-600 mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">Timestamped</h3>
              <p className="text-gray-600 text-sm">Cannot be backdated or modified.</p>
            </div>
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <Camera className="w-8 h-8 text-green-600 mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">Works Offline</h3>
              <p className="text-gray-600 text-sm">Capture now, sync later.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-4">
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
              <li className="flex items-center gap-2 text-sm text-gray-600">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Unlimited jobs
              </li>
              <li className="flex items-center gap-2 text-sm text-gray-600">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Unlimited evidence photos
              </li>
              <li className="flex items-center gap-2 text-sm text-gray-600">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Works offline
              </li>
            </ul>
            <Link to="/login" className="btn-primary w-full flex items-center justify-center gap-2">
              Start Free Trial
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="bg-gray-900 text-white py-12 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-xl">WorkProof</span>
          </div>
          <p className="text-gray-500 text-sm">
            © {new Date().getFullYear()} WorkProof. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
