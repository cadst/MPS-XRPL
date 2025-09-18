import Hero from "./components/Hero";
import HeroVideo from "./components/sections/HeroVideo";

export default function HomePage() {
  return (
    <>

      <HeroVideo />
      <section className="relative z-10">
      <Hero/>
      </section>
    </>
  );
}
