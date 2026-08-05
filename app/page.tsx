import Navbar from './components/Navbar'
import WaitlistBanner from './components/WaitlistBanner'
import ProvidersBanner from './components/ProvidersBanner'
import Hero from './sections/Hero'
import Properties from './sections/Properties'
import Services from './sections/Services'
import MarketData from './sections/MarketData'
import WhyUs from './sections/WhyUs'
import WaitlistPromo from './sections/WaitlistPromo'
import ProvidersPromo from './sections/ProvidersPromo'
import Apply from './sections/Apply'
import Contact from './sections/Contact'
import Footer from './sections/Footer'
import NewsletterSection from './components/NewsletterSection'

export default function Home() {
  return (
    <main className="min-h-screen">
      <WaitlistBanner />
      <ProvidersBanner />
      <Navbar />
      <Hero />
      <Properties />
      <WaitlistPromo />
      <Services />
      <WhyUs />
      <ProvidersPromo />
      <MarketData />
      <Apply />
      <Contact />
      <NewsletterSection />
      <Footer />
    </main>
  )
}
