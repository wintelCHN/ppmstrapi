# B2B CMS — Strapi 5 项目指南

> **最后更新**: 2026-07-02 | **Strapi 版本**: 5.x（`@strapi/content-manager` 5.49.0）

## 项目概览

| 项目 | 值 |
|------|-----|
| **框架** | Strapi 5 Community Edition |
| **运行时** | Node.js v24.16.0 |
| **语言** | TypeScript |
| **包管理** | pnpm（`pnpm-lock.yaml` + `pnpm-workspace.yaml`） |
| **本地路径** | `D:\www\b2bos\b2bcms` |
| **GitHub** | [wintelCHN/ppmstrapi](https://github.com/wintelCHN/ppmstrapi) |
| **生产部署** | Railway (`https://ppm.productsb2b.com`) |
| **数据库** | PostgreSQL |
| **图片存储** | Cloudflare R2 (S3 兼容) → CDN `cdn.productsb2b.com` |
| **Astro 前端** | 独立仓库 [wintelCHN/ppsites2026](https://github.com/wintelCHN/ppsites2026)，本地路径 `D:\www\b2bos\b2b_frontend` |
| **n8n 工作流** | 本地运维/自动化工作流仓库，路径 `D:\www\b2bos\n8n` |
| **API 合同** | [`docs/strapi_api_contract.md`](docs/strapi_api_contract.md) |

---

## 本地开发

### 环境要求
- PostgreSQL 18（本地服务 `postgresql-x64-18`）
- Node.js v24.16.0
- pnpm

### 启动 PostgreSQL
```powershell
sc query postgresql-x64-18
Start-Service postgresql-x64-18
"D:/Program Files/PostgreSQL/18/bin/pg_isready" -h 127.0.0.1 -p 5432
```

### 启动 Strapi
```bash
cd D:/www/b2bos/b2bcms
pnpm develop
```
访问: `http://localhost:1339/admin`（`config/server.ts` 默认端口 1337，本地 `.env` 覆盖为 1339）

### npm/pnpm 脚本

| 命令 | 说明 |
|------|------|
| `pnpm develop` | 开发模式 |
| `pnpm start` | 生产模式（`prestart` 先执行 `ensure-sequences.js`） |
| `pnpm build` | TypeScript 编译 |
| `pnpm migrate-to-r2` | 本地文件迁移到 R2（支持 `-- --dry` 预览） |
| `pnpm migrate-tags` | 将 `tags_json_deprecated` 迁移为 Tag 关系 |
| `pnpm migrate-seo-to-component` | 将 flat SEO 字段迁移到 `metadata` 组件 |

---

## 部署与基础设施

### Strapi — Railway

| 项目 | 值 |
|------|-----|
| **平台** | [Railway](https://railway.app) |
| **项目/服务** | `Strapi` / `ppmstrapi` + `Postgres` |
| **生产 URL** | `https://ppm.productsb2b.com` |
| **部署方式** | Git auto-deploy from `main` |
| **构建命令** | `pnpm build` |
| **启动命令** | `pnpm start` → `prestart` (`ensure-sequences.js`) → `strapi start` |

**Railway CLI 操作**:
```bash
railway link -p Strapi -e production --service ppmstrapi
railway variables list -s ppmstrapi
```

> 生产数据库凭证、R2 Token、Admin JWT 等全部通过 Railway 环境变量注入，见 `.env.example`。

### Astro 前端 — Vercel

- 仓库: [wintelCHN/ppsites2026](https://github.com/wintelCHN/ppsites2026)
- 本地路径: `D:\www\b2bos\b2b_frontend`（已加入 `.gitignore`，不并入本仓库）
- 包管理: pnpm + Turborepo
- 已上线站点: `proneofishing.com`、`proneohunting.com`

前端构建详情见前端仓库文档。

### n8n 工作流 — 运维自动化

- 本地路径: `D:\www\b2bos\n8n`
- 用途: 产品采集、图片处理、Strapi 写入、失败告警、定时运维等工作流
- 对接 Strapi: 主要调用 `/api/products/create-with-images`、`/api/alert/failure` 等自定义端点
- 安全边界: 使用专用 `N8N_API_TOKEN` 或对应环境变量，不把 Admin JWT、R2 Secret、数据库密码写入工作流导出文件或文档

Strapi、Astro、n8n 是三个相互配合但独立管理的本地仓库；创建、调试或提交工作流时，需要分别确认相关仓库的 Git 状态和环境变量。

### Cloudflare R2 图片存储

| 项目 | 说明 |
|------|------|
| **Provider** | `@strapi/provider-upload-aws-s3` (S3 兼容 API) |
| **Bucket** | `b2bcmsimg` |
| **CDN 域名** | `https://cdn.productsb2b.com` |
| **切换方式** | `UPLOAD_PROVIDER` 环境变量：`local` / `aws-s3` |

**关键文件**:
- [`config/plugins.ts`](config/plugins.ts) — upload 配置与 provider 切换
- [`config/middlewares.ts`](config/middlewares.ts) — CSP `img-src`/`media-src` 允许 CDN；CORS 允许前端域名

> ⚠️ **R2 Token 类型**: R2 API Token 是 32 字符 hex Access Key ID + 64 字符 hex Secret Key，不是 Cloudflare 通用 API Token（`cfat_` 前缀）。Token 值存在 `.env`/Railway 环境变量，**不要写入源码或文档**。

### PostgreSQL 序列管理

`database/migrations/*.sql` 不会被 Strapi 5 自动执行。`scripts/ensure-sequences.js` 通过 `prestart` 钩子自动检查/创建所需序列。

| 序列名 | 用途 |
|--------|------|
| `product_sku_seq` | Product SKU 自增 `PPN-XXXXXX` |

---

## 内容模型

当前共有 **14 个内容类型**。

### 核心内容类型

| 内容类型 | API UID | i18n | draftAndPublish | 关键说明 |
|----------|---------|------|-----------------|----------|
| **Site** | `api::site.site` | 否 | 是 | `site_name`、`slug`、`lifecycle_state`（系统管理，hidden）、`is_published`（用户控制）、`metadata`、`site_layout`（1:1） |
| **SiteLayout** | `api::site-layout.site-layout` | 是 | 否 | Header、Navigation（2 级树）、Footer、Favicon、NotificationBanner；与 Site 1:1 |
| **Category** | `api::category.category` | 是 | 是 | 自引用层级（parent/children）、`metadata`、反向 products |
| **Product** | `api::product.product` | 是 | 是 | SKU 自动生成、slug 去重、images/videos 非本地化、`source_url`（n8n 去重键）、`supplier_name`、`product_schema`（结构化数据）、`desc_img`/`desc_video`、`tags` M:N、`tags_json_deprecated` 遗留字段 |
| **Page** | `api::page.page` | 是 | 是 | `page_title`、`slug`、Dynamic Zone（15 种组件）、`metadata` |
| **Blog** | `api::blog.blog` | 是 | 是 | `title`、`slug`、`content`（richtext）、`featured_image`、`metadata` |
| **News** | `api::news.news` | 是 | 是 | 同 Blog，复数端点 `/api/news-articles` |
| **Lead** | `api::lead.lead` | 否 | 否 | 询盘中心，24 字段，含 UTM、IP/UA 捕获；自定义公开端点 |
| **Global** | `api::global.global` | 是 | 否 | 单例；系统级 SEO 默认值 + 搜索引擎验证令牌 |
| **FAQ** | `api::faq.faq` | 是 | 是 | `items`（repeatable `elements.faq-item`） |
| **Tag** | `api::tag.tag` | 是 | 是 | 标签云、相关标签、相关产品；Admin TagTools 管理 |
| **Author** | `api::author.author` | 是 | 是 | 作者信息、`social_links`；被 Blog/News 的 `article-meta` 组件引用 |
| **Organization** | `api::organization.organization` | 是 | 是 | 站点级公司/品牌主体；通过 Site 关联；用于 Organization JSON-LD 与 Knowledge Graph |
| **Keyword Cluster** | `api::keyword-cluster.keyword-cluster` | 是 | 是 | 关键词聚类，关联 Page |

### 关键 lifecycle 行为

| CT | Hooks | 功能 |
|----|-------|------|
| Site | beforeCreate/beforeUpdate | 强制 `lifecycle_state='development'`，更新时防止清空 |
| SiteLayout | beforeCreate/afterUpdate | 1:1 唯一性校验、触发 webhook |
| Category | beforeCreate/beforeUpdate | slug 自动生成、`metadata.priority=0.9` |
| Product | beforeCreate/beforeUpdate/afterUpdate | SKU 序列、slug 去重、EN 复制、tags_json_deprecated 桥接、webhook |
| Page/Blog/News/FAQ/Tag/Author | beforeCreate/beforeUpdate/afterUpdate 或部分 | slug/status 同步、metadata 默认值、webhook |

### 已废弃类型
- ~~Menu / MenuItem / Footer~~ — 2026-06-17 已删除，功能由 SiteLayout 替代。

### Product i18n 复制
非 EN locale 创建时，从 English 版本复制 `name`、`short_description`、`Specification`、`description` 作占位，SEO 字段通过 `metadata` 组件处理。

---

## 目录结构

```text
b2bcms/
├── .env                          # 环境变量（gitignore）
├── .env.example
├── AGENTS.md                     # 本文件
├── docs/                         # 本地文档（gitignore）
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── tsconfig.json
├── config/                       # Strapi 配置
│   ├── server.ts, admin.ts, database.ts
│   ├── api.ts, middlewares.ts, plugins.ts
├── src/
│   ├── index.ts                  # 入口
│   ├── bootstrap.ts              # Public 权限自动配置、视图同步、status 迁移
│   ├── admin/
│   │   ├── app.tsx               # Admin 入口（ES2023 polyfills）
│   │   └── pages/
│   │       ├── TagTools/         # 标签管理工具
│   │       └── ProductBatch/     # 产品批量修改
│   ├── api/                      # 14 个内容类型
│   ├── components/               # 可复用组件 schema
│   │   ├── meta/                 # metadata
│   │   ├── elements/             # feature, testimonial, plan, faq-item, product-schema, ...
│   │   ├── layout/               # site-header, nav-item, nav-sub-item, site-footer
│   │   ├── links/                # link, button, button-link
│   │   ├── sections/             # hero, rich-text, lead-form, feature-*, testimonials, pricing, faq-group, ...
│   │   └── shared/               # related-products, faq-reference
│   └── extensions/
└── scripts/
    ├── ensure-sequences.js       # PostgreSQL 序列检查/创建
    ├── migrate-to-r2.js          # 本地文件迁移到 R2
    ├── migrate-tags.js           # 标签迁移
    ├── migrate-seo-to-component.js
    └── setup-translate-provider.js
```

---

## 插件与权限

### 启用插件

| 插件 | 说明 |
|------|------|
| `@strapi/plugin-users-permissions` | Public 角色自动配置 |
| `@strapi/plugin-graphql` | 已安装 |
| `@strapi/provider-upload-aws-s3` | R2 (S3-compatible) 上传 provider |
| `strapi-plugin-translate` | DeepSeek AI Provider（`DEEPSEEK_API_KEY`） |
| `pg` | PostgreSQL 驱动 |
| `jsonwebtoken` | 自定义端点 Admin JWT 验证 |
| `nodemailer` | Lead 通知与告警邮件 |

### Public API 权限

`src/bootstrap.ts` 每次启动自动为 Public 角色开放以下 13 个内容类型的 `find` + `findOne`：

`Site`、`Category`、`Product`、`Page`、`Global`、`Blog`、`News`、`SiteLayout`、`Keyword Cluster`、`Tag`、`FAQ`、`Author`、`Organization`。

Lead 使用自定义公开端点 `POST /api/public/lead`，不在标准权限体系中。

---

## Webhook

`src/api/shared/webhook.ts` 统一触发构建 webhook。

### 触发内容类型
Page、Blog、News、SiteLayout、FAQ、Product、Tag、Author。

### 行为
- `afterUpdate` 时触发（Strapi 5 CE 无 `afterPublish`，发布流程同样触发 `afterUpdate`）
- 读取关联 Site 的 `build_webhook`
- 发送真实 HTTP POST，10 秒超时，fire-and-forget
- 站点级 cooldown 防抖：2 分钟内同一站点多次更新只触发一次；失败时清除 cooldown 允许重试

---

## 自定义 API 与开发模式

### 自定义端点速查

| 端点 | 方法 | 说明 | 核心文件 |
|------|------|----------|----------|
| `/api/products/batch-update` | POST | 批量改 site/category/MOQ | `src/api/product/controllers/product.ts` |
| `/api/products/create-with-images` | POST | n8n 产品采集；支持 imageBase64 / imageUrls / multipart；`source_url` 去重 | `src/api/product/controllers/product.ts` |
| `/api/public/lead` | POST | 公开询盘提交 | `src/api/lead/controllers/lead.ts` |
| `/api/leads/export` | GET | CSV 导出 | `src/api/lead/controllers/lead.ts` |
| `/api/alert/failure` | POST | n8n 工作流失败告警邮件 | `src/api/alert/controllers/alert.ts` |
| `/api/tags/cloud` | GET | Tag 云（公开） | `src/api/tag/controllers/tag.ts` |
| `/api/tags/by-slug/:slug` | GET | 按 slug 查 tag（公开） | `src/api/tag/controllers/tag.ts` |
| `/api/tags/:slug/products` | GET | 分页产品（公开） | `src/api/tag/controllers/tag.ts` |
| `/api/tags/merge` | POST | 合并标签（需认证） | `src/api/tag/controllers/tag.ts` |
| `/api/tags/statistics` | GET | 统计（需认证） | `src/api/tag/controllers/tag.ts` |
| `/api/tags/suggest-duplicates` | GET | 重复建议（需认证） | `src/api/tag/controllers/tag.ts` |

### Strapi 5 自定义端点认证

content-api 路由默认执行 users-permissions JWT 认证，与 Admin JWT 密钥不同。Admin-only 自定义端点的可行方案：

```typescript
// 路由配置
config: { auth: false, policies: [] }

// 控制器内联验证
import jwt from 'jsonwebtoken'

const authHeader = ctx.request.header.authorization
if (!authHeader?.startsWith('Bearer ')) return reject(ctx, 401, 'Missing credentials')
try {
  const secret = strapi.config.get<string>('admin.auth.secret')
  jwt.verify(authHeader.split(' ')[1], secret)
} catch { return reject(ctx, 401, 'Invalid credentials') }
```

> ⚠️ `type: 'admin'` 在 API 级路由不生效；`src/api/*/policies/` 自定义 policy 不会被自动加载。

### useFetchClient 双重包装

Strapi Admin 的 `useFetchClient` 已将响应包装为 `{ data: ... }`。自定义控制器应直接返回数据对象，**不要**再包一层 `{ data: ... }`。

### createWithImages 去重

创建前按 `source_url` 查询已有产品：
- 已存在：返回 `200` + `_skipped: true` + `_reason`，不创建新记录
- 新创建：返回 `{ data: {...}, _imageResults: [...] }`

---

## 已知限制与注意事项

1. **Strapi 5 CE lifecycle 限制**: 不支持 `afterPublish`，发布流程通过 `afterUpdate` 覆盖。
2. **`.sql` 迁移不自动执行**: Strapi 5 不会自动运行 `database/migrations/*.sql`，需通过 `ensure-sequences.js` 处理。
3. **tags_json_deprecated 遗留字段**: Product 保留旧 JSON 标签字段作为迁移桥；运行 `pnpm migrate-tags` 完成后应清理相关 lifecycle 代码。
4. **SEO 组件迁移收尾**: `migrate-seo-to-component.js` 用于将 flat SEO 字段迁移到 `metadata` 组件；迁移完成后应删除旧字段引用。
5. **console.log**: `src/admin/app.tsx` 仍保留调试用 `console.log(app)`，生产前应清理。
6. **pnpm 迁移**: `pnpm-lock.yaml` 与 `pnpm-workspace.yaml` 已生成但尚未提交，需验证构建与部署。

---

## 安全提醒

- **不要**在源码或文档中硬编码数据库密码、R2 Token、Admin JWT、SMTP 密码或 n8n 集成 Token。
- 所有生产凭证应仅存于 `.env`/Railway 环境变量。
- n8n 集成使用专用 `N8N_API_TOKEN`（`product.ts`、`blog.ts`、`alert.ts` 的 `verifyToken` 已同步支持），不要把 `ADMIN_JWT_SECRET` 或 `API_TOKEN_SALT` 当作 Bearer token 直接使用。
- 若此前 `ADMIN_JWT_SECRET` 或 `API_TOKEN_SALT` 曾被当作 n8n 的 Bearer token 使用，建议轮换这些 secret 并改用 `N8N_API_TOKEN`。

---

## 变更摘要

### 近期重点

| Phase | 时间 | 主题 |
|-------|------|------|
| Phase 6 | 2026-06-22 | R2 存储 + Railway 部署 + `ensure-sequences.js` |
| Phase 7 | 2026-06-23 | Product Batch 批量修改 + Admin 页面 |
| Phase 8 | 2026-06-25 | n8n 集成：`createWithImages` 去重、告警端点 |
| Phase 9 | 2026-06-26 | Astro 前端 SEO/CWV/结构化数据/FAQ/内部链接 |
| — | 2026-06-26~07-02 | Site 状态拆分为 `lifecycle_state` + `is_published`；pnpm 工程化迁移；webhook cooldown 防抖 |

### 已完成扩展
- FAQ、Tag、Author、Keyword Cluster 内容类型
- Related Products 增强、FaqReference、内部链接引擎
- Tag Tools Admin 页面

### 待开发（规划）
- Phase F: GEO 优化（`llms.txt`、实体标记）
- Phase G: AI 内容自动化
- Phase H: 程序化 SEO 规模化

> 详细前端变更见 `D:\www\b2bos\b2b_frontend` 仓库文档；详细后端历史变更可另建 `docs/CHANGELOG.md`（本地，不入 git）。
