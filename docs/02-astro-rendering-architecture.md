# Astro Rendering Architecture

Version: 1.0 | **状态: 大部分已落地** | 最后审查: 2026-06-16

> **实施状态说明**:
> - ✅ 已落地: SSG 全站预渲染, 动态路由(products/category/slug, blog/slug, news/slug, pages/slug), Strapi 数据层, Dynamic Zone 渲染(SectionRenderer), SEO 基础(title/description/OG/hreflang), @astrojs/sitemap, 9 语言 i18n 路由, 设计系统(Tailwind CSS 4 + CSS Custom Properties)
> - ❌ 未落地: JSON-LD 结构化数据(Phase 1), 内部链接引擎(Phase 1), robots.txt 动态生成(Phase 1), FAQ 页面模板(Phase 1), GEO 页面模板(Phase 2), Schema.org 自动生成
> - 🔄 调整: SEO/GEO 页面路由复用 `/pages/[slug]`，通过 Dynamic Zone 组件区分模板，不新建独立路由 `/seo/[slug]` 和 `/answers/[slug]`
>
> Astro 前端实际代码位于 `D:\www\astrotest2`，本文档为设计参考。

Purpose:

Define frontend rendering architecture for SEO + GEO + B2B platform.

Tech Stack:

* Astro
* Strapi
* Multi-Site

---

# 1. Core Principle

Astro is a rendering engine.

Strapi is the source of truth.

No content should be hardcoded in Astro.

All content comes from Strapi.

---

# 2. Site Structure

```text
src/

├── pages/

├── layouts/

├── components/

├── lib/

├── services/

├── schema/

└── types/
```

---

# 3. Dynamic Routes

Product Pages

```text
/products/[slug]
```

Category Pages

```text
/category/[slug]
```

SEO Pages

```text
/seo/[slug]
```

GEO Pages

```text
/answers/[slug]
```

FAQ Pages

```text
/faq/[slug]
```

---

# 4. Data Fetching

All pages fetch content from Strapi.

Pattern:

```typescript
getStaticPaths()

↓

Fetch Slugs

↓

Generate Routes

↓

Fetch Content

↓

Render Page
```

---

# 5. Rendering Strategy

Use SSG.

Reason:

Maximum SEO performance.

---

## Product Pages

```text
SSG
```

---

## Category Pages

```text
SSG
```

---

## SEO Pages

```text
SSG
```

---

## GEO Pages

```text
SSG
```

---

# 6. Incremental Build Strategy

Build only changed pages.

Content update flow:

```text
Strapi Publish

↓

Webhook

↓

Trigger Build

↓

Deploy
```

---

# 7. Layout System

Base Layout

```text
BaseLayout.astro
```

---

Product Layout

```text
ProductLayout.astro
```

---

SEO Layout

```text
SEOLayout.astro
```

---

GEO Layout

```text
GEOLayout.astro
```

---

# 8. Component System

Content blocks render dynamically.

Example:

```typescript
switch(block.__component)
```

---

Supported Components:

```text
RichTextBlock

FAQBlock

LeadFormBlock

RelatedProductsBlock

ComparisonBlock

CTASection

ImageGallery

StatisticsBlock
```

---

# 9. Schema.org Generation

Automatic.

---

## Product Page

Generate:

```json
Product
```

---

## SEO Page

Generate:

```json
Article
```

---

## GEO Page

Generate:

```json
FAQPage
```

or

```json
QAPage
```

---

## FAQ Page

Generate:

```json
FAQPage
```

---

# 10. SEO Metadata

Every page must support:

```typescript
title

description

canonical

og_image

robots
```

Automatically generated from Strapi.

---

# 11. Internal Linking Engine

Purpose:

Improve crawlability.

Sources:

```text
InternalLink Collection
```

Rendering:

```text
Automatic
```

Supported:

```text
Product → Product

SEO → Product

SEO → GEO

GEO → Product

FAQ → Product
```

---

# 12. Related Products Engine

Component:

```text
RelatedProducts.astro
```

Modes:

```text
manual

category

tag

hybrid
```

Logic located in:

```text
src/lib/relatedProducts.ts
```

Not inside UI components.

---

# 13. GEO Optimization Layer

Every GEO page must contain:

```text
Direct Answer

Structured Steps

FAQ Block

Related Products

Lead Form
```

Order is mandatory.

---

# 14. SEO Optimization Layer

Every SEO page must contain:

```text
Keyword Introduction

Main Content

Related Products

FAQ

Lead Form
```

Order is configurable.

---

# 15. Sitemap Generation

Automatically generate:

```text
products.xml

seo-pages.xml

geo-pages.xml

faq.xml
```

Combined into:

```text
sitemap.xml
```

---

# 16. Robots

Auto-generated.

Allow:

```text
Product Pages

SEO Pages

GEO Pages

FAQ Pages
```

Disallow:

```text
Draft Content

Preview Pages
```

---

# 17. Performance Requirements

Target:

```text
Lighthouse 95+
```

Requirements:

```text
Static HTML

Minimal JS

Image Optimization

Lazy Loading

Preload Critical Assets
```

---

# 18. Future Extensions

Architecture must support:

```text
Programmatic SEO

AI Generated Pages

Knowledge Graph

Entity Pages

Semantic Search
```

without route redesign.

End of Specification
