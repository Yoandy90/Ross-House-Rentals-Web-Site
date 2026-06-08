import Navbar from './components/Navbar'
import Hero from './sections/Hero'
import Properties from './sections/Properties'
import Services from './sections/Services'
import MarketData from './sections/MarketData'
import WhyUs from './sections/WhyUs'
import Apply from './sections/Apply'
import Contact from './sections/Contact'
import Footer from './sections/Footer'

export default function Home() {
  return (
    <main className="min-h-screen">
      <Navbar />
      <Hero />
      <Properties />
      <Services />
      <WhyUs />
      <MarketData />
      <Apply />
      <Contact />
      <Footer />
    </main>
  )
}
