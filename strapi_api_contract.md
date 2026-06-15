# Strapi API Contract — Astro 前端数据对接规范

> **版本**: 1.1 | **更新**: 2026-06-15 | **Strapi 版本**: 5.47.1 CE

---

## 目录

1. [概览](#1-概览)
2. [环境变量与请求规范](#2-环境变量与请求规范)
3. [API 响应格式](#3-api-响应格式)
4. [内容类型](#4-内容类型)
   - [4.1 Global (全局配置)](#41-global-全局配置)
   - [4.2 Page (页面)](#42-page-页面)
   - [4.3 Category (分类)](#43-category-分类)
   - [4.4 Product (产品)](#44-product-产品)
   - [4.5 Site (站点)](#45-site-站点)
   - [4.6 Blog (博客文章)](#46-blog-博客文章)
   - [4.7 News (新闻)](#47-news-新闻)
5. [Dynamic Zone Section 类型](#5-dynamic-zone-section-类型)
6. [组件规范](#6-组件规范)
7. [媒体对象](#7-媒体对象)
8. [SEO 字段规范](#8-seo-字段规范)
9. [分页规范](#9-分页规范)
10. [本地化 (i18n) 规范](#10-本地化-i18n-规范)
11. [Astro 数据层实现指南](#11-astro-数据层实现指南)
12. [计划中的内容类型](#12-计划中的内容类型)
13. [路由生成规则](#13-路由生成规则)

---

## 1. 概览

Strapi 作为 B2B 外贸营销系统的数据中台，集中管理产品数据、页面数据和站点配置。Astro 前端在构建时通过 Strapi REST API 拉取所有业务数据，生成静态页面。

**核心原则**：

- 所有业务内容（产品、文案、导航、SEO）必须来自 Strapi
- Astro 组件可以渲染布局骨架，但不得硬编码业务数据
- 构建时拉取全量数据，生成完整的静态站点
- 未发布的条目（`publishedAt` 为 null）不出现在生产构建中

---

## 2. 环境变量与请求规范

### 2.1 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `STRAPI_URL` | 是 | Strapi 服务基地址，**不含尾部斜杠**。示例: `http://localhost:1337` |
| `STRAPI_API_TOKEN` | 是 | Strapi API Token（只读权限），用于 Content API 认证 |
| `PUBLIC_SITE_URL` | 是 | 站点公开 URL，用于 canonical URL、Open Graph URL、sitemap URL、hreflang |

### 2.2 请求规范

每个 Strapi 请求必须：

```
GET <STRAPI_URL>/api/<pluralName>?locale=<lang>&populate=*&pagination[pageSize]=100

Headers:
  Authorization: Bearer <STRAPI_API_TOKEN>
```

- 使用 `STRAPI_URL` 作为基地址
- 发送 `Authorization: Bearer ${STRAPI_API_TOKEN}` 请求头
- **始终**携带 `locale` 查询参数
- 使用 `populate=*` 获取完整的关联数据（媒体、关系、组件、动态区域）
- 集合请求使用 `pagination[pageSize]=100`（最大允许值）

### 2.3 状态过滤器

只拉取已发布的内容（草稿不应出现在生产站点）：

```
GET /api/sites?filters[$and][0][publishedAt][$notNull]=true
GET /api/categories?filters[$and][0][publishedAt][$notNull]=true&locale=en
GET /api/products?filters[$and][0][publishedAt][$notNull]=true&locale=en
GET /api/pages?filters[$and][0][publishedAt][$notNull]=true&locale=en
GET /api/blogs?filters[$and][0][publishedAt][$notNull]=true&locale=en
GET /api/news-articles?filters[$and][0][publishedAt][$notNull]=true&locale=en
```

说明：
- Strapi 5 的 `draftAndPublish` 开启后，未发布条目的 `publishedAt` 为 `null`
- `Global` 的 `draftAndPublish` 为 `false`，无需此过滤器
- Product、Blog、News 的 `status` 字段（draft/published[/archived]）是**独立的业务状态**，需额外过滤

含 `status` 业务状态的完整过滤器：

```
# Product（需同时满足 publishedAt + status=published，排除 archived）
GET /api/products?filters[$and][0][publishedAt][$notNull]=true&filters[$and][1][status][$eq]=published&locale=en&populate=*

# Blog（需同时满足 publishedAt + status=published）
GET /api/blogs?filters[$and][0][publishedAt][$notNull]=true&filters[$and][1][status][$eq]=published&locale=en&populate=*

# News（同上）
GET /api/news-articles?filters[$and][0][publishedAt][$notNull]=true&filters[$and][1][status][$eq]=published&locale=en&populate=*
```

---

## 3. API 响应格式

### 3.1 集合响应 (Collection Response)

```typescript
interface StrapiCollectionResponse<T> {
  data: Array<{
    id: number              // 自增数字 ID
    documentId: string      // 文档 UUID（Strapi 5 新增）
    locale?: string         // 当前 locale
    ...T                    // 扁平化的字段（Strapi 5 无 attributes 嵌套）
  }>
  meta: {
    pagination: {
      page: number
      pageSize: number
      pageCount: number
      total: number
    }
  }
}
```

**关键点**：Strapi 5 响应是**扁平化**的，字段直接在 `data[i]` 上，不再嵌套在 `attributes` 中。

### 3.2 单条响应 (Single Entry Response)

```typescript
interface StrapiSingleResponse<T> {
  data: {
    id: number
    documentId: string
    locale?: string
    ...T
  } | null
  meta: {}
}
```

### 3.3 单例响应 (Single Type Response — Global)

```typescript
interface StrapiSingleTypeResponse<T> {
  data: {
    id: number
    documentId: string
    locale?: string
    ...T
  } | null
  meta: {}
}
```

---

## 4. 内容类型

### 4.1 Global (全局配置)

**端点**: `GET /api/global?locale=<lang>&populate=*`

**类型**: Single Type（每个 locale 只有一条记录）

**draftAndPublish**: `false`（始终可用，无需 publishedAt 过滤）

**i18n**: 已启用

| 字段 | 类型 | i18n | 必填 | 说明 |
|------|------|------|------|------|
| `metadata` | component `meta.metadata` | localized | 是 | 站点级默认 SEO 元数据 |
| `metaTitleSuffix` | string | localized | 是 | 页面标题后缀，如 ` | B2B Company` |
| `favicon` | media (single, images) | localized | 否 | 站点 favicon |
| `notificationBanner` | component `elements.notification-banner` | localized | 否 | 全局通知横幅 |
| `navbar` | component `layout.navbar` | localized | 否 | 全局导航栏 |
| `footer` | component `layout.footer` | localized | 否 | 全局页脚 |

**Astro 使用方式**：

- 每个语言构建时拉取对应 locale 的 Global 数据
- `metadata` + `metaTitleSuffix` → 站点级 SEO 默认值
- `navbar` + `footer` → 全局布局组件（Header/Footer）
- `favicon` → `<link rel="icon">`
- `notificationBanner` → 全局通知条

**响应示例** (`locale=en`)：

```json
{
  "data": {
    "id": 1,
    "documentId": "abc123",
    "locale": "en",
    "metadata": {
      "id": 1,
      "metaTitle": "B2B Manufacturing Company",
      "metaDescription": "Premium manufacturing solutions for global buyers",
      "shareImage": {
        "id": 10,
        "documentId": "img10",
        "url": "/uploads/og_default_abc.jpg",
        "alternativeText": "Company logo",
        "width": 1200,
        "height": 630,
        "mime": "image/jpeg",
        "formats": { /* 缩略图集 */ }
      },
      "twitterCardType": "summary_large_image",
      "twitterUsername": "@company"
    },
    "metaTitleSuffix": " | B2B Company",
    "favicon": { "id": 2, "url": "/uploads/favicon_abc.ico", "mime": "image/x-icon", "width": 32, "height": 32 },
    "navbar": { /* layout.navbar 组件 */ },
    "footer": { /* layout.footer 组件 */ },
    "notificationBanner": null
  },
  "meta": {}
}
```

---

### 4.2 Page (页面)

**端点**: `GET /api/pages?locale=<lang>&populate=*&filters[publishedAt][$notNull]=true&filters[status][$eq]=published`

**类型**: Collection Type

**draftAndPublish**: `true`（需过滤 `publishedAt` 非空）

**i18n**: 已启用

| 字段 | 类型 | i18n | 必填 | 说明 |
|------|------|------|------|------|
| `shortName` | string | localized | 否 | Admin 中的人类可读识别名 |
| `slug` | string (自定义正则) | **不** localized | 是 | URL 路径段，正则 `^$|^[a-zA-Z/-]+$`（空字符串=首页） |
| `status` | enum: draft/published | **不** localized | 否 | 业务状态，默认 `draft` |
| `metadata` | component `meta.metadata` | localized | 是 | 页面级 SEO |
| `contentSections` | dynamiczone | localized | 否 | 页面内容区域（动态区域） |
| `site` | relation manyToOne → Site | — | 否 | 所属站点 |

**Dynamic Zone 可用组件**（详见 [§5](#5-dynamic-zone-section-类型)）：

| Section | 组件名 | 用途 |
|---------|--------|------|
| Hero | `sections.hero` | 主视觉横幅 |
| Bottom Actions | `sections.bottom-actions` | 底部 CTA 操作区 |
| Feature Columns | `sections.feature-columns-group` | 特性卡片列 |
| Feature Rows | `sections.feature-rows-group` | 特性行列表 |
| Testimonials | `sections.testimonials-group` | 客户评价组 |
| Large Video | `sections.large-video` | 大视频嵌入 |
| Rich Text | `sections.rich-text` | 富文本块 |
| Pricing | `sections.pricing` | 定价方案表 |
| Lead Form | `sections.lead-form` | 询盘表单（仅展示，不处理提交） |

**`status` 字段**: `draft` | `published`。生产构建需同时满足 `publishedAt != null` **且** `status == 'published'`。

**`slug` 字段**: 自定义字符串，支持空字符串（首页）和带 `/` 的路径（如 `about/team`）。不是自动生成的 `uid` 类型。

**Astro 使用方式**：

- 路由：`/<slug>`（slug 为空时渲染为首页 `/`）
- 非默认语言：`/<lang>/<slug>`
- `contentSections` → 遍历渲染，按数组顺序输出，未知 section 类型安全跳过并记录警告
- `metadata` → 页面级 `<head>` SEO
- SEO fallback：Page SEO → Site `seo_default_*` → Global `metadata`

**Webhook**: `afterUpdate` lifecycle → `logBuildWebhook(strapi, 'api::page.page', documentId)`。当前仅记录日志。

**响应示例** (省略 fields):

```json
{
  "data": [
    {
      "id": 1,
      "documentId": "page1",
      "locale": "en",
      "shortName": "About Us",
      "slug": "about-us",
      "metadata": { /* meta.metadata */ },
      "contentSections": [
        { "__component": "sections.hero", "id": 1, "title": "About Us", "description": "...", /* ... */ },
        { "__component": "sections.rich-text", "id": 2, "content": "<p>Our story...</p>" },
        { "__component": "sections.bottom-actions", "id": 3, /* ... */ }
      ]
    }
  ],
  "meta": { "pagination": { "page": 1, "pageSize": 100, "pageCount": 1, "total": 5 } }
}
```

---

### 4.3 Category (分类)

**端点**: `GET /api/categories?locale=<lang>&populate=*&filters[publishedAt][$notNull]=true`

**类型**: Collection Type，支持自引用层级

**draftAndPublish**: `true`

**i18n**: 已启用

| 字段 | 类型 | i18n | 必填 | 说明 |
|------|------|------|------|------|
| `name` | string | localized | 是 | 分类名称 |
| `slug` | uid (from name) | **不** localized | 自动 | URL 标识，跨语言共享 |
| `description` | text | localized | 否 | 分类描述 |
| `seo_title` | string | localized | 否 | SEO 标题 |
| `seo_description` | text | localized | 否 | SEO 描述 |
| `seo_keywords` | text | localized | 否 | SEO 关键词 |
| `site` | relation manyToOne → Site | — | 否 | 所属站点 |
| `parent` | relation manyToOne → Category | — | 否 | 父分类（自引用） |
| `children` | relation oneToMany → Category | — | — | 子分类（反向） |
| `products` | relation oneToMany → Product | — | — | 该分类下的产品（反向） |

**Strapi 5 关系响应格式**：

```json
{
  "site": {
    "data": { "id": 1, "documentId": "site1", "slug": "main-site", "name": "Main Site" }
  },
  "parent": {
    "data": null
  },
  "children": {
    "data": [
      { "id": 3, "documentId": "cat3", "slug": "sub-cat", "name": "Sub Category" }
    ]
  },
  "products": {
    "data": [
      { "id": 10, "documentId": "prod10", "slug": "widget-x", "name": "Widget X" }
    ]
  }
}
```

**Astro 使用方式**：

- 构建分类树：遍历 `categories`，按 `parent` 关系组装层级
- 路由：`/products/<slug>`、`/<lang>/products/<slug>`
- 面包屑：通过 `parent` 链向上遍历到根
- SEO：优先使用 Category 自身的 SEO 字段，fallback 到 Site 默认值

---

### 4.4 Product (产品)

**端点**: `GET /api/products?locale=<lang>&populate=*&filters[publishedAt][$notNull]=true&filters[status][$eq]=published`

**类型**: Collection Type

**draftAndPublish**: `true`

**i18n**: 已启用

| 字段 | 类型 | i18n | 必填 | 说明 |
|------|------|------|------|------|
| `name` | string | localized | 是 | 产品名称 |
| `slug` | uid (from name) | **不** localized | 自动 | URL 标识，跨语言共享 |
| `sku` | string | **不** localized | 是 | 产品 SKU 编码 |
| `model_no` | string | **不** localized | 否 | 型号 |
| `description` | blocks (rich text) | localized | 否 | 产品详情（富文本 Blocks） |
| `images` | media (multiple, images) | localized | 否 | 产品图片集 |
| `videos` | media (multiple, videos) | localized | 否 | 产品视频集 |
| `price` | decimal | **不** localized | 否 | 价格 |
| `currency` | string | **不** localized | 否 | 货币代码，默认 `USD` |
| `moq` | integer | **不** localized | 否 | 最小起订量 (Minimum Order Quantity) |
| `status` | enum: draft/published/archived | **不** localized | 否 | **业务状态**，默认 `draft` |
| `seo_title` | string | localized | 否 | SEO 标题 |
| `seo_description` | text | localized | 否 | SEO 描述 |
| `seo_keywords` | text | localized | 否 | SEO 关键词 |
| `category` | relation manyToOne → Category | — | 否 | 所属分类 |

**`status` 字段说明**：

- 这是**独立的业务状态字段**，与 Strapi 的 `draftAndPublish` (publishedAt) 机制并列
- 取值：`draft` | `published` | `archived`
- 生产构建需同时满足：`publishedAt != null` **且** `status == 'published'`
- `archived` 状态的产品不应出现在任何列表或详情页

**`description` 字段说明**：

- 类型为 Strapi 5 的 `blocks`（结构化富文本），非纯 HTML 字符串
- Block JSON 结构示例：

```json
[
  { "type": "paragraph", "children": [{ "type": "text", "text": "Product description..." }] },
  { "type": "heading", "level": 2, "children": [{ "type": "text", "text": "Features" }] },
  { "type": "list", "format": "unordered", "children": [/* ... */] },
  { "type": "image", "image": { "id": 20, "url": "/uploads/desc_abc.jpg", "alternativeText": "detail" } }
]
```

Astro 需要 block renderer 将 `blocks` JSON 转换为 HTML。

**Product → Site 访问路径**：

Product **不直接**关联 Site。查询路径为：

```
Product → category → site
```

即先通过 `product.category` 获取 Category，再通过 `category.site` 获取 Site。

**Astro 使用方式**：

- 路由：`/products/<category_slug>/<product_slug>`（通过 `category.slug` 构建 URL）
- `category.data` 为 null 的产品 → 不能生成产品详情路由（记录警告）
- 产品列表页按分类过滤：`GET /api/products?...&filters[category][slug][$eq]=<cat_slug>`
- 图片 gallery：`images` 数组按 Strapi 顺序渲染
- 价格 + 货币代码始终配对显示
- SEO fallback：Product SEO → Category SEO → Site `seo_default_*` → Global `metadata`

---

### 4.5 Site (站点)

**端点**: `GET /api/sites?populate=*&filters[publishedAt][$notNull]=true`

**类型**: Collection Type

**draftAndPublish**: `true`

**i18n**: **未启用**（Site 是站点级配置，不需要多语言）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 站点名称 |
| `slug` | uid (from name) | 自动 | URL 标识 |
| `description` | text | 否 | 站点描述 |
| `status` | enum: development/active/inactive | 自动 | **系统管理**，lifecycle hook 自动设置，Admin UI 不可见 |
| `primary_domain` | string | 否 | 主域名 |
| `secondary_domains` | json | 否 | 附加域名数组，如 `["example.net", "example.org"]` |
| `deploy_platform` | enum: vercel/cloudflare-pages/netlify | 否 | 部署平台 |
| `github_repo` | string | 否 | GitHub 仓库地址 |
| `github_branch` | string | 否 | 部署分支，默认 `main` |
| `build_webhook` | string | 否 | 构建触发 Webhook URL |
| `preview_url` | string | 否 | 预览地址 |
| `production_url` | string | 否 | 生产地址 |
| `astro_project_name` | string | 否 | 关联的 Astro 项目名 |
| `seo_default_title` | string | 否 | 站点级默认 SEO 标题 |
| `seo_default_description` | text | 否 | 站点级默认 SEO 描述 |
| `seo_default_keywords` | text | 否 | 站点级默认 SEO 关键词 |
| `notes` | blocks | 否 | 内部备注（富文本 Blocks） |
| `categories` | relation oneToMany → Category | — | 反向关系，该站点下的所有分类 |
| `blogs` | relation oneToMany → Blog | — | 反向关系，该站点下的所有博客文章 |
| `news_articles` | relation oneToMany → News | — | 反向关系，该站点下的所有新闻 |
| `pages` | relation oneToMany → Page | — | 反向关系，该站点下的所有自定义页面 |

**注意**：`blogs` 和 `news_articles` 的 API 响应中字段名与 relation 名一致（即 `blogs` 和 `news_articles`），不是 `blog`/`news`。

**`status` 字段说明**（重要）：

- `status` 由 `lifecycles.ts` 自动管理：
  - `beforeCreate`：强制设为 `development`
  - `beforeUpdate`：若传入空值则删除该字段（保留数据库原值）
- Admin UI 中该字段不可见（系统管理字段）
- Astro **不应**依赖 `status` 做路由决策，仅用于 Dashboard 信息展示
- 生产构建使用 `publishedAt` 过滤，不使用 `status`

**Site 响应中关系字段的格式**（Strapi 5）：

```json
{
  "categories": {
    "data": [
      { "id": 1, "documentId": "cat1", "slug": "electronics", "name": "Electronics" }
    ]
  },
  "blogs": {
    "data": []
  },
  "news_articles": {
    "data": []
  }
}
```

**Astro 使用方式**：

- 单站点场景：可以硬编码目标 Site slug，只拉取匹配的那条
- 多站点场景：按 `primary_domain` 匹配当前构建目标
- SEO fallback 链：Entry SEO → Category SEO → Site `seo_default_*` → Global `metadata`
- `secondary_domains` 用于生成 redirect 规则或 canonical URL 判断

---

### 4.6 Blog (博客文章)

**端点**: `GET /api/blogs?locale=<lang>&populate=*&filters[publishedAt][$notNull]=true&filters[status][$eq]=published`

**类型**: Collection Type

**draftAndPublish**: `true`

**i18n**: 已启用

| 字段 | 类型 | i18n | 必填 | 说明 |
|------|------|------|------|------|
| `title` | string | localized | 是 | 文章标题 |
| `slug` | uid (from title) | **不** localized | 自动 | URL 标识，跨语言共享 |
| `content` | blocks | localized | 否 | 富文本正文（Strapi 5 blocks 格式） |
| `featured_image` | media (single, images) | localized | 否 | 封面图 |
| `seo_title` | string | localized | 否 | SEO 标题 |
| `seo_description` | text | localized | 否 | SEO 描述 |
| `seo_keywords` | text | localized | 否 | SEO 关键词 |
| `status` | enum: draft/published | **不** localized | 否 | 默认 `draft` |
| `site` | relation manyToOne → Site | — | 否 | 所属站点 |

**`status` 字段**: `draft` | `published`。生产构建需同时满足 `publishedAt != null` **且** `status == 'published'`。

**响应示例** (`locale=en`, 单条)：

```json
{
  "data": {
    "id": 1,
    "documentId": "blog1",
    "locale": "en",
    "title": "How to Source from China",
    "slug": "how-to-source-from-china",
    "content": [
      { "type": "paragraph", "children": [{ "type": "text", "text": "Sourcing from China..." }] }
    ],
    "featured_image": {
      "id": 20,
      "documentId": "img20",
      "url": "/uploads/blog_cover_abc.jpg",
      "alternativeText": "Factory workshop",
      "width": 1200,
      "height": 630,
      "mime": "image/jpeg",
      "formats": { /* 缩略图 */ }
    },
    "seo_title": "How to Source from China — Complete Guide",
    "seo_description": "A comprehensive guide for B2B buyers",
    "seo_keywords": "China sourcing, B2B procurement",
    "status": "published",
    "site": {
      "data": { "id": 1, "documentId": "site1", "slug": "main-site", "name": "Main Site" }
    }
  },
  "meta": {}
}
```

**Astro 使用方式**:
- 路由: `/blog/<slug>`, `/<lang>/blog/<slug>`
- 博客列表页按 `publishedAt:desc` 排序
- SEO fallback: Blog SEO → Site `seo_default_*` → Global `metadata`
- `content` 为 Strapi 5 blocks 格式，需要 block renderer 转换为 HTML

**Webhook**: `afterUpdate` lifecycle → `logBuildWebhook(strapi, 'api::blog.blog', documentId)`。当前仅记录日志，不实际发送 HTTP 请求。

---

### 4.7 News (新闻)

**端点**: `GET /api/news-articles?locale=<lang>&populate=*&filters[publishedAt][$notNull]=true&filters[status][$eq]=published`

**类型**: Collection Type

**draftAndPublish**: `true`

**i18n**: 已启用

**端点说明**: Strapi 要求 `pluralName` 与 `singularName` 不同，"news" 同时是单复数会冲突。因此配置为 `singularName: "news"`, `pluralName: "news-articles"`, `collectionName: "news_articles"`，API 路径为 `/api/news-articles`（**非** `/api/news`）。

| 字段 | 类型 | i18n | 必填 | 说明 |
|------|------|------|------|------|
| `title` | string | localized | 是 | 新闻标题 |
| `slug` | uid (from title) | **不** localized | 自动 | URL 标识，跨语言共享 |
| `content` | blocks | localized | 否 | 富文本正文（Strapi 5 blocks 格式） |
| `featured_image` | media (single, images) | localized | 否 | 封面图 |
| `seo_title` | string | localized | 否 | SEO 标题 |
| `seo_description` | text | localized | 否 | SEO 描述 |
| `seo_keywords` | text | localized | 否 | SEO 关键词 |
| `status` | enum: draft/published | **不** localized | 否 | 默认 `draft` |
| `site` | relation manyToOne → Site | — | 否 | 所属站点 |

字段结构与 Blog 完全一致。`status` 字段同 Blog：生产构建需同时满足 `publishedAt != null` **且** `status == 'published'`。

**Site 关系字段名**: Site schema 中反向关系字段名为 `news_articles`（匹配 `collectionName`），使用 `populate[news_articles]=*` 查询。

**响应示例** (`locale=en`, 单条)：

```json
{
  "data": {
    "id": 2,
    "documentId": "news1",
    "locale": "en",
    "title": "New Factory Expansion in Shenzhen",
    "slug": "new-factory-expansion-shenzhen",
    "content": [
      { "type": "paragraph", "children": [{ "type": "text", "text": "We are pleased to announce..." }] }
    ],
    "featured_image": {
      "id": 25,
      "documentId": "img25",
      "url": "/uploads/news_factory_abc.jpg",
      "alternativeText": "New factory building",
      "width": 1200,
      "height": 630,
      "mime": "image/jpeg",
      "formats": { /* 缩略图 */ }
    },
    "seo_title": "New Factory Expansion in Shenzhen — Company News",
    "seo_description": "Announcing our new 50,000 sqm manufacturing facility",
    "seo_keywords": "factory expansion, manufacturing news",
    "status": "published",
    "site": {
      "data": { "id": 1, "documentId": "site1", "slug": "main-site", "name": "Main Site" }
    }
  },
  "meta": {}
}
```

**Astro 使用方式**:
- 路由: `/news/<slug>`, `/<lang>/news/<slug>`
- 新闻列表页按 `publishedAt:desc` 排序
- SEO fallback: News SEO → Site `seo_default_*` → Global `metadata`
- `content` 为 Strapi 5 blocks 格式，需要 block renderer 转换为 HTML

**Webhook**: `afterUpdate` lifecycle → `logBuildWebhook(strapi, 'api::news.news', documentId)`。当前仅记录日志，不实际发送 HTTP 请求。

---

## 5. Dynamic Zone Section 类型

Page 的 `contentSections` 是 Dynamic Zone，可包含以下 section。每个 section 通过 `__component` 字段区分类型。

### 5.1 sections.hero

```typescript
interface SectionHero {
  __component: "sections.hero"
  id: number
  title: string | null
  label: string | null                    // 小标签文本
  description: string | null
  picture: StrapiMedia | null             // 主图
  smallTextWithLink: string | null        // 富文本（含链接）
  buttons: StrapiButtonLink[]             // 按钮组
}
```

### 5.2 sections.rich-text

```typescript
interface SectionRichText {
  __component: "sections.rich-text"
  id: number
  content: string | null                  // HTML 富文本
}
```

### 5.3 sections.lead-form

```typescript
interface SectionLeadForm {
  __component: "sections.lead-form"
  id: number
  title: string | null
  emailPlaceholder: string | null
  submitButton: StrapiButton | null
  location: string | null
}
```

**注意**：Astro **仅渲染表单 UI**，不实现提交逻辑。表单 `action` 留空或指向占位符，供后续嵌入第三方表单。

### 5.4 sections.feature-columns-group

```typescript
interface SectionFeatureColumnsGroup {
  __component: "sections.feature-columns-group"
  id: number
  features: StrapiFeatureColumn[]         // 多列特性卡片
}
```

### 5.5 sections.feature-rows-group

```typescript
interface SectionFeatureRowsGroup {
  __component: "sections.feature-rows-group"
  id: number
  features: StrapiFeatureRow[]            // 行式特性列表
}
```

### 5.6 sections.testimonials-group

```typescript
interface SectionTestimonialsGroup {
  __component: "sections.testimonials-group"
  id: number
  testimonials: StrapiTestimonial[]       // 客户评价
}
```

### 5.7 sections.bottom-actions

```typescript
interface SectionBottomActions {
  __component: "sections.bottom-actions"
  id: number
  title: string | null
  buttons: StrapiButtonLink[]
}
```

### 5.8 sections.large-video

```typescript
interface SectionLargeVideo {
  __component: "sections.large-video"
  id: number
  // TODO: 具体字段待补充（当前 schema 未详查）
}
```

### 5.9 sections.pricing

```typescript
interface SectionPricing {
  __component: "sections.pricing"
  id: number
  plans: StrapiPlan[]                     // 定价方案列表
}
```

### Section 处理规则

- **按 `contentSections` 数组顺序**渲染，不做重排
- **未知 `__component` 类型**：跳过并 `console.warn`，不阻塞构建
- **空 section**（所有字段为 null/空数组）：跳过不渲染
- **`id` 字段**：可用于 React/Vue 的 `key` prop 或 anchor link

---

## 6. 组件规范

### 6.1 meta.metadata

所有 SEO 相关页面（Global、Page）共用的元数据组件：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | number | 自动 | 组件实例 ID |
| `metaTitle` | string | 是 | SEO 页面标题 |
| `metaDescription` | text | 是 | SEO 页面描述 |
| `shareImage` | media (single, images) | 否 | Open Graph / Twitter 分享图 |
| `twitterCardType` | enum: summary/summary_large_image/app/player | 否 | 默认 `summary` |
| `twitterUsername` | string | 否 | Twitter 用户名 |

### 6.2 layout.navbar

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | number | 自动 | |
| `logo` | media (single, images) | 是 | 导航栏 Logo |
| `links` | component `links.link` (repeatable) | 否 | 导航链接列表 |
| `button` | component `links.button-link` | 否 | 导航栏 CTA 按钮（单个） |

### 6.3 layout.footer

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | number | 自动 | |
| `logo` | media (single, images) | 否 | 页脚 Logo |
| `columns` | component `elements.footer-section` (repeatable) | 否 | 页脚链接分组 |
| `smallText` | string | 否 | 版权文本 |

### 6.4 links.link

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | number | 自动 | |
| `url` | string | 是 | 链接目标 |
| `text` | string | 是 | 链接文本 |
| `newTab` | boolean | 否 | 是否新窗口打开，默认 `false` |

### 6.5 links.button-link

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | number | 自动 | |
| `url` | string | 否 | 按钮跳转 URL |
| `text` | string | 否 | 按钮文本 |
| `type` | enum: primary/secondary | 否 | 按钮样式变体 |
| `newTab` | boolean | 否 | 是否新窗口打开，默认 `false` |

### 6.6 elements.footer-section

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | number | 自动 | |
| `title` | string | 否 | 分组标题，如 "Products"、"Company" |
| `links` | component `links.link` (repeatable) | 否 | 该分组的链接列表 |

### 6.7 elements.notification-banner

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | number | 自动 | |
| `text` | richtext | 否 | 通知内容（富文本） |
| `type` | enum: alert/info/warning | 是 | 通知类型 |

---

## 7. 媒体对象

Strapi 返回的媒体对象（来自 `plugin::upload.file`）：

```typescript
interface StrapiMedia {
  id: number
  documentId: string
  name: string
  url: string                            // 相对路径，如 "/uploads/product_abc.jpg"
  alternativeText: string | null         // SEO alt 文本
  caption: string | null
  width: number | null
  height: number | null
  mime: string                           // 如 "image/jpeg", "video/mp4"
  size: number                           // 字节数
  formats: {                             // 自动生成的缩略图
    thumbnail?: StrapiImageFormat
    small?: StrapiImageFormat
    medium?: StrapiImageFormat
    large?: StrapiImageFormat
  } | null
}

interface StrapiImageFormat {
  url: string
  width: number
  height: number
  size: number
  mime: string
}
```

### 7.1 媒体 URL 规范化

Astro 数据层必须将相对 URL 转换为绝对 URL：

```typescript
function normalizeMediaUrl(strapiUrl: string, baseUrl: string): string {
  if (!strapiUrl) return ''
  if (strapiUrl.startsWith('http://') || strapiUrl.startsWith('https://')) {
    return strapiUrl
  }
  return `${baseUrl.replace(/\/$/, '')}${strapiUrl}`
}
```

- `image.url` → `${STRAPI_URL}${url}`
- `image.formats.thumbnail.url` → `${STRAPI_URL}${url}`
- `alt` 取 `alternativeText`，为空时取 `name`，仍为空时设为 `''`

### 7.2 缺失媒体处理

- `images` 为 null/undefined → 归一化为 `[]`
- 单张图片字段为 null → 归一化为 `null`
- 缺失图片不阻塞组件渲染，使用占位布局

---

## 8. SEO 字段规范

### 8.1 当前 SEO 模型（平面字段）

当前内容类型使用**平面 SEO 字段**（非嵌套对象）：

- `seo_title` | `seo_default_title`: string
- `seo_description` | `seo_default_description`: text
- `seo_keywords` | `seo_default_keywords`: text

加上 `meta.metadata` 组件包含 `shareImage` 和 `twitterCardType`。

### 8.2 SEO 数据归一化

Astro 数据层应将分散的 SEO 字段归一化为统一接口：

```typescript
interface NormalizedSeo {
  metaTitle: string
  metaDescription: string
  metaKeywords: string
  ogTitle: string
  ogDescription: string
  ogImage: string | null            // 绝对 URL
  twitterTitle: string
  twitterDescription: string
  twitterImage: string | null       // 绝对 URL
  twitterCardType: 'summary' | 'summary_large_image' | 'app' | 'player'
  structuredData: object | null     // 未来扩展
}
```

### 8.3 SEO Fallback 链

```
Page/Category/Product 自身 SEO 字段
  → Category SEO 字段（适用于 Product）
    → Site seo_default_* 字段
      → Global.metadata 字段
        → 硬编码 fallback（站点名称等）
```

### 8.4 自动生成项（不由 Strapi 管理）

- **Canonical URL**: Astro 根据 `PUBLIC_SITE_URL` + 路由自动生成
- **hreflang URL**: Astro 根据 locale 列表 + 路由自动生成
- **JSON-LD**: 有 `structuredData` 时使用，否则 Astro 根据内容类型自动生成（Product → Product schema, Article → Article schema）

---

## 9. 分页规范

### 9.1 配置

| 参数 | 值 |
|------|-----|
| 默认 pageSize | `25` |
| 最大 pageSize | `100` |
| withCount | `true` |

### 9.2 全量数据拉取

静态站点生成需要全量数据。推荐**分页循环**获取所有记录：

```typescript
async function fetchAllPages<T>(endpoint: string, params: URLSearchParams): Promise<T[]> {
  const all: T[] = []
  let page = 1
  let pageCount = 1

  while (page <= pageCount) {
    params.set('pagination[page]', String(page))
    const res = await fetch(`${STRAPI_URL}/api/${endpoint}?${params}`)
    if (!res.ok) return all  // 优雅降级
    const json = await res.json()
    all.push(...json.data)
    pageCount = json.meta.pagination.pageCount
    page++
  }

  return all
}
```

### 9.3 排序

Strapi 5 默认按 `id` 排序。需要指定排序时使用：

```
GET /api/products?sort=createdAt:desc
GET /api/categories?sort=name:asc
```

**注意**：当前内容模型中没有显式的 `sortOrder` 字段。如需手动排序，应在 Strapi Admin 中为相关类型添加 `sortOrder: integer` 字段。

---

## 10. 本地化 (i18n) 规范

### 10.1 核心规则

| 规则 | 说明 |
|------|------|
| 默认语言 | `en`（英语） |
| 默认语言路由 | **不使用**语言前缀，如 `/products/widget-x` |
| 非默认语言路由 | 使用 `/<lang>` 前缀，如 `/zh/products/widget-x` |
| Slug 策略 | **共享 slug**（跨语言共用），由 `uid` 字段自动生成 |
| 查询方式 | `locale=<lang>` 查询参数 |
| Fallback | 本地化内容缺失时，回退到英文内容 |

### 10.2 支持的语言

当前 i18n 插件已启用，具体语言列表通过 Strapi Admin 配置（Settings → Internationalization）。

标配语言（参考）：
- `en` — 英语（默认）
- `zh` — 中文
- 根据需要扩展：`es`, `ar`, `fr`, `pt`, `ru`, `ja`, `ko` 等

### 10.3 字段本地化状态

| 内容类型 | Localized 字段 | Non-localized 字段 |
|----------|---------------|-------------------|
| Global | metadata, metaTitleSuffix, favicon, notificationBanner, navbar, footer | — |
| Page | shortName, metadata, contentSections | slug, status, site |
| Category | name, description, seo_* | slug, site, parent |
| Product | name, description, images, videos, seo_* | slug, sku, model_no, price, currency, moq, status, category |
| Blog | title, content, featured_image, seo_* | slug, status, site |
| News | title, content, featured_image, seo_* | slug, status, site |
| Site | （不适用，无 i18n） | 所有字段 |

### 10.4 Fallback 实现

```typescript
async function fetchLocalized<T>(endpoint: string, lang: string, documentId: string): Promise<T | null> {
  // 先尝试目标语言
  const res = await fetch(`${STRAPI_URL}/api/${endpoint}/${documentId}?locale=${lang}&populate=*`)
  if (res.ok) {
    const json = await res.json()
    if (json.data) return json.data
  }

  // Fallback 到英语
  if (lang !== 'en') {
    const fallbackRes = await fetch(`${STRAPI_URL}/api/${endpoint}/${documentId}?locale=en&populate=*`)
    if (fallbackRes.ok) {
      const json = await fallbackRes.json()
      return json.data ?? null
    }
  }

  return null
}
```

---

## 11. Astro 数据层实现指南

### 11.1 推荐目录结构

```
src/
├── lib/
│   └── strapi/
│       ├── client.ts          # HTTP 客户端（fetch wrapper）
│       ├── endpoints.ts       # 端点常量
│       ├── normalizer.ts      # 响应归一化
│       ├── types.ts           # Strapi 响应类型定义
│       └── queries/
│           ├── global.ts      # fetchGlobal(locale)
│           ├── pages.ts       # fetchAllPages(locale)
│           ├── categories.ts  # fetchAllCategories(locale)
│           ├── products.ts    # fetchAllProducts(locale)
│           ├── blogs.ts       # fetchAllBlogs(locale)
│           ├── news.ts        # fetchAllNews(locale)
│           └── site.ts        # fetchSite(slug)
```

### 11.2 客户端基础实现

```typescript
// src/lib/strapi/client.ts
const STRAPI_URL = import.meta.env.STRAPI_URL
const STRAPI_API_TOKEN = import.meta.env.STRAPI_API_TOKEN

interface FetchOptions {
  locale?: string
  filters?: Record<string, unknown>
  populate?: string
  sort?: string
  pageSize?: number
}

export async function strapiFetch<T>(
  endpoint: string,
  params: Record<string, string> = {}
): Promise<{ data: T[]; meta: { pagination: StrapiPagination } }> {
  const url = new URL(`${STRAPI_URL}/api/${endpoint}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
    },
  })

  if (!res.ok) {
    console.error(`[Strapi] ${endpoint} returned ${res.status}`)
    return { data: [], meta: { pagination: { page: 1, pageSize: 100, pageCount: 0, total: 0 } } }
  }

  return res.json()
}
```

### 11.3 错误处理策略

| 场景 | 行为 |
|------|------|
| 集合请求失败 | 返回 `[]`，记录错误日志 |
| 单条请求失败 | 返回 `null`，记录错误日志 |
| Global 单例请求失败 | 返回 fallback 默认对象 |
| 媒体 URL 404 | 使用占位图或跳过渲染 |
| 未知 section 类型 | 跳过，`console.warn` |
| 网络超时 | 重试 2 次，仍失败则优雅降级 |

### 11.4 构建数据流

```
Astro Build Start
  ├── fetchGlobal(locale)           → Global 单例
  ├── fetchSite(domain)             → Site 配置
  ├── fetchAllPages(locale)         → Page[] (含 contentSections)
  ├── fetchAllCategories(locale)    → Category[] (构建树)
  ├── fetchAllProducts(locale)      → Product[] (按 category 分组)
  ├── fetchAllBlogs(locale)         → Blog[] (按 publishedAt 排序)
  ├── fetchAllNews(locale)          → News[] (按 publishedAt 排序)
  ├── 归一化所有响应
  ├── 生成路由
  │   ├── /pages/<slug>
  │   ├── /products/<category>/<product>
  │   ├── /products/<category>
  │   ├── /blog/<slug>
  │   ├── /news/<slug>
  │   └── /<lang>/...
  └── 渲染静态 HTML
```

---

## 12. 已取消的模块

以下模块曾在规划阶段考虑，但**已明确取消**，Astro 前端无需为其预留代码：

| 模块 | 取消原因 | 取消日期 |
|------|---------|---------|
| Site Template (站点模板) | 用户明确取消 | 2026-06-11 |
| Site Theme (站点主题) | 用户明确取消 | 2026-06-11 |

> 当前 Strapi 代码库中**不存在** `site-template` 和 `site-theme` 的 API 目录、schema 或路由。Astro 项目请勿依赖这些模块。

---

## 13. 路由生成规则

### 13.1 当前可用路由

| 内容类型 | 路由模式 | 条件 |
|----------|---------|------|
| Page | `/<slug>` | slug 非空字符串 |
| Page | `/<lang>/<slug>` | 同上，非默认语言 |
| Category | `/products/<slug>` | 有子分类或产品 |
| Category | `/<lang>/products/<slug>` | 同上 |
| Product | `/products/<category_slug>/<slug>` | category.data 非 null |
| Product | `/<lang>/products/<category_slug>/<slug>` | 同上 |
| Blog | `/blog/<slug>` | publishedAt ≠ null 且 status = published |
| Blog | `/<lang>/blog/<slug>` | 同上 |
| News | `/news/<slug>` | publishedAt ≠ null 且 status = published |
| News | `/<lang>/news/<slug>` | 同上 |

### 13.2 路由优先级（Astro 文件系统）

```
src/pages/
├── index.astro                  → /
├── [lang]/index.astro           → /<lang>
├── products/
│   ├── index.astro              → /products
│   ├── [category].astro         → /products/<category>
│   └── [category]/[slug].astro  → /products/<category>/<slug>
├── pages/[slug].astro           → /pages/<slug>
├── blog/[slug].astro            → /blog/<slug>
├── news/[slug].astro            → /news/<slug>
└── [lang]/...                   → 同等结构 + lang 前缀
```

### 13.3 `getStaticPaths` 实现要点

```typescript
// src/pages/products/[category]/[slug].astro
export async function getStaticPaths() {
  const products = await fetchAllProducts('en')

  return products
    .filter(p => p.category?.data?.slug)  // 必须有分类
    .map(p => ({
      params: {
        category: p.category.data.slug,
        slug: p.slug,
      },
    }))
}
```

---

## 附录 A: Strapi 5 变更要点（相对 Strapi 4）

| 变更 | 说明 |
|------|------|
| 扁平化响应 | 字段直接在 `data[i]` 上，不再有 `attributes` 嵌套 |
| `documentId` | 新增 UUID 格式的文档 ID，替代旧版数字 ID 做唯一标识 |
| `id` | 保留自增数字 ID，但推荐用 `documentId` 做查询 |
| Blocks 类型 | 新式结构化富文本，替代旧版 Richtext（HTML 字符串） |
| Lifecycle hooks | 仅支持标准 CRUD hooks（afterCreate/Update/Delete 等），无 afterPublish |
| Dynamic Zone | `__component` 字段标识组件类型 |

## 附录 B: 当前 Strapi 部署快照

| 项目 | 值 |
|------|-----|
| 版本 | Strapi 5.47.1 CE |
| 端口 | `1339` (开发) |
| 数据库 | PostgreSQL 18, `b2bcms` |
| i18n 插件 | 已启用 |
| GraphQL 插件 | 已安装 |
| Users & Permissions | 已安装，Public 角色只读 |
| Config: REST defaultLimit | 25 |
| Config: REST maxLimit | 100 |
