# AI Content Generation Workflow Architecture

Version: 1.0 | **状态: 未实施 (Phase 3 目标)** | 最后审查: 2026-06-16

> **实施状态说明**:
> - ❌ 全部未实施: 本文档描述的 AI 内容生成流水线（Claude API、BullMQ 队列、Prompt 版本管理、批量生成、人工审核流）均为 Phase 3 目标
> - ✅ 已就绪的基础设施: `.env` 中已有 AI API 配置（ANTHROPIC_BASE_URL/ANTHROPIC_API_KEY），Strapi 已有 Anthropic Messages API 调用经验（来自已取消的 Site Theme AI 分析器）
> - 🔄 Phase 3 简化方案: 先做同步生成（不做 BullMQ 队列），先支持 Claude API（Anthropic 兼容端点可切换），Prompt 模板化为独立内容类型
> - ⚠️ 依赖 Phase 1 产出: Keyword Cluster 和 FAQ 内容类型必须先建好
>
> 本文档为 Phase 3 开发的原始设计参考，实施时会简化适配。

Purpose:

Define the AI-powered content generation workflow for:

* SEO Pages
* GEO Pages
* FAQ Pages
* Internal Linking
* Related Products
* Multi-Site Content Operations

Tech Stack:

* Strapi v5
* Astro
* PostgreSQL
* Claude API
* OpenAI API (optional)

---

# 1. Core Objective

The goal is NOT to generate articles.

The goal is to generate structured content assets.

AI outputs must be stored as structured data.

Pages are assembled later by Astro.

---

# 2. Content Factory Concept

Input:

```text
Keyword

Question

Product

Category
```

Output:

```text
SEO Page

GEO Page

FAQ

Internal Links

Related Products
```

Workflow:

```text
Input

↓

AI Processing

↓

Structured Content

↓

Strapi

↓

Review

↓

Publish

↓

Astro Build
```

---

# 3. AI Content Types

The system generates:

```text
SEO Pages

GEO Pages

FAQ Items

Internal Links

Related Product Suggestions

Meta Data

Schema Data
```

---

# 4. SEO Generation Workflow

Input:

```json
{
  "primary_keyword": "commercial treadmill manufacturer",

  "secondary_keywords": [
    "treadmill supplier",
    "treadmill factory"
  ],

  "industry": "fitness equipment"
}
```

---

Process:

```text
Keyword Cluster

↓

Template Selection

↓

AI Draft

↓

Content Blocks

↓

Strapi
```

---

Output:

```json
{
  "title": "...",

  "meta_title": "...",

  "meta_description": "...",

  "blocks": []
}
```

---

# 5. SEO Templates

Supported:

---

Template A

Manufacturer Page

Purpose:

Commercial intent.

Example:

```text
Commercial Treadmill Manufacturer
```

---

Template B

Supplier Page

Purpose:

Commercial intent.

---

Template C

Buying Guide

Purpose:

Informational intent.

---

Template D

Comparison Page

Purpose:

Comparison intent.

---

Template E

Industry Guide

Purpose:

Topical authority.

---

# 6. SEO Content Block Generation

AI must generate blocks.

Not HTML.

Example:

```json
[
  {
    "type": "hero"
  },

  {
    "type": "rich_text"
  },

  {
    "type": "faq"
  },

  {
    "type": "related_products"
  }
]
```

---

# 7. GEO Generation Workflow

Input:

```json
{
  "question": "What is a commercial treadmill?"
}
```

---

Process:

```text
Question

↓

Question Type Detection

↓

Template Selection

↓

Answer Generation

↓

FAQ Extraction

↓

Strapi
```

---

# 8. GEO Question Types

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

# 9. GEO Output Structure

```json
{
  "question": "...",

  "short_answer": "...",

  "full_answer": "...",

  "faq_items": []
}
```

---

# 10. GEO Page Rules

Every GEO page must contain:

```text
Direct Answer

Explanation

Steps

Related Products

FAQ

Lead Form
```

---

# 11. FAQ Generation Workflow

Purpose:

Create reusable FAQ assets.

---

Input:

```text
Keyword Cluster
```

---

Example:

```text
Commercial Treadmill Manufacturer
```

---

AI Generates:

```text
What is MOQ?

How long is production time?

Can I customize branding?

What certifications are available?
```

---

Output:

FAQ Collection.

Stored independently.

Reusable across pages.

---

# 12. FAQ Deduplication

Before creating FAQ:

Check existing FAQ.

If similar FAQ exists:

```text
Reuse Existing FAQ
```

Do not create duplicates.

---

# 13. Internal Link Generation

Purpose:

Build content graph.

---

Input:

```text
SEO Page

GEO Page

Products

FAQs
```

---

Process:

```text
Entity Detection

↓

Keyword Matching

↓

Relationship Scoring

↓

Suggested Links
```

---

Output:

```json
[
  {
    "source": "...",

    "target": "...",

    "anchor_text": "..."
  }
]
```

---

# 14. Internal Link Priority

Priority Order:

```text
Product

SEO Page

GEO Page

FAQ
```

---

Example:

```text
SEO Page

↓

Product
```

Preferred over:

```text
SEO Page

↓

FAQ
```

---

# 15. Related Product Generation

Purpose:

Automatically recommend products.

---

Input:

```text
SEO Page

GEO Page

FAQ
```

---

Process:

```text
Keyword Extraction

↓

Tag Matching

↓

Category Matching

↓

Scoring
```

---

Output:

```json
[
  {
    "product_id": 1,
    "score": 95
  }
]
```

---

# 16. Related Product Scoring

Category Match

```text
+40
```

---

Tag Match

```text
+30
```

---

Keyword Match

```text
+20
```

---

Featured Product

```text
+10
```

---

Maximum:

```text
100
```

---

# 17. Metadata Generation

AI generates:

```text
Meta Title

Meta Description

OG Title

OG Description
```

---

Stored in Strapi.

Not generated at runtime.

---

# 18. Schema.org Generation

AI identifies schema type.

---

SEO Pages:

```text
Article
```

---

FAQ Pages:

```text
FAQPage
```

---

GEO Pages:

```text
QAPage
```

or

```text
FAQPage
```

---

Product Pages:

```text
Product
```

---

# 19. Multi-Site Content Reuse

Content Scope:

```text
Global

Site Specific
```

---

Global Content

Examples:

```text
FAQ

GEO Questions

Industry Definitions
```

---

Site Content

Examples:

```text
SEO Pages

Landing Pages

Lead Magnets
```

---

# 20. Publishing Workflow

Statuses:

```text
Draft

AI Generated

Editor Review

Approved

Published

Archived
```

---

# 21. Human Review Requirements

AI content must NOT publish automatically.

Required:

```text
Editor Approval
```

before publishing.

---

# 22. Bulk Generation

Supported:

```text
1 Keyword

10 Keywords

100 Keywords

1000 Keywords
```

---

Workflow:

```text
CSV Import

↓

Queue

↓

AI Generation

↓

Review Queue

↓

Publish
```

---

# 23. Queue System

Recommended:

```text
BullMQ
```

or

```text
Cloud Tasks
```

---

Purpose:

Prevent API overload.

---

# 24. Prompt Management

Prompts must be versioned.

Collection:

```text
Prompt Template
```

Fields:

```text
Name

Version

Prompt

Status
```

---

Do not hardcode prompts.

---

# 25. Cost Optimization

Generate:

```text
Outline

FAQs

Metadata
```

first.

Generate:

```text
Full Content
```

only when approved.

---

# 26. Quality Control

Automatically validate:

```text
Word Count

Missing Sections

Duplicate Content

Missing FAQ

Missing Lead Form
```

---

# 27. Future AI Features

Architecture must support:

```text
Claude

GPT

Gemini

DeepSeek

Open Source Models
```

without redesign.

---

# 28. Knowledge Graph Compatibility

Future entities:

```text
Brands

Industries

Products

Technologies

Countries
```

must be linkable.

---

# 29. Definition of Done

System is complete when:

✓ AI generates SEO pages

✓ AI generates GEO pages

✓ AI generates FAQs

✓ AI generates metadata

✓ AI suggests internal links

✓ AI suggests related products

✓ Human review workflow exists

✓ Bulk generation exists

✓ Queue system exists

✓ Multi-site support exists

✓ Prompt versioning exists

✓ Future model replacement supported

End of Specification
