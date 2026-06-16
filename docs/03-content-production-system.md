# Content Production System Architecture

Version: 1.0 | **状态: 设计参考** | 最后审查: 2026-06-16

> **实施状态说明**:
> - ✅ 已落地: Page Dynamic Zone 内容块系统(hero/rich-text/lead-form/feature-*/testimonials/pricing/related-products), 多站点架构(Site), 内容发布状态(draft/published), 关联产品区块(manual/category/tag/hybrid)
> - ❌ 未实施: Keyword Cluster 系统(Phase 1), FAQ 系统(Phase 1), GEO Question 系统(Phase 2), 自动页面组装引擎, 内部链接自动规则(Phase 1), 批量内容生成(Phase 3), AI 内容工作流(Phase 3)
> - 🔄 调整: 不建独立的 SEO Page/GEO Page 类型，复用 Page + Dynamic Zone；不建独立的 InternalLink 集合，改用关系字段+规则引擎
>
> 本文档描述的内容生产系统为 Phase 2-3 的目标架构，Phase 1 先建基础设施(Keyword Cluster + FAQ)。

Purpose:

Define the scalable content production system for:

* SEO Pages
* GEO Pages
* FAQ Pages
* Product Pages
* Internal Linking

This document enables the platform to scale from hundreds to tens of thousands of pages without manual page creation.

Tech Stack:

* Strapi v5
* PostgreSQL
* Astro
* Multi-Site

---

# 1. Core Principle

Pages are generated from structured content.

Editors do not create pages.

Editors create:

```text
Keywords

Questions

FAQs

Products

Categories

Content Blocks
```

Pages are assembled automatically.

---

# 2. Content Hierarchy

```text
Site

 ├─ Categories

 ├─ Products

 ├─ Keyword Clusters

 ├─ FAQs

 ├─ GEO Questions

 └─ Templates

        │

        ▼

Generated Pages
```

---

# 3. Content Types

The system consists of five production layers.

---

Layer 1

Products

Commercial assets.

Purpose:

Generate leads.

---

Layer 2

Keyword Clusters

SEO traffic generation.

Purpose:

Create search demand pages.

---

Layer 3

GEO Questions

AI search demand.

Purpose:

Create answer-focused pages.

---

Layer 4

FAQs

Reusable knowledge units.

Purpose:

Support SEO and GEO pages.

---

Layer 5

Templates

Rendering instructions.

Purpose:

Generate pages consistently.

---

# 4. Keyword Cluster System

Purpose:

Group keywords by topic and search intent.

Example:

Cluster:

```text
Commercial Treadmill Manufacturer
```

Keywords:

```text
commercial treadmill manufacturer

treadmill supplier

treadmill factory

OEM treadmill manufacturer

treadmill company
```

---

# 5. Keyword Cluster Schema

```typescript
name

slug

primary_keyword

secondary_keywords[]

search_intent

industry

country

language
```

---

# 6. Search Intent

Supported values:

```text
informational

commercial

transactional

comparison
```

---

# 7. SEO Page Generation Rules

One page targets:

```text
1 Primary Keyword
```

Optional:

```text
Multiple Secondary Keywords
```

Example:

```text
Primary:

Commercial Treadmill Manufacturer

Secondary:

Treadmill Supplier

Treadmill Factory

OEM Treadmill Manufacturer
```

---

# 8. SEO Page Templates

Supported templates:

---

Template A

Manufacturer Page

Example:

```text
Commercial Treadmill Manufacturer
```

---

Template B

Supplier Page

Example:

```text
Treadmill Supplier
```

---

Template C

Buying Guide

Example:

```text
How To Choose A Treadmill Manufacturer
```

---

Template D

Comparison Page

Example:

```text
China vs USA Treadmill Manufacturers
```

---

Template E

Industry Guide

Example:

```text
Commercial Gym Equipment Guide
```

---

# 9. SEO Page Structure

Recommended order:

```text
Hero Section

Introduction

Main Content

Related Products

FAQ

Lead Form
```

---

# 10. GEO Question System

Purpose:

Capture AI search traffic.

One page targets:

```text
One Question
```

---

Example:

```text
What Is A Commercial Treadmill?

How Long Does A Treadmill Last?

How To Import Gym Equipment From China?
```

---

# 11. GEO Question Schema

```typescript
question

slug

question_type

answer_summary

answer_body

tags[]

industry
```

---

# 12. GEO Question Types

Supported:

```text
what

how

why

when

comparison

troubleshooting
```

---

# 13. GEO Page Structure

Required order:

```text
Direct Answer

Detailed Explanation

Steps

Related Products

FAQ

Lead Form
```

This structure should remain consistent.

---

# 14. FAQ System

Purpose:

Reusable knowledge graph.

One FAQ may be linked to:

```text
Products

SEO Pages

GEO Pages
```

---

Example:

Question:

```text
What is MOQ?
```

Used on:

```text
20 SEO Pages

10 GEO Pages

5 Product Pages
```

Single source of truth.

---

# 15. FAQ Schema

```typescript
question

answer

answer_summary

tags[]

industry
```

---

# 16. FAQ Assignment Rules

Automatic assignment allowed.

Rule:

```text
Match by category

Match by tags

Match by keyword cluster
```

---

# 17. Related Products Rules

Purpose:

Commercial relevance.

Every page should contain:

```text
Related Products
```

when applicable.

---

Priority:

```text
Manual

Hybrid

Category

Tag
```

---

# 18. Internal Linking System

Purpose:

Build content graph.

Not manual links.

Managed centrally.

---

# 19. Link Relationships

Allowed:

```text
SEO → Product

SEO → SEO

SEO → GEO

GEO → Product

GEO → FAQ

Product → GEO

Product → Product
```

---

# 20. Automatic Internal Linking Rules

Rule 1

Keyword Match

Example:

```text
treadmill supplier
```

Automatically links to:

```text
Commercial Treadmill Manufacturer
```

---

Rule 2

Category Match

Example:

```text
Treadmill Category
```

Links to:

```text
All treadmill products
```

---

Rule 3

FAQ Match

Example:

```text
What Is MOQ?
```

Links to:

```text
Relevant Product Pages
```

---

# 21. Content Block System

All content must use blocks.

Supported:

```text
Rich Text

Image

Video

FAQ

Comparison Table

Related Products

Lead Form

Statistics

CTA
```

---

# 22. AI Content Workflow

Draft generation process:

```text
Keyword

↓

Cluster

↓

Template

↓

AI Draft

↓

Editor Review

↓

Publish
```

---

# 23. GEO Content Workflow

Question

↓

Template

↓

AI Draft

↓

Editor Review

↓

Publish

---

# 24. Publishing Workflow

Status:

```text
Draft

Review

Approved

Published

Archived
```

---

# 25. Multi-Site Content Reuse

Content may be:

```text
Global

Site Specific
```

---

Example:

FAQ

```text
Global
```

Reusable across sites.

---

Example:

SEO Page

```text
Site Specific
```

Unique per site.

---

# 26. Lead Generation Rules

Every commercial page should include:

```text
Related Products

Lead Form
```

At least one conversion opportunity.

---

# 27. Programmatic SEO Compatibility

Architecture must support:

```text
10,000+ SEO Pages
```

without schema changes.

---

# 28. GEO Compatibility

Architecture must support:

```text
50,000+ Questions
```

without redesign.

---

# 29. Future AI Features

Architecture should support:

```text
Vector Search

Entity Matching

Knowledge Graph

AI Internal Linking

AI Content Recommendations
```

without restructuring.

---

# 30. Definition of Done

The system is considered complete when:

✓ Keyword Clusters exist

✓ GEO Questions exist

✓ FAQ system exists

✓ Internal Linking system exists

✓ Related Products system exists

✓ Content Blocks exist

✓ Templates exist

✓ AI Draft workflow exists

✓ Multi-site reuse exists

✓ SEO scaling supported

✓ GEO scaling supported

✓ Future AI expansion supported

End of Specification
