// ABOUTME: Outside-resources link data for the family pages, shared by hub and child pages
// ABOUTME: Copy moved verbatim from the original FamilyPage; keys let child pages show subsets

export interface ResourceLink {
  name: string;
  url: string;
  description: string;
}

export interface ResourceGroup {
  key: 'plans' | 'guidance' | 'help';
  heading: string;
  links: ResourceLink[];
}

export const RESOURCE_GROUPS: ResourceGroup[] = [
  {
    key: 'plans',
    heading: "Plans you can fill out together",
    links: [
      {
        name: "AAP Family Media Plan",
        url: "https://www.healthychildren.org/English/fmp/Pages/MediaPlan.aspx",
        description:
          "American Academy of Pediatrics tool for building a household plan together, room by room and screen by screen.",
      },
      {
        name: "eSafety Commissioner (Australia)—Family Tech Agreement",
        url: "https://www.esafety.gov.au/parents/resources/family-tech-agreement",
        description:
          "A downloadable family tech-agreement template from Australia's online-safety regulator—same shape as the AAP plan, written to work for any household.",
      },
      {
        name: "WHO—Helping Adolescents Thrive",
        url: "https://www.who.int/publications/i/item/9789240025554",
        description:
          "The World Health Organization's framework for adolescent well-being—strategies for parents, educators, and health workers, written for a global audience.",
      },
    ],
  },
  {
    key: 'guidance',
    heading: "Family guidance and conversation tools",
    links: [
      {
        name: "Common Sense Media—Parents' Guide to Social Media",
        url: "https://www.commonsensemedia.org/articles/parents-ultimate-guide-to-social-media",
        description:
          "Plain-language explainers, age-by-age guidance, and reviews of the apps teens actually use.",
      },
      {
        name: "Internet Matters (UK)",
        url: "https://www.internetmatters.org/",
        description:
          "UK-based equivalent of Common Sense Media—app-by-app guides, age-by-age advice, and practical online-safety tools for parents.",
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
          "Parent-to-parent guidance—conversation starters, family templates, and decision frameworks for navigating screens at every age.",
      },
    ],
  },
  {
    key: 'help',
    heading: "Reporting harms or getting help",
    links: [
      {
        name: "INHOPE",
        url: "https://www.inhope.org/",
        description:
          "Global network of reporting hotlines—find the right place to report illegal online content in your country.",
      },
      {
        name: "Child Helpline International",
        url: "https://childhelplineinternational.org/",
        description:
          "Directory of crisis helplines for kids and teens by country—for the moments when your child needs to talk to someone right now.",
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
