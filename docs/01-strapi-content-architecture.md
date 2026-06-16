# Strapi Content Architecture

Version: 1.0 | **状态: 参考文档** | 最后审查: 2026-06-16

> **实施状态说明**:
> - ✅ 已落地: Site, Category, Product, Page(Dynamic Zone), Blog, News, Menu, MenuItem, Footer, Global, Lead
> - ❌ 未按此文档实施: Keyword Cluster, SEO Page(独立类型), GEO Page(独立类型), FAQ(独立类型), Internal Link(独立集合)
> - 🔄 调整方案: SEO/GEO 页面复用 Page 类型 + Dynamic Zone 组件区分模板；FAQ 和 Keyword Cluster 作为新独立类型（Phase 1）；内部链接改为规则生成+关系字段方式（不建独立集合）
> - ❌ 已取消: Site Template, Site Theme（2026-06-11 用户明确取消，见 strapi_api_contract.md §12）
>
> 本文档为 ChatGPT 互动产生的原始设计稿，实际架构以 `CLAUDE.md` 和 `strapi_api_contract.md` 为准。

Purpose:

Define the complete content architecture for a multi-site SEO + GEO + B2B lead generation platform.

Tech Stack:

* Strapi v5
* PostgreSQL
* Astro
* Multi-Site

---

# 1. Architecture Principles

The system must be content-driven.

Pages are not stored as HTML.

Pages are generated from structured content relationships.

Core Concept:

```text
Site
  ├─ Product
  ├─ Category
  ├─ SEO Page
  ├─ GEO Page
  ├─ FAQ
  ├─ Keyword Cluster
  └─ Content Blocks
```

---

# 2. Entity Relationship Diagram

```text
Site
 │
 ├──────────────┐
 │              │
 ▼              ▼

Category      Keyword Cluster
 │              │
 │              │
 ▼              ▼

Product      SEO Page
 │              │
 │              │
 └──────┬───────┘
        │
        ▼

Related Products Block

        │
        ▼

FAQ

        │
        ▼

GEO Page
```

---

# 3. Site

Purpose:

Support multiple websites using one Strapi instance.

Fields:

```typescript
name

domain

brand_name

default_language

is_active
```

Relations:

```text
Site

1:N Products

1:N Categories

1:N SEO Pages

1:N GEO Pages
```

---

# 4. Category

Purpose:

Product hierarchy.

Fields:

```typescript
name

slug

description

parent_category
```

Relations:

```text
Category

1:N Products
```

---

# 5. Product

Purpose:

Commercial entity.

Products are the center of monetization.

Fields:

```typescript
name

slug

short_description

full_description

featured_image

gallery

specifications

applications

tags

featured

priority_score
```

Relations:

```text
Product

N:1 Category

N:N FAQ

N:N SEO Page

N:N GEO Page
```

---

# 6. Keyword Cluster

Purpose:

Group keywords by search intent.

Example:

Commercial Treadmill Manufacturer

Contains:

* treadmill manufacturer
* treadmill factory
* treadmill supplier
* treadmill OEM

Fields:

```typescript
name

slug

primary_keyword

secondary_keywords[]

search_intent
```

Intent Values:

```text
informational

commercial

transactional

comparison
```

Relations:

```text
Keyword Cluster

1:N SEO Pages
```

---

# 7. SEO Page

Purpose:

Search engine landing page.

One page targets one primary keyword.

Fields:

```typescript
title

slug

primary_keyword

secondary_keywords[]

search_intent

meta_title

meta_description

featured_image

content_blocks[]
```

Relations:

```text
SEO Page

N:1 Site

N:1 Keyword Cluster

N:N Products

N:N FAQ
```

---

# 8. GEO Page

Purpose:

AI-search optimized answer page.

One page targets one user question.

Fields:

```typescript
question

slug

short_answer

full_answer

answer_type

content_blocks[]
```

Answer Types:

```text
what

how

why

comparison

troubleshooting
```

Relations:

```text
GEO Page

N:1 Site

N:N Products

N:N FAQ
```

---

# 9. FAQ

Purpose:

Reusable knowledge unit.

One FAQ may appear on:

* Product Pages
* SEO Pages
* GEO Pages

Fields:

```typescript
question

answer

answer_summary

tags[]
```

Relations:

```text
FAQ

N:N Product

N:N SEO Page

N:N GEO Page
```

---

# 10. Internal Linking System

Purpose:

Create scalable SEO architecture.

Fields:

```typescript
source_type

source_id

target_type

target_id

anchor_text

link_type
```

Link Types:

```text
contextual

related

recommended

faq
```

Relations:

```text
SEO Page
GEO Page
Product
FAQ
```

---

# 11. Content Blocks

All pages use Dynamic Zones.

Allowed Blocks:

```text
Rich Text

FAQ Block

Related Products Block

Comparison Table

CTA Block

Lead Form Block

Image Gallery

Statistics Block
```

No page should store hardcoded layout.

All rendering must be component-driven.

---

# 12. Related Products Block

Reusable component.

Supported Modes:

```text
manual

category

tag

hybrid
```

Must be available in:

```text
Product

SEO Page

GEO Page
```

---

# 13. Future AI Compatibility

The architecture must support:

```text
Programmatic SEO

AI Generated Content

Semantic Entity Linking

Vector Search

Knowledge Graph
```

without schema redesign.

End of Specification
