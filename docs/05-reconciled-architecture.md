# B2B CMS — 统一架构文档

> **版本**: 2.0 | **日期**: 2026-06-16 | **取代**: docs/01-04 原始设计稿
>
> 本文档是 Strapi + Astro B2B 网站群系统的**权威架构参考**。原始 docs/ 文件为 ChatGPT 互动设计稿，以本文档的裁决为准。

---

## 1. 技术栈

| 层 | 技术 | 版本 | 路径 |
|----|------|------|------|
| CMS 后端 | Strapi | 5.47.1 CE | `D:\www\b2bcms` |
| 数据库 | PostgreSQL | 18 | `127.0.0.1:5432` |
| 前端框架 | Astro | latest | `D:\www\astrotest2` |
| CSS | Tailwind CSS | 4.x | — |
| AI API | Anthropic Messages (兼容 DeepSeek) | — | `.env` 配置 |

---

## 2. 核心原则

1. **Content-Driven**: 页面由结构化内容关系生成，不存 HTML
2. **分层分离**: Strapi = 数据中台，Astro = 渲染引擎
3. **渐进增强**: 在现有代码基础上增量添加，不大规模重构
4. **复用优先**: SEO/GEO 页面复用 `Page` 类型，通过 Dynamic Zone 组件和模板区分
5. **API 优先**: Strapi REST API 是唯一数据源，Astro 构建时全量拉取

---

## 3. 内容模型

### 3.1 已有（11 个类型）

```
Site ──── Category (自引用层级) ──── Product
  │
  ├── Page (Dynamic Zone, 10 种组件)
  ├── Blog
  ├── News
  ├── Menu (1:1 Site) ──── MenuItem (N:1 Menu)
  ├── Footer (1:1 Site)
  ├── Global (单例)
  └── Lead (公开 API)
```

### 3.2 新增（Phase 1）

```
KeywordCluster ──── Page (SEO 页面, N:1 关联)
     │
FAQ (可复用) ──── N:N Page, Product, Category
```

### 3.3 已取消

| 模块 | 取消日期 | 原因 |
|------|---------|------|
| Site Template | 2026-06-11 | 站点结构通过 Astro 文件路由定义 |
| Site Theme | 2026-06-11 | 样式通过 Astro CSS 设计系统管理 |

---

## 4. API 设计

### 4.1 数据流向

```
Strapi Admin (编辑)
    ↓
Strapi REST API (Public, 只读)
    ↓ (构建时 fetch)
Astro getStaticPaths()
    ↓
Static HTML (CDN)
```

### 4.2 关键端点

| 端点 | 用途 | 认证 |
|------|------|------|
| `GET /api/sites` | 站点列表 | API Token |
| `GET /api/pages?locale=en&populate=*` | 页面（含 Dynamic Zone） | API Token |
| `GET /api/keyword-clusters?locale=en` | 关键词集群 | API Token |
| `GET /api/faqs?locale=en` | FAQ 列表 | API Token |
| `POST /api/public/lead` | 询盘提交 | 无（公开） |
| `GET /api/leads/export` | CSV 导出 | Admin JWT |

---

## 5. Astro 路由

| 路由模式 | 内容类型 | 说明 |
|----------|---------|------|
| `/` | Home (index.astro) | 英文首页 |
| `/[lang]` | Home (localized) | 本地化首页 |
| `/products` | Category (listing) | 产品目录 |
| `/products/[category]` | Category (detail) | 分类页 |
| `/products/[category]/[slug]` | Product (detail) | 产品详情 |
| `/pages/[slug]` | Page | 通用页面（含 SEO/GEO） |
| `/blog/[slug]` | Blog | 博客详情 |
| `/news/[slug]` | News | 新闻详情 |
| `/faq/[slug]` | FAQ | FAQ 详情（Phase 1 新增） |

所有路由均有 `/[lang]/...` 本地化版本（9 语言）。

---

## 6. Dynamic Zone 组件映射

### 6.1 已有（Strapi → Astro）

| Strapi 组件 | Astro 组件 | 用途 |
|-------------|-----------|------|
| `sections.hero` | PageHero | 主视觉横幅 |
| `sections.rich-text` | prose HTML | 富文本 |
| `sections.lead-form` | CTA band | 询盘表单 |
| `sections.feature-columns-group` | 3-column grid | 特性列 |
| `sections.feature-rows-group` | alternating rows | 特性行 |
| `sections.testimonials-group` | testimonial grid | 客户评价 |
| `sections.bottom-actions` | CTA band | 底部行动号召 |
| `sections.large-video` | iframe embed | 视频嵌入 |
| `sections.pricing` | plans grid | 价格方案 |
| `shared.related-products` | RelatedProducts | 关联产品 |

### 6.2 新增（Phase 1）

| Strapi 组件 | Astro 组件 | 用途 |
|-------------|-----------|------|
| `sections.faq-group` | FaqGroup | FAQ 手风琴 |
| `sections.comparison-table` | ComparisonTable | 产品对比 |
| `sections.statistics` | Statistics | 数据统计 |
| `sections.cta-banner` | CtaBanner | 增强型 CTA |

---

## 7. SEO 架构

### 7.1 SEO 字段来源（优先级递减）

```
Entry-level SEO (Page/Product/Category seo_*)
  → Category SEO (Product 回退)
    → Site seo_default_*
      → Global metadata
        → 硬编码 fallback
```

### 7.2 自动生成项（Astro 构建时）

| 项目 | 生成方式 | Phase |
|------|---------|-------|
| `<title>` + meta | SEO.astro 组件 | ✅ |
| OG + Twitter Card | SEO.astro 组件 | ✅ |
| hreflang (9 语言) | SEO.astro 组件 | ✅ |
| Canonical URL | SEO.astro 组件 | ✅ |
| XML Sitemap | @astrojs/sitemap | ✅ |
| JSON-LD Structured Data | structuredData.ts | Phase 1 |
| robots.txt | 动态生成 endpoint | Phase 1 |
| 内部链接 | internalLinks.ts | Phase 1 |

---

## 8. 分阶段路线

| Phase | 名称 | 产出 |
|-------|------|------|
| **1** | SEO 基础设施 | Keyword Cluster, FAQ, JSON-LD, 内部链接, robots.txt |
| **2** | GEO 优化 | GEO 问答组件, QAPage 结构化数据 |
| **3** | AI 自动化 | AI API 客户端, Prompt 管理, 批量生成 SEO/GEO/FAQ |
| **4** | 高级功能 | Webhook 实发, pSEO 规模化, 知识图谱 |
