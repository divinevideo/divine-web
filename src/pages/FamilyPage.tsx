// ABOUTME: Family resource hub for parents, guardians, and teens at /family
// ABOUTME: Conversation-first guidance, honest app limits, and trusted outside resources

import { useEffect, useState } from "react";
import {
  ChatsCircle,
  Pause,
  HandHeart,
  Compass,
  ListChecks,
  Lifebuoy,
  Microphone,
  BookOpenText,
  ArrowSquareOut,
  Path,
  ShieldCheck,
  HouseLine,
  UsersThree,
  Eye,
  Heart,
  Lightbulb,
  Flag,
  ArrowUp,
} from "@phosphor-icons/react";

import { MarketingLayout } from "@/components/MarketingLayout";
import { SectionHeader } from "@/components/brand/SectionHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ZendeskWidget } from "@/components/ZendeskWidget";

interface SectionAnchor {
  id: string;
  title: string;
}

const SECTIONS: SectionAnchor[] = [
  { id: "framing", title: "A simple framing" },
  { id: "talking", title: "Talking with your teen" },
  { id: "limits", title: "What Divine can and can't do" },
  { id: "settings", title: "How content settings work" },
  { id: "habits", title: "Feed habits and stopping points" },
  { id: "plan", title: "Build a family media plan" },
  { id: "upset", title: "If your child saw something upsetting" },
  { id: "stir", title: "Rabble + Pam Wisniewski / STIR" },
  { id: "resources", title: "Outside resources" },
];

interface ResourceLink {
  name: string;
  url: string;
  description: string;
}

interface ResourceGroup {
  heading: string;
  links: ResourceLink[];
}

const RESOURCE_GROUPS: ResourceGroup[] = [
  {
    heading: "Plans you can fill out together",
    links: [
      {
        name: "AAP Family Media Plan",
        url: "https://www.healthychildren.org/English/fmp/Pages/MediaPlan.aspx",
        description:
          "American Academy of Pediatrics tool for building a household plan together, room by room and screen by screen.",
      },
      {
        name: "eSafety Commissioner (Australia) — Family Tech Agreement",
        url: "https://www.esafety.gov.au/parents/resources/family-tech-agreement",
        description:
          "A downloadable family tech-agreement template from Australia's online-safety regulator — same shape as the AAP plan, written to work for any household.",
      },
      {
        name: "WHO — Helping Adolescents Thrive",
        url: "https://www.who.int/publications/i/item/9789240025554",
        description:
          "The World Health Organization's framework for adolescent well-being — strategies for parents, educators, and health workers, written for a global audience.",
      },
    ],
  },
  {
    heading: "Family guidance and conversation tools",
    links: [
      {
        name: "Common Sense Media — Parents' Guide to Social Media",
        url: "https://www.commonsensemedia.org/articles/parents-ultimate-guide-to-social-media",
        description:
          "Plain-language explainers, age-by-age guidance, and reviews of the apps teens actually use.",
      },
      {
        name: "Internet Matters (UK)",
        url: "https://www.internetmatters.org/",
        description:
          "UK-based equivalent of Common Sense Media — app-by-app guides, age-by-age advice, and practical online-safety tools for parents.",
      },
      {
        name: "ConnectSafely Parent Guides",
        url: "https://connectsafely.org/parentguides/",
        description:
          "Short, practical guides to specific apps and online-safety topics, written for non-technical caregivers.",
      },
      {
        name: "Family Online Safety Institute (FOSI)",
        url: "https://fosi.org/",
        description:
          "Research, policy work, and family resources focused on a culture of responsibility in the connected world.",
      },
      {
        name: "Children and Screens",
        url: "https://www.childrenandscreens.org/",
        description:
          "Research-backed resources from the Institute of Digital Media and Child Development on how screens shape child development, with practical guidance for parents and educators.",
      },
      {
        name: "Screen Sanity",
        url: "https://screensanity.org/",
        description:
          "Parent-to-parent guidance — conversation starters, family templates, and decision frameworks for navigating screens at every age.",
      },
    ],
  },
  {
    heading: "Reporting harms or getting help",
    links: [
      {
        name: "INHOPE",
        url: "https://www.inhope.org/",
        description:
          "Global network of reporting hotlines — find the right place to report illegal online content in your country.",
      },
      {
        name: "Child Helpline International",
        url: "https://childhelplineinternational.org/",
        description:
          "Directory of crisis helplines for kids and teens by country — for the moments when your child needs to talk to someone right now.",
      },
      {
        name: "Thorn for Parents",
        url: "https://parents.thorn.org/",
        description:
          "Thorn is a nonprofit that builds technology and research to defend children from online sexual abuse. Their parents' site offers conversation-first guidance on tough topics like sextortion, grooming, and nudes.",
      },
    ],
  },
];

export function FamilyPage() {
  return (
    <MarketingLayout>
      <ZendeskWidget />
      <BackToTopButton />

      {/* Hero */}
      <section className="bg-brand-dark-green text-brand-off-white">
        <div className="container mx-auto px-4 py-16 md:py-24 max-w-5xl">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-brand-green mb-6">
            <HouseLine weight="fill" className="h-4 w-4" />
            <span>For families on Divine</span>
          </div>
          <h1
            className="font-display font-extrabold tracking-tight text-4xl md:text-6xl leading-[1.05] text-brand-off-white mb-6"
            style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}
          >
            Safer social media use starts with conversation.
          </h1>
          <p className="text-lg md:text-xl text-brand-light-green max-w-3xl leading-relaxed">
            Divine can help families reduce some risks and build healthier
            habits around social media use, but no app can replace
            conversation, supervision, and thoughtful boundaries at home.
          </p>
          <p className="text-base md:text-lg text-brand-off-white/80 max-w-3xl leading-relaxed mt-4">
            This page is a starting point for parents, guardians, and teens —
            not a contract, not a control panel. It's the stuff we wish more
            apps said out loud.
          </p>

          {/* Anchor nav */}
          <nav
            aria-label="On this page"
            className="mt-10 grid gap-2 sm:grid-cols-3 text-sm"
          >
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="rounded-xl border border-brand-green/40 bg-brand-dark-green/40 px-4 py-3 text-brand-light-green hover:bg-brand-green/10 hover:border-brand-green transition-colors"
              >
                {s.title}
              </a>
            ))}
          </nav>
        </div>
      </section>

      {/* Pause • Reflect • Redirect framing band */}
      <section id="framing" className="scroll-mt-24 bg-brand-light-green/30 dark:bg-brand-dark-green/40 border-y border-brand-dark-green/10 dark:border-brand-green/20">
        <div className="container mx-auto px-4 py-10 max-w-5xl">
          <p className="text-xs font-semibold tracking-wide text-brand-dark-green dark:text-brand-green mb-4">
            A simple framing
          </p>
          <div className="grid gap-6 md:grid-cols-3">
            <FrameStep
              icon={<Pause weight="fill" className="h-6 w-6" />}
              label="Pause"
              body="Notice what's happening before you react. For teens, that's catching the urge to scroll. For parents, that's catching the urge to confiscate."
            />
            <FrameStep
              icon={<Lightbulb weight="fill" className="h-6 w-6" />}
              label="Reflect"
              body="Ask, don't assume. What did you see? How did it land? Is something here worth paying attention to?"
            />
            <FrameStep
              icon={<Compass weight="fill" className="h-6 w-6" />}
              label="Redirect"
              body="Pick the next step together — a setting to try, a person to mute, a break to take, a thing to do off the app."
            />
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-16 max-w-4xl space-y-16">
        {/* 2. Talking with your teen */}
        <Anchor id="talking">
          <SectionHero
            eyebrow="Conversation over punishment"
            icon={<ChatsCircle weight="fill" className="h-7 w-7" />}
            title="How to talk with your teen about social media"
            lead="The goal isn't to win the conversation. It's to keep having one. Teens who feel heard stay open. Teens who feel surveilled go quiet."
          />

          <div className="grid gap-6 md:grid-cols-2">
            <Card variant="brand" accent="green">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <HandHeart weight="fill" className="h-5 w-5 text-brand-green" />
                  Co-navigate, don't surveil
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-base leading-relaxed">
                <p>
                  Sit next to them on the app sometimes. Ask who they follow.
                  Ask what's funny right now. You'll learn more in five minutes
                  of scrolling together than in a month of monitoring software.
                </p>
                <p className="text-muted-foreground">
                  Surveillance shifts the dynamic. Curiosity keeps it open.
                </p>
              </CardContent>
            </Card>

            <Card variant="brand" accent="violet">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Pause weight="fill" className="h-5 w-5 text-brand-violet" />
                  Respond, don't punish first
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-base leading-relaxed">
                <p>
                  If you find something concerning, lead with a question. "Tell
                  me what was happening when you saw this" gets you more than
                  "you're grounded."
                </p>
                <p className="text-muted-foreground">
                  Big consequences for the first disclosure usually buy you
                  silence on the second one.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6">
            <Card variant="brand" accent="pink">
              <CardHeader>
                <CardTitle className="text-xl">Conversation starters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-base leading-relaxed">
                <ul className="space-y-2 list-disc pl-5 marker:text-brand-pink">
                  <li>What's the funniest thing you've seen on your feed this week?</li>
                  <li>Who are the three creators you actually look forward to?</li>
                  <li>Has anything online ever made you feel weird or stuck with you afterwards?</li>
                  <li>If you saw a friend getting piled on in comments, what would you do?</li>
                  <li>What's something you wish your feed had less of?</li>
                  <li>If we built a "phones-away" hour together, when would it make most sense?</li>
                </ul>
                <p className="text-sm text-muted-foreground pt-2">
                  Use these as warm-up questions, not interrogations. One good
                  question per car ride is plenty.
                </p>
              </CardContent>
            </Card>
          </div>
        </Anchor>

        {/* 3. What Divine can / can't do */}
        <Anchor id="limits">
          <SectionHero
            eyebrow="Honest app limits"
            icon={<ShieldCheck weight="fill" className="h-7 w-7" />}
            title="What Divine can and can't do"
            lead="We'd rather be useful than impressive. Here's the real picture of what the app side can help with — and where conversation, supervision, and human judgment still have to do the work."
          />

          <div className="grid gap-6 md:grid-cols-2">
            <Card variant="brand" accent="green">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <ShieldCheck weight="fill" className="h-5 w-5 text-brand-green" />
                  What Divine offers
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-base leading-relaxed">
                <ul className="space-y-2 list-disc pl-5 marker:text-brand-green">
                  <li>
                    Moderation tools that remove clearly prohibited content
                    from Divine-controlled surfaces.
                  </li>
                  <li>
                    Reporting tools inside the app so anyone can flag content
                    or accounts for review.
                  </li>
                  <li>
                    Content settings that gate adult and sensitive content for
                    accounts that haven't opted in.
                  </li>
                  <li>
                    Blocking, muting, and filtering controls so users can shape
                    their own experience.
                  </li>
                  <li>
                    A support path for families and a published{" "}
                    <a
                      href="/safety"
                      className="text-brand-green underline underline-offset-2 hover:text-brand-dark-green dark:hover:text-brand-light-green"
                    >
                      safety standards
                    </a>{" "}
                    page that documents what we will and won't do.
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card variant="brand" accent="orange">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Eye weight="fill" className="h-5 w-5 text-brand-orange" />
                  What Divine can't promise
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-base leading-relaxed">
                <ul className="space-y-2 list-disc pl-5 marker:text-brand-orange">
                  <li>
                    No app — including Divine — can guarantee a teen will
                    never see adult, upsetting, or harmful content.
                  </li>
                  <li>
                    Automated systems and human review both miss things. We
                    don't claim to catch every violation.
                  </li>
                  <li>
                    Bad language and conflict happen in human communities. We
                    don't promise a filter that removes all of it.
                  </li>
                  <li>
                    Divine is built on an open protocol (Nostr). Content
                    removed from Divine-controlled surfaces can still exist
                    elsewhere on the network.
                  </li>
                  <li>
                    Settings and tools work best as part of a household
                    conversation — not as a substitute for one.
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <p className="mt-6 text-base text-muted-foreground leading-relaxed">
            For the full policy view, see our{" "}
            <a
              href="/safety"
              className="text-brand-dark-green dark:text-brand-green underline underline-offset-2 hover:opacity-80"
            >
              Safety Standards
            </a>
            .
          </p>
        </Anchor>

        {/* 4. How content settings work */}
        <Anchor id="settings">
          <SectionHero
            eyebrow="Practical setup"
            icon={<ListChecks weight="fill" className="h-7 w-7" />}
            title="How content settings work on Divine"
            lead="Settings are a useful layer. They are not a guarantee. The most important step is for the adult in the household to actually open them, read them, and adjust them together with the teen who'll use the account."
          />

          <Card variant="brand" accent="violet">
            <CardContent className="pt-6 space-y-4 text-base leading-relaxed">
              <SettingsRow
                title="Adult content gating"
                body="Adult and sensitive content is hidden by default and gated behind an age-affirmation step. Accounts that don't meet the requirements don't see that content on Divine-controlled surfaces."
              />
              <SettingsRow
                title="Moderation lists and filters"
                body="Users can apply moderation lists, mute words, and filter creators they don't want to see. These can be revisited any time — they're not one-time decisions."
              />
              <SettingsRow
                title="Blocking and muting"
                body="Blocking removes someone from your view on Divine. Muting hides their posts without notifying them. Both are reversible."
              />
              <SettingsRow
                title="Reporting"
                body="The report button is inside the app and on every video and profile. Reports go to a human review queue."
              />
              <div className="pt-2 border-t border-brand-dark-green/15 dark:border-brand-green/20">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">A note on settings:</strong>{" "}
                  even good settings can be turned off, worked around, or simply
                  not catch every edge case. Treat them as one helpful layer of
                  several — alongside conversation, check-ins, and the off
                  switch.
                </p>
              </div>
            </CardContent>
          </Card>
        </Anchor>

        {/* 5. Feed habits */}
        <Anchor id="habits">
          <SectionHero
            eyebrow="Healthier habits, not just restrictions"
            icon={<Path weight="fill" className="h-7 w-7" />}
            title="Feed habits and healthy stopping points"
            lead="Most short-form feeds are designed to keep going. The healthier skill isn't blocking the feed — it's noticing when you've had enough and choosing to stop. That's a skill adults are still learning too."
          />

          <div className="grid gap-6 md:grid-cols-2">
            <Card variant="brand" accent="blue">
              <CardHeader>
                <CardTitle className="text-xl">Practice intentional stopping points</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-base leading-relaxed">
                <p>
                  Pick a natural stop together — end of a video, end of a song,
                  end of a meal. The point isn't a hard timer. It's noticing
                  the moment to put the phone down and meaning it.
                </p>
                <p className="text-muted-foreground">
                  Modeling matters. If adults in the house never stop scrolling,
                  the lesson lands differently.
                </p>
              </CardContent>
            </Card>

            <Card variant="brand" accent="yellow">
              <CardHeader>
                <CardTitle className="text-xl">Build redirect routines</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-base leading-relaxed">
                <p>
                  After a long session, redirect attention on purpose: a walk,
                  music, food, a stretch, a friend, anything offline. The
                  redirect matters as much as the pause.
                </p>
                <p className="text-muted-foreground">
                  This isn't about declaring social media bad. It's about
                  making sure it's not the only thing on the menu.
                </p>
              </CardContent>
            </Card>
          </div>

          <Card variant="brand" accent="dark" className="mt-6 bg-brand-dark-green/95 text-brand-off-white">
            <CardContent className="pt-6 text-base leading-relaxed">
              <p className="text-brand-light-green text-sm font-semibold mb-2">
                Talking points for the next car ride
              </p>
              <ul className="space-y-2 list-disc pl-5 marker:text-brand-green">
                <li>What does "enough scrolling for now" feel like in your body?</li>
                <li>What's the first thing you'd rather do when you put the phone down?</li>
                <li>Is there a creator or topic that always leaves you feeling worse? What would it take to mute it?</li>
              </ul>
            </CardContent>
          </Card>
        </Anchor>

        {/* 6. Family media plan */}
        <Anchor id="plan">
          <SectionHero
            eyebrow="Make it together"
            icon={<UsersThree weight="fill" className="h-7 w-7" />}
            title="Build a family media plan"
            lead="A plan that everyone helped write is a plan that everyone is more likely to follow. Plans are also living documents — expect to revisit them every few months as kids get older and apps change."
          />

          <div className="grid gap-6 md:grid-cols-2">
            <PlanColumn
              title="Where and when use makes sense"
              items={[
                "Phones at the dinner table — yes or no, decided together.",
                "Bedrooms overnight — where do devices charge?",
                "Homework time — what counts as a focus block?",
                "Long car rides, family events, hangouts — any shared norms?",
              ]}
            />
            <PlanColumn
              title="What we do when things get hard"
              items={[
                "If something upsetting comes up, we talk before we punish.",
                "We use the report and mute tools instead of arguing in comments.",
                "If a creator or trend stops feeling good, we mute or move on.",
                "Adults follow the same rules they ask teens to follow.",
              ]}
            />
            <PlanColumn
              title="Regular check-ins"
              items={[
                "A short, monthly check-in beats a once-a-year blow-up.",
                "Ask: what's working, what's not, what should we change?",
                "Adjust the plan in writing so it's clear what changed.",
              ]}
            />
            <PlanColumn
              title="Boundaries that are collaborative, not punitive"
              items={[
                "Boundaries are about the household, not just the teen.",
                "Explain the why, not just the rule.",
                "When trust grows, the plan gets more room. That's the deal.",
              ]}
            />
          </div>

          <p className="mt-6 text-base text-muted-foreground leading-relaxed">
            Looking for a template? A few household-plan starting points — from
            the AAP, Australia's eSafety Commissioner, and the WHO — are in the{" "}
            <a
              href="#resources"
              className="text-brand-dark-green dark:text-brand-green underline underline-offset-2 hover:opacity-80"
            >
              outside resources
            </a>{" "}
            at the bottom of this page.
          </p>
        </Anchor>

        {/* 7. What to do if upset */}
        <Anchor id="upset">
          <SectionHero
            eyebrow="When something goes wrong"
            icon={<Lifebuoy weight="fill" className="h-7 w-7" />}
            title="What to do if your child saw something upsetting"
            lead="Most kids will see something they wish they hadn't at some point — on any app. What helps most isn't a perfect filter. It's a parent who reacts in a way that makes the next conversation possible."
          />

          <div className="grid gap-6 md:grid-cols-2">
            <Card variant="brand" accent="green">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Pause weight="fill" className="h-5 w-5 text-brand-green" />
                  1. Pause first
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-base leading-relaxed">
                <p>
                  Take a breath before reacting. Your first response sets
                  whether your teen tells you the next time something happens.
                </p>
              </CardContent>
            </Card>

            <Card variant="brand" accent="pink">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <ChatsCircle weight="fill" className="h-5 w-5 text-brand-pink" />
                  2. Talk before punishing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-base leading-relaxed">
                <p>
                  Ask what they saw, how they came across it, and how it felt.
                  Try to listen for longer than you talk. Punishment can come
                  later if it's actually warranted — disclosure has to come
                  first.
                </p>
              </CardContent>
            </Card>

            <Card variant="brand" accent="violet">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Flag weight="fill" className="h-5 w-5 text-brand-violet" />
                  3. Use the in-app tools
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-base leading-relaxed">
                <p>
                  Report the content or account in the app. Mute or block the
                  source. Walk through the steps together so your teen knows
                  how to do it next time without you.
                </p>
              </CardContent>
            </Card>

            <Card variant="brand" accent="orange">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Heart weight="fill" className="h-5 w-5 text-brand-orange" />
                  4. Know when to escalate
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-base leading-relaxed">
                <p>
                  If something looks illegal, involves a minor, or feels like
                  it's escalating offline, contact Divine support and, when
                  appropriate, local authorities. Trust your gut on this one.
                </p>
                <p className="text-sm text-muted-foreground">
                  For serious or time-sensitive reports, use the report flow
                  in the app and reach out via{" "}
                  <a
                    href="/support"
                    className="text-brand-dark-green dark:text-brand-green underline underline-offset-2 hover:opacity-80"
                  >
                    Divine support
                  </a>
                  .
                </p>
              </CardContent>
            </Card>
          </div>
        </Anchor>

        {/* 8. Rabble + STIR */}
        <Anchor id="stir">
          <SectionHero
            eyebrow="Why this approach"
            icon={<Microphone weight="fill" className="h-7 w-7" />}
            title="Rabble + Pam Wisniewski / STIR"
            lead="The framing on this page — conversation over punishment, co-navigation over surveillance, pause and redirect over hard control — comes out of years of research from teams like the Socio-Technical Interaction Research (STIR) Lab."
          />

          <Card variant="brand" accent="violet">
            <CardContent className="pt-6 space-y-4 text-base leading-relaxed">
              <p>
                Dr. Pamela Wisniewski and the{" "}
                <a
                  href="https://stirlab.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-dark-green dark:text-brand-green underline underline-offset-2 hover:opacity-80 inline-flex items-center gap-1"
                >
                  STIR Lab
                  <ArrowSquareOut className="h-3.5 w-3.5" />
                </a>{" "}
                study how teens, families, and online services actually
                interact. Their consistent finding: heavy-handed monitoring and
                punitive control tend to push teens away from the adults who
                want to help them. Teens fare better when they're trusted
                enough to participate in the rules, and when caregivers stay in
                conversation through the rough patches.
              </p>
              <p>
                Rabble — Divine's founder — talks with researchers like Pam
                Wisniewski about what non-punitive, conversation-first online
                safety actually looks like in practice. The values on this page
                are why we build the way we do.
              </p>

              <div className="rounded-2xl border-2 border-brand-dark-green dark:border-brand-green/40 bg-brand-light-green/30 dark:bg-brand-dark-green/40 p-5 mt-2">
                <p className="text-sm font-semibold text-brand-dark-green dark:text-brand-green mb-3">
                  Watch: Rabble + Pam Wisniewski on non-punitive online safety
                </p>
                <div className="relative w-full overflow-hidden rounded-xl border-2 border-brand-dark-green/80 dark:border-brand-green/30 bg-black aspect-video">
                  <iframe
                    src="https://www.youtube-nocookie.com/embed/8Zfvyj40GTM?si=RUDHdp-Z8BA-9I_p"
                    title="Rabble and Pam Wisniewski on conversation-first online safety"
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full"
                  />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Prefer to read?{" "}
                  <a
                    href="https://www.youtube.com/watch?v=8Zfvyj40GTM"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-dark-green dark:text-brand-green underline underline-offset-2 hover:opacity-80 inline-flex items-center gap-1"
                  >
                    Open the episode on YouTube
                    <ArrowSquareOut className="h-3.5 w-3.5" />
                  </a>
                  .
                </p>
                <p className="mt-5 text-sm font-semibold text-brand-dark-green dark:text-brand-green">
                  More from the STIR Lab
                </p>
                <ul className="mt-2 space-y-2 text-sm">
                  <li>
                    <a
                      href="https://stirlab.org/team/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-dark-green dark:text-brand-green underline underline-offset-2 hover:opacity-80 inline-flex items-center gap-1"
                    >
                      Meet the STIR Lab team
                      <ArrowSquareOut className="h-3.5 w-3.5" />
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://stirlab.org/wisniewski-speaks-on-gps-tracking/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-dark-green dark:text-brand-green underline underline-offset-2 hover:opacity-80 inline-flex items-center gap-1"
                    >
                      Wisniewski on GPS tracking and the case against
                      surveillance-first parenting
                      <ArrowSquareOut className="h-3.5 w-3.5" />
                    </a>
                  </li>
                </ul>
              </div>

              <blockquote className="border-l-4 border-brand-green pl-4 italic text-muted-foreground">
                The most effective online-safety strategy is rarely a tougher
                filter. It's a household where it's safe to bring something
                weird, scary, or embarrassing back to the adults.
              </blockquote>
            </CardContent>
          </Card>
        </Anchor>

        {/* 9. Outside resources */}
        <Anchor id="resources">
          <SectionHero
            eyebrow="Don't just take our word for it"
            icon={<BookOpenText weight="fill" className="h-7 w-7" />}
            title="Outside resources"
            lead="These are some resources we recommend. Inclusion here doesn't imply endorsement of every recommendation from these organizations. Read them with the same critical eye you'd bring to any single source — including this one. A few are global; most are from North American or UK sources."
          />

          <div className="space-y-10">
            {RESOURCE_GROUPS.map((group) => (
              <div key={group.heading}>
                <h3 className="font-display font-extrabold tracking-tight text-xl text-brand-dark-green dark:text-brand-off-white mb-4">
                  {group.heading}
                </h3>
                <div className="grid gap-5 md:grid-cols-2">
                  {group.links.map((r) => (
                    <a
                      key={r.url}
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block brand-card brand-offset-shadow-green p-6 hover:-translate-x-[2px] hover:-translate-y-[2px] hover:[box-shadow:8px_8px_0_0_hsl(var(--brand-green))] transition-all"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="font-display font-extrabold tracking-tight text-lg text-brand-dark-green dark:text-brand-off-white">
                          {r.name}
                        </h4>
                        <ArrowSquareOut className="h-5 w-5 flex-shrink-0 text-brand-dark-green dark:text-brand-green group-hover:translate-x-0.5 transition-transform" />
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                        {r.description}
                      </p>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Anchor>

        {/* Cross-link to the kids policy page — separate audience and
            tone, but the same household is likely interested in both. */}
        <div className="pt-12 border-t border-brand-dark-green/10 dark:border-brand-green/20">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-brand-dark-green dark:text-brand-green mb-4">
            <HouseLine weight="fill" className="h-4 w-4" />
            <span>More from Divine</span>
          </div>
          <a
            href="/kids"
            className="group block brand-card brand-offset-shadow-violet p-6 hover:-translate-x-[2px] hover:-translate-y-[2px] hover:[box-shadow:8px_8px_0_0_hsl(var(--brand-violet))] transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display font-extrabold tracking-tight text-xl text-brand-dark-green dark:text-brand-off-white">
                  Looking for the account rules for kids and teens?
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  The policy page covers how accounts work for under-16s,
                  the family-account carve-out, and what happens to
                  under-13 accounts at{" "}
                  <span className="font-medium text-brand-dark-green dark:text-brand-green">
                    divine.video/kids
                  </span>
                  .
                </p>
              </div>
              <ArrowSquareOut className="h-5 w-5 flex-shrink-0 text-brand-dark-green dark:text-brand-green group-hover:translate-x-0.5 transition-transform" />
            </div>
          </a>
        </div>

        {/* Closing note */}
        <div className="pt-8 border-t border-brand-dark-green/10 dark:border-brand-green/20">
          <p className="text-sm text-muted-foreground leading-relaxed">
            This page is part of Divine's commitment to being honest about
            what apps can and can't do for families. It's not legal
            advice, clinical advice, or a substitute for talking to the people
            in your home. If you have feedback or want to suggest a resource,
            reach out through{" "}
            <a
              href="/support"
              className="text-brand-dark-green dark:text-brand-green underline underline-offset-2 hover:opacity-80"
            >
              Divine support
            </a>
            .
          </p>
        </div>
      </div>
    </MarketingLayout>
  );
}

export default FamilyPage;

// ——————————————————————————————————————————————————————————————
// Local presentation helpers — kept in-file so this page is easy to update.
// ——————————————————————————————————————————————————————————————

function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const goTop = () => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <button
      type="button"
      onClick={goTop}
      aria-label="Back to top"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={`fixed right-5 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-40 h-12 w-12 rounded-full bg-brand-green text-brand-dark-green border-2 border-brand-dark-green brand-offset-shadow-sm-dark flex items-center justify-center transition-all duration-200 hover:-translate-x-[2px] hover:-translate-y-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark-green focus-visible:ring-offset-2 ${
        visible
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-2 pointer-events-none"
      }`}
    >
      <ArrowUp weight="bold" className="h-5 w-5" />
    </button>
  );
}

function Anchor({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      {children}
    </section>
  );
}

function SectionHero({
  eyebrow,
  icon,
  title,
  lead,
}: {
  eyebrow: string;
  icon: React.ReactNode;
  title: string;
  lead: string;
}) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-brand-dark-green dark:text-brand-green mb-3">
        {icon}
        <span>{eyebrow}</span>
      </div>
      <SectionHeader as="h2" className="text-3xl md:text-4xl mb-4">
        {title}
      </SectionHeader>
      <p className="text-lg leading-relaxed text-muted-foreground max-w-3xl">
        {lead}
      </p>
    </div>
  );
}

function FrameStep({
  icon,
  label,
  body,
}: {
  icon: React.ReactNode;
  label: string;
  body: string;
}) {
  return (
    <div className="flex gap-4 items-start">
      <div className="flex-shrink-0 w-11 h-11 rounded-full bg-brand-green text-brand-dark-green flex items-center justify-center">
        {icon}
      </div>
      <div>
        <h3 className="font-display font-extrabold tracking-tight text-xl text-brand-dark-green dark:text-brand-off-white mb-1">
          {label}
        </h3>
        <p className="text-base text-foreground/80 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

function SettingsRow({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="font-display font-extrabold tracking-tight text-lg text-brand-dark-green dark:text-brand-off-white mb-1">
        {title}
      </h3>
      <p className="text-base leading-relaxed text-foreground/80">{body}</p>
    </div>
  );
}

function PlanColumn({ title, items }: { title: string; items: string[] }) {
  return (
    <Card variant="brand">
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 list-disc pl-5 marker:text-brand-green text-base leading-relaxed">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
