// ABOUTME: "Hear from experts" STIR Lab / Pam Wisniewski section, moved verbatim from FamilyPage
// ABOUTME: Includes the embedded episode and STIR Lab links

import { ArrowSquareOut, Microphone } from "@phosphor-icons/react";

import { Anchor, SectionHero } from "@/components/static-pages";
import { Card, CardContent } from "@/components/ui/card";

export function ExpertsSection() {
  return (
    <Anchor id="stir">
      <SectionHero
        eyebrow="Hear from experts"
        icon={<Microphone weight="fill" className="h-7 w-7" />}
        title="Rabble + Pam Wisniewski / STIR"
        lead="The framing on this page—conversation over punishment, co-navigation over surveillance, pause and redirect over hard control—comes out of years of research from teams like the Socio-Technical Interaction Research (STIR) Lab."
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
            Rabble—Divine's co-founder—talks with researchers like Pam
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
  );
}
