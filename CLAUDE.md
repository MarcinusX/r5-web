# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Website for "Retkińska Piątka" - a charity 5km run in Łódź, Poland. The event is organized by Parafia Najświętszej Eucharystii and held in the Retkinia district.

### Event Details
- **Distance**: 5 km
- **Location**: Retkinia, Łódź, Poland
- **Next edition**: September 20, 2026 (charity cause TBD)
- **Previous editions**: 2024 (Fundacja Gajusz - rehabilitation lift), 2025 (Fundacja Rampa)
- **Certification**: PZLA (Polski Związek Lekkiej Atletyki)
- **Patronage**: Mayor of Łódź (Prezydent Miasta Łodzi)

### Tech Stack
- **Framework**: Astro (static site)
- **Styling**: Tailwind CSS
- **Hosting**: GitHub Pages
- **Language**: Polish only

## Development Commands

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Brand Colors (from logo)

```css
--color-primary: #2D5A6B;      /* Teal/morski - main brand color */
--color-accent: #F5C518;        /* Yellow/złoty - accent */
--color-text-light: #FFFFFF;    /* White text */
--color-text-dark: #1a1a1a;     /* Dark text */
```

## Project Structure

```
src/
├── components/     # Reusable Astro components
├── layouts/        # Page layouts
├── pages/          # Route pages
├── styles/         # Global CSS
└── content/        # Markdown content (editions, sponsors)
public/
├── images/         # Photos from events (with photographer credits)
├── logos/          # Event logo variants
└── sponsors/       # Sponsor logos
```

## Photo Credits

All photos must include photographer attribution. Use this pattern:
```astro
<figure>
  <img src={photo.src} alt={photo.alt} />
  <figcaption>Fot. {photo.photographer}</figcaption>
</figure>
```

## Content Guidelines

- Primary language: Polish
- External links for: registration (Zapisz), results (Wyniki)
- Sections: Hero, O biegu, Trasa, Harmonogram, Poprzednie edycje, Sponsorzy, Kontakt
- Charity focus: emphasize the charitable mission and past achievements

## Key External Links

- Facebook event: https://www.facebook.com/events/9897692227012010
- Photos 2024: https://radiolodz.pl/bieg-charytatywny-na-rzecz-fundacji-gajusz-zdjecia,429813/
- Fundacja Rampa: https://rampa.org.pl/

## GitHub Pages Deployment

Update `astro.config.mjs` before deploying:
1. Change `site` to your GitHub Pages URL
2. Change `base` to your repository name

GitHub Actions workflow for automatic deployment is recommended.
