// ABOUTME: Landing page for logged-out visitors — manifesto-first, brand-aligned
// ABOUTME: Hero + pillars + mailing list + screenshot tour. No layout gradients.

import { Link } from "react-router-dom";
import { useRef } from "react";
import Autoplay from "embla-carousel-autoplay";

import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { HubSpotSignup } from "@/components/HubSpotSignup";
import { AuthenticDemo } from "@/components/landing/AuthenticDemo";
import { VerifiedDemo } from "@/components/landing/VerifiedDemo";
import { DecentralizedDemo } from "@/components/landing/DecentralizedDemo";

const SCREENSHOTS: Array<{ src: string; alt: string }> = [
  { src: "/screenshots/iPad 13 inch-0.avif", alt: "Divine video feed" },
  { src: "/screenshots/iPad 13 inch-1.avif", alt: "Divine profile view" },
  { src: "/screenshots/iPad 13 inch-2.avif", alt: "Divine hashtags" },
  { src: "/screenshots/iPad 13 inch-3.avif", alt: "Divine discovery" },
  { src: "/screenshots/iPad 13 inch-4.avif", alt: "Divine trending" },
  { src: "/screenshots/iPad 13 inch-5.avif", alt: "Divine lists" },
  { src: "/screenshots/iPad 13 inch-6.avif", alt: "Divine search" },
];

export function LandingPage() {
  const autoplay = useRef(
    Autoplay({ delay: 3200, stopOnInteraction: true })
  );

  return (
    <div className="flex flex-col min-h-screen bg-brand-off-white">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-brand-off-white/95 dark:bg-brand-dark-green/95 backdrop-blur-sm border-b-2 border-brand-dark-green/10">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/" aria-label="Divine home">
              <img src="/divine-logo.svg" alt="Divine" className="h-5" />
            </Link>

            <div className="flex items-center gap-4 md:gap-8">
              <a
                href="https://about.divine.video/"
                className="text-xs md:text-sm font-medium text-foreground hover:text-primary transition-colors"
              >
                About
              </a>
              <a
                href="https://about.divine.video/blog/"
                className="text-xs md:text-sm font-medium text-foreground hover:text-primary transition-colors"
              >
                Blog
              </a>
              <a
                href="https://about.divine.video/faqs/"
                className="text-xs md:text-sm font-medium text-foreground hover:text-primary transition-colors"
              >
                FAQ
              </a>
              <a
                href="https://about.divine.video/news/"
                className="text-xs md:text-sm font-medium text-foreground hover:text-primary transition-colors"
              >
                <span className="md:hidden">News</span>
                <span className="hidden md:inline">In the News</span>
              </a>
              <Button asChild variant="sticker" size="sm">
                <Link to="/discovery">Try it</Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero — dark green on off-white, no gradient */}
      <section className="relative overflow-hidden bg-brand-dark-green text-brand-off-white pt-28 pb-20 md:pt-36 md:pb-28">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl text-center space-y-8">
            {/* Playful sticker badge */}
            <div className="flex justify-center">
              <span
                className="inline-block brand-tilt-neg-3 rounded-full border-2 border-brand-off-white bg-brand-yellow px-4 py-1.5 text-xs font-bold tracking-wide text-brand-dark-green brand-offset-shadow-sm-dark"
              >
                No slop. All human.
              </span>
            </div>

            {/* Manifesto headline */}
            <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-extrabold leading-[0.95] tracking-tight text-brand-off-white">
              Creative power belongs in human hands.
            </h1>

            <p className="mx-auto max-w-2xl text-lg md:text-xl text-brand-off-white/85 leading-relaxed">
              Divine is bringing back the six-second videos that shaped internet
              culture — on a protocol where creators own what they make and you
              choose what you see.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <Button asChild variant="sticker" size="lg" className="text-base">
                <Link to="/discovery">Start joy scrolling</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="text-base bg-transparent border-brand-off-white text-brand-off-white hover:bg-brand-off-white hover:text-brand-dark-green hover:border-brand-off-white"
              >
                <Link to="/faq">Read the manifesto</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Pillars — what Divine stands for */}
      <section className="bg-brand-off-white text-brand-dark-green py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center mb-12 md:mb-16">
            <h2 className="font-display text-4xl md:text-5xl font-extrabold tracking-tight">
              Your playground for human creativity.
            </h2>
            <p className="mt-4 text-base md:text-lg text-brand-dark-green/75">
              Weird, wonderful, technicolor glory — seeing, sharing, and making
              six seconds at a time. Built by a band of thoughtful rascals who
              saw a better way.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-6xl mx-auto">
            <AuthenticDemo />
            <VerifiedDemo />
            <DecentralizedDemo />
          </div>
        </div>
      </section>

      {/* Screenshot tour — solid off-white, no gradient fades */}
      <section className="bg-brand-light-green text-brand-dark-green py-16 md:py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center mb-10">
            <h2 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight">
              Joy scrolling &gt; doom scrolling.
            </h2>
            <p className="mt-3 text-base text-brand-dark-green/75">
              Peek at what's inside. Trade keyboard wars for six-second bursts
              of brilliance.
            </p>
          </div>

          <Link
            to="/discovery"
            className="block max-w-5xl mx-auto rounded-[22px] border-2 border-brand-dark-green bg-brand-off-white p-4 md:p-6 brand-offset-shadow-dark hover:translate-x-[-2px] hover:translate-y-[-2px] transition-transform"
            aria-label="Open Divine"
          >
            <Carousel
              className="w-full"
              opts={{
                align: "center",
                loop: true,
                dragFree: true,
                watchDrag: true,
              }}
              plugins={[autoplay.current]}
              onMouseEnter={autoplay.current.stop}
              onMouseLeave={autoplay.current.reset}
            >
              <CarouselContent className="-ml-2 md:-ml-4">
                {SCREENSHOTS.map(({ src, alt }) => (
                  <CarouselItem
                    key={src}
                    className="pl-2 md:pl-4 basis-4/5 md:basis-3/4"
                  >
                    <div className="p-1">
                      <img
                        src={src}
                        alt={alt}
                        className="w-full h-auto rounded-lg border-2 border-brand-dark-green/15"
                        loading="lazy"
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="left-2" />
              <CarouselNext className="right-2" />
            </Carousel>
          </Link>
        </div>
      </section>

      {/* Mailing list + final CTA */}
      <section className="bg-brand-dark-green text-brand-off-white py-20 md:py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center space-y-8">
            <div className="flex justify-center">
              <img
                src="/divine_icon_transparent.avif"
                alt=""
                aria-hidden="true"
                className="w-20 h-20 md:w-24 md:h-24"
              />
            </div>

            <h2 className="font-display text-3xl md:text-5xl font-extrabold tracking-tight">
              Join the movement to brighten the internet.
            </h2>

            <p className="text-base md:text-lg text-brand-off-white/80">
              The Divine beta is currently full. Drop your email and we'll
              holler when the doors open — no spam, no slop.
            </p>

            <div className="hs-form-landing mx-auto max-w-xl rounded-[22px] border-2 border-brand-off-white/20 bg-brand-off-white p-6 md:p-8 text-brand-dark-green">
              <h3 className="text-base font-semibold text-primary text-center mb-2">
                Divine Inspiration
              </h3>
              <p className="text-sm text-center mb-6 leading-5 text-brand-dark-green/80">
                Be among the first to hear when the Divine app goes live.
              </p>
              <HubSpotSignup />
            </div>

            <div className="pt-2">
              <Button asChild variant="sticker" size="lg" className="text-base">
                <Link to="/discovery">Jump into the web app</Link>
              </Button>
            </div>

            <p className="text-xs text-brand-off-white/60 pt-4">
              Built on Nostr.{" "}
              <a
                href="https://techcrunch.com/2025/11/12/jack-dorsey-funds-divine-a-vine-reboot-that-includes-vines-video-archive/"
                className="underline hover:text-brand-off-white"
                target="_blank"
                rel="noreferrer noopener"
              >
                Read the backstory
              </a>
              .
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
