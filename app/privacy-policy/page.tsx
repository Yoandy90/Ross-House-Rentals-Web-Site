'use client';

import { ArrowLeft, Shield, Lock, Eye, Database, Bell, UserCheck, Mail, Phone, MapPin } from 'lucide-react';
import Link from 'next/link';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#070B14] text-white">
      <header className="border-b border-white/10 bg-[#0a1020]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-white/5 rounded-lg transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Privacy Policy</h1>
              <p className="text-xs text-gray-500">Ross House Rentals LLC</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="text-gray-400 mb-8"><strong>Last Updated:</strong> June 8, 2026</p>

        <section className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <Lock className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold">1. Information We Collect</h2>
          </div>
          <div className="pl-9 space-y-4 text-gray-300">
            <p>Ross House Rentals LLC collects information to provide property management services:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Personal Information:</strong> Name, email, phone, address, SSN (for background checks)</li>
              <li><strong>Financial Information:</strong> Bank details for rent payments, payment history</li>
              <li><strong>Utility Data:</strong> With consent, we access utility usage via Green Button Connect</li>
              <li><strong>Property Information:</strong> Rental history, maintenance requests, lease documents</li>
            </ul>
          </div>
        </section>

        <section className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <Eye className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold">2. How We Use Your Information</h2>
          </div>
          <div className="pl-9 space-y-4 text-gray-300">
            <ul className="list-disc pl-5 space-y-2">
              <li>Process rental applications and background checks</li>
              <li>Manage lease agreements and property maintenance</li>
              <li>Process rent payments</li>
              <li>Provide utility usage insights and cost management</li>
              <li>Comply with legal obligations</li>
            </ul>
          </div>
        </section>

        <section className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <Database className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold">3. Data Sharing</h2>
          </div>
          <div className="pl-9 space-y-4 text-gray-300">
            <p>We may share information with service providers, property owners, and legal authorities when required. We do not sell personal information.</p>
          </div>
        </section>

        <section className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold">4. Green Button Connect Data</h2>
          </div>
          <div className="pl-9 space-y-4 text-gray-300">
            <ul className="list-disc pl-5 space-y-2">
              <li>We only access data you explicitly authorize</li>
              <li>Data is used solely for energy usage insights</li>
              <li>You can revoke access at any time</li>
              <li>We do not share utility data without consent</li>
            </ul>
          </div>
        </section>

        <section className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <UserCheck className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold">5. Your Rights</h2>
          </div>
          <div className="pl-9 space-y-4 text-gray-300">
            <p>You have the right to access, correct, delete your data, opt-out of communications, and revoke third-party authorizations.</p>
          </div>
        </section>

        <section className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <Lock className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold">6. Data Security</h2>
          </div>
          <div className="pl-9 space-y-4 text-gray-300">
            <p>We implement SSL/TLS encryption, encrypted storage, and access controls.</p>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-bold mb-4">7. Contact Us</h2>
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-gray-300">
                <Mail className="w-5 h-5 text-emerald-400" />
                <a href="mailto:privacy@rosshouserentals.com" className="hover:text-emerald-400">privacy@rosshouserentals.com</a>
              </div>
              <div className="flex items-center gap-3 text-gray-300">
                <Phone className="w-5 h-5 text-emerald-400" />
                <a href="tel:+18069342018" className="hover:text-emerald-400">(806) 934-2018</a>
              </div>
              <div className="flex items-center gap-3 text-gray-300">
                <MapPin className="w-5 h-5 text-emerald-400" />
                <span>305 Bruce Ave, Dumas, TX 79029</span>
              </div>
            </div>
          </div>
        </section>

        <p className="text-sm text-gray-500 border-t border-white/10 pt-6">© 2026 Ross House Rentals LLC. All rights reserved.</p>
      </main>
    </div>
  );
}
