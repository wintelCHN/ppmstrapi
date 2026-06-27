# Product

## Register

product

## Users

B2B content operators, site builders, and future automation agents use this system to manage product catalogs, marketing pages, SEO metadata, media, and lead generation content across multiple independent websites. They work mostly in Strapi Admin and expect dense, predictable editing surfaces that support repeated content operations.

## Product Purpose

This project is a Strapi + Astro B2B marketing site factory. Strapi is the single content source for products, pages, categories, site layouts, SEO, media, and leads. Astro consumes Strapi data to build multiple fast static sites from shared code. Success means operators can publish accurate product and marketing content quickly, keep sites isolated by Site, and deploy reliably through Railway, Vercel, GitHub, and Cloudflare R2.

## Brand Personality

Professional, practical, conversion-focused. The admin experience should feel trustworthy and efficient; the public websites should support B2B buyer confidence through clear product information, proof, and low-friction inquiry paths.

## Anti-references

Avoid decorative admin UI changes that make editing slower or less familiar. Avoid marketing-site patterns that hide real product details behind vague claims, stock-like imagery, or generic landing page sections. Avoid leaking credentials, private deployment details, or secrets into project docs and generated files.

## Design Principles

- Content operations first: admin UI changes should reduce friction for product, media, SEO, and site-layout editing.
- Preserve Strapi familiarity: prefer scoped enhancements over broad overrides of native admin behavior.
- Make product evidence visible: public pages should prioritize specifications, media, trust signals, FAQ, and inquiry actions.
- Keep multi-site boundaries clear: Site ownership, locale, publish state, and business status must remain explicit.
- Design for maintenance: one shared Astro codebase should serve multiple brands without hardcoded business content.

## Accessibility & Inclusion

Default to accessible product UI conventions: readable labels, keyboard-safe controls, visible focus states, semantic HTML on public pages, reduced-motion compatibility, and sufficient text contrast. Public marketing sites should remain usable on desktop and mobile for international B2B buyers.
