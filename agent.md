# B2B CMS Agent 工作指南

> 适用目录: `D:\www\b2bcms`  
> 更新时间: 2026-06-27  
> 目的: 帮助后续 AI agent / 开发协作者快速理解这个 Strapi + Astro 多站点 B2B 营销获客系统，并以正确边界修改代码。

## 1. 项目定位

这是一个面向 B2B 外贸营销获客的网站群系统。

- 后端: Strapi 5 CE，位于 `D:\www\b2bcms`，负责产品、页面、导航、SEO、FAQ、线索等结构化内容管理。
- 前端: Astro 5 monorepo，位于 `D:\www\b2bcms\astro_site`，用一套共享代码构建多个独立静态网站。
- 后端部署: Railway，生产域名 `https://ppm.productsb2b.com`。
- 前端部署: Vercel，每个 `apps/<site>` 是一个独立 Vercel 项目。
- 图片存储: Cloudflare R2，前端通过 CDN URL 直接渲染。
- 代码管理: Strapi 仓库和 Astro 仓库是两个 Git 仓库；`astro_site/` 已从 Strapi 仓库 `.gitignore` 排除。

核心原则:

- Strapi 是唯一内容源，Astro 只负责构建和渲染。
- 页面由结构化内容、关系和 Dynamic Zone 生成，不在前端硬编码业务内容。
- 每个网站通过 Site / SiteLayout / site filter 实现数据隔离。
- 生产站点只输出已发布内容，并结合业务 `status` 字段过滤。

## 2. 文档阅读优先级

后续接手前，优先按这个顺序看文档:

1. `CLAUDE.md`  
   最新项目总览，包含部署、内容模型、阶段记录、已知坑。注意其中可能包含敏感信息，不能复制到公开文档或提交记录。
2. `docs/dev-schema.md`  
   2026-06-26 之后的 Astro SEO、性能、结构化数据、FAQ、内部链接等 Phase A-E 开发总览。
3. `docs/strapi_api_contract.md`  
   Astro 前端对接 Strapi REST API 的合同，尤其是 Strapi 5 扁平响应、populate、i18n、发布过滤、路由生成。
4. `docs/design.md`  
   B2B 营销站点设计规范、主题系统、转化组件和上线流程。
5. `docs/B2B_Lead_Center.md`、`docs/Related_Products_Block.md`、`docs/r2.md`  
   分别对应询盘中心、关联产品块、R2/Railway 部署细节。

注意: `docs/05-reconciled-architecture.md` 是早期统一架构裁决，但部分内容已被后续实现覆盖。遇到冲突时，以 `CLAUDE.md`、`docs/dev-schema.md` 和实际代码为准。

## 3. 仓库与目录边界

Strapi 根目录:

```text
D:\www\b2bcms
├── config/                 # Strapi server/admin/database/api/middleware/plugins 配置
├── src/
│   ├── bootstrap.ts        # 启动时同步 Public 权限、Admin 视图配置、状态迁移
│   ├── admin/              # Strapi Admin 自定义页面: TagTools / ProductBatch
│   ├── api/                # Strapi content types、controllers、routes、services、lifecycles
│   └── components/         # Strapi components / Dynamic Zone schema
├── scripts/                # ensure-sequences、R2 迁移、标签迁移等脚本
├── database/migrations/    # SQL 迁移文件；Strapi 不会自动执行
├── docs/                   # 本地文档，不入 Strapi Git
└── astro_site/             # Astro monorepo，独立 Git 仓库，不入 Strapi Git
```

Astro monorepo:

```text
astro_site/
├── packages/
│   ├── cms/                # @cms/client: Strapi API client、types、queries、site resolver、link index
│   ├── ui/                 # @ui/components: layout、pages、sections、ui、SEO、schema、media
│   └── theme/              # @theme/core: 主题 token / preset
├── apps/
│   ├── proneofishing/      # proneofishing.com
│   └── proneohunting/      # proneohunting.com
└── pnpm-workspace.yaml
```

重要边界:

- 修改 Strapi 代码时在 `D:\www\b2bcms` 下运行 `npm`。
- 修改 Astro 代码时在 `D:\www\b2bcms\astro_site` 下运行 `pnpm`。
- 两个目录各有自己的 Git 状态，提交前必须分别检查。
- 不要把 `.env`、`CLAUDE.md` 中的密钥、管理员密码、R2 Secret、数据库密码写入新文档或提交信息。

## 4. 常用命令

Strapi:

```powershell
cd D:\www\b2bcms
npm run develop      # 本地开发，默认 http://localhost:1339/admin
npm run build        # Strapi build
npm run start        # 生产模式；prestart 会执行 ensure-sequences.js
npm run migrate-to-r2 -- --dry
npm run migrate-tags
```

Astro:

```powershell
cd D:\www\b2bcms\astro_site
pnpm dev
pnpm build
pnpm lint

cd D:\www\b2bcms\astro_site\apps\proneofishing
pnpm dev             # 单站点本地开发
```

PostgreSQL 本地服务:

```powershell
sc query postgresql-x64-18
Start-Service postgresql-x64-18
```

## 5. Strapi 内容模型概览

当前主要 content types:

- `site`: 站点配置，非 i18n。管理域名、部署平台、GitHub、Vercel webhook、SEO 默认值。`lifecycle_state` 是系统状态，`is_published` 是用户控制。
- `site-layout`: 站点外观，i18n，与 Site 1:1。统一管理 Header、Navigation、Footer、Favicon、Notification Banner。
- `category`: 产品分类，i18n，自引用层级，归属 Site。
- `product`: 产品，i18n。自动 SKU、自动 slug 去重、图片/视频跨语言共享、status 业务状态、site/category/tag/metadata/product_schema。
- `page`: 通用页面，i18n。使用 Dynamic Zone 管理营销页面内容。
- `blog` / `news`: 文章内容，i18n，带 status、featured image、SEO。
- `faq`: FAQ 内容，i18n，可被页面引用，也参与 FAQPage schema 和内部链接。
- `keyword-cluster`: 关键词集群，i18n，用于 SEO / GEO 内容体系。
- `tag`: 标签聚合页，i18n，支持 relatedtags。
- `author`: 作者，i18n，博客/新闻作者页。
- `global`: 全局单例，i18n，目前只保留系统级 SEO 默认值和站点名。
- `lead`: 询盘线索，非 i18n，公开提交端点和 Admin CSV 导出。
- `alert`: n8n 工作流失败告警端点。

已废弃:

- `menu`
- `menu-item`
- `footer`

导航和页脚必须走 `site-layout`，不要恢复旧模型。

## 6. Dynamic Zone 与前端映射

Strapi Page 的 `contentSections` 由 Astro `packages/ui/src/components/ui/DynamicZone.astro` 渲染。新增 Strapi Dynamic Zone 组件时，至少同步修改:

- Strapi component schema: `src/components/.../*.json`
- Page schema 的 `contentSections` 组件列表
- Astro 类型: `astro_site/packages/cms/src/types.ts`
- Astro section 组件: `astro_site/packages/ui/src/components/sections/*.astro`
- Dynamic Zone 注册表: `astro_site/packages/ui/src/components/ui/DynamicZone.astro`
- 相关页面或测试构建

当前已注册的 section 包括:

- `sections.hero`
- `sections.rich-text`
- `sections.lead-form`
- `sections.feature-columns-group`
- `sections.feature-rows-group`
- `sections.testimonials-group`
- `sections.bottom-actions`
- `sections.large-video`
- `sections.pricing`
- `sections.faq-group`
- `sections.comparison-table`
- `sections.statistics`
- `sections.cta-banner`
- `shared.related-products`
- `shared.faq-reference`

## 7. API 与数据规则

Strapi 5 关键点:

- API 响应是扁平结构，没有 Strapi 4 的 `attributes` 包装。
- 使用 `documentId` 做文档级标识，不要依赖数字 `id` 做跨 API 关系传递。
- `populate=deep` 不可用，通常用 `populate=*` 或明确 populate 字段。
- Collection API 默认分页，前端全量构建时使用 `pagination[pageSize]=100` 并处理分页。
- i18n 内容请求必须带 `locale`。

生产构建过滤:

- 所有开启 Draft & Publish 的内容必须过滤 `publishedAt != null`。
- `product`、`blog`、`news`、`page`、`author` 等还要考虑业务 `status`。
- Product 生产可见通常要求 `publishedAt` 存在、`status = published`，并排除 archived。
- Site 还要考虑 `is_published`。

公开权限:

- `src/bootstrap.ts` 每次启动会给 Public role 自动配置只读权限。
- Public 角色只开放内容读取，不开放写入。
- Lead 提交走 `POST /api/public/lead`，是自定义公开端点。

## 8. Strapi 5 自定义端点模式

Strapi 5 CE 中，Admin-only 的自定义 content-api 端点不能依赖 `type: 'admin'` 或 API-level policy。项目当前约定:

- 路由设置 `config: { auth: false, policies: [] }`
- 控制器内部手动验证 Bearer token
- Admin 页面调用时用 Strapi Admin JWT
- n8n 集成可使用 Admin JWT / API Token / 共享 secret 的多模式验证
- Admin `useFetchClient` 会自动包一层 `{ data }`，自定义控制器返回业务对象时不要再手动包 `{ data: result }`

典型文件:

- `src/api/product/routes/product.ts`
- `src/api/product/controllers/product.ts`
- `src/api/product/services/product.ts`
- `src/admin/pages/ProductBatch/index.tsx`
- `src/api/alert/controllers/alert.ts`

## 9. Webhook 与构建触发

`src/api/shared/webhook.ts` 提供 `logBuildWebhook()`:

- 在内容更新的 `afterUpdate` lifecycle 里读取关联 Site。
- 如果 Site 配置了 `build_webhook`，就 fire-and-forget POST。
- 不等待 webhook 完成，不阻塞 Strapi Admin 响应。
- 超时时间 10 秒，只记录日志。

已接入的内容类型包括 Page、Blog、News、Product、FAQ、SiteLayout、Tag 等。由于 Strapi 5 lifecycle 没有 `afterPublish`，发布过程通常也会触发 `afterUpdate`，所以 webhook 依赖 `afterUpdate` 覆盖发布/编辑场景。

## 10. 产品采集与 n8n 集成

`POST /api/products/create-with-images` 支持三种图片输入:

- 推荐: `imageBase64`，n8n 用 BrightData 下载图片并 base64 传给 Strapi，避免 Railway 直接访问 Alibaba CDN。
- 遗留: `imageUrls`，Strapi 服务器直接下载 URL，有被 CDN 拦截风险。
- 遗留: multipart 直接上传。

关键行为:

- 创建前按 `source_url` 去重。
- 命中重复时返回 `200`、`_skipped: true`，不是错误。
- 新建产品后上传图片到 Strapi upload provider，本地为 local，生产为 R2。
- `product_schema.brand` 默认补 `PRONEO`。
- SEO 兼容旧的平面 `seo_title` / `seo_description` / `seo_keywords`，会归一到 `metadata`。

告警端点:

- `POST /api/alert/failure`
- 复用 Lead 邮件配置，通过 nodemailer 发送 n8n 工作流失败通知。

## 11. 数据库与 R2 注意事项

PostgreSQL:

- 本地数据库名通常为 `b2bcms`，schema 为 `public`。
- `database/migrations/*.sql` 不会被 Strapi 自动执行。
- `product_sku_seq` 由 `scripts/ensure-sequences.js` 在 `prestart` 中检查/创建。
- 新增依赖数据库 sequence 的功能时，也要更新 `ensure-sequences.js`。

R2:

- 上传 provider 通过 `UPLOAD_PROVIDER` 切换 local / aws-s3。
- 生产使用 Cloudflare R2 S3-compatible provider。
- API 返回 CDN 绝对 URL 时，Astro `mediaUrl()` 直接透传。
- R2 Access Key / Secret 与 Cloudflare 通用 API Token 不是同一种东西。不要在文档和代码里硬编码密钥。

## 12. Astro 架构规则

Astro 是 SSG 静态构建:

- 每个 app 通过 `SITE_SLUG` / site resolver 找到对应 Site。
- `packages/cms` 是唯一 Strapi 数据访问层。
- `packages/ui` 放共享页面、布局、区块、基础 UI、SEO、JSON-LD、媒体工具。
- `packages/theme` 放主题 token / preset。
- `apps/<site>/src/pages` 只负责路由入口、数据组合和调用共享组件。

页面类型矩阵:

- `/` 首页
- `/[...slug]` CMS 通用页面
- `/products/[slug]` 产品详情
- `/categories/[slug]` 分类页
- `/blog/[slug]` 博客详情
- `/news/[slug]` 新闻详情
- `/tags/[slug]` 标签页
- `/keyword-clusters/[slug]` 关键词集群页
- `/faq/[...slug]` FAQ 页

SEO / 性能规则:

- 新页面必须接入 `BaseLayout`、`SEOTags`、canonical、robots、OG/Twitter、verification tokens。
- 需要结构化数据时使用 `JsonLd.astro` 和 `packages/ui/src/lib/schemas.ts`。
- noindex 页面要通过 `registerNoindex()` 进入 sitemap 排除逻辑。
- 图片 URL 通过 `mediaUrl()` / `productThumb()` 处理。
- 响应式布局优先使用 `DesktopOnly` / `MobileOnly` 双 DOM 模式。
- SSG 页面尽量保持零客户端 JS；需要交互时优先使用 HTML/CSS 原生能力。

## 13. B2B 设计与转化规则

设计以获客转化为目标:

- 首屏必须明确产品/行业/价值，不做空泛品牌展示。
- 产品、分类、解决方案页面要突出信任信号: 认证、参数、MOQ、交期、工厂能力、案例、FAQ、询盘入口。
- 不要做营销空话式 landing page；要做可用的产品/内容页面。
- 卡片、按钮、表单、CTA、FAQ、Related Products 要服务扫描、比较和询盘。
- 新站点设计遵循 `docs/design.md`，涉及 UI 打磨时优先使用项目已有 theme / UI 组件。

## 14. 修改代码前的检查清单

通用:

- 先看 `git status --short`，确认是否有用户未提交改动。
- 不要回滚或覆盖不是自己做的修改。
- 读相关 schema、controller、service、lifecycle、Astro 组件后再改。
- 新增/修改文档时不要泄露 `.env` 或 `CLAUDE.md` 里的密钥。

修改 Strapi 内容类型:

- schema 是否需要 i18n / draftAndPublish / pluginOptions。
- relation 的 `inversedBy` / `mappedBy` 是否指向真实字段。
- 是否需要 lifecycle 同步 slug、status、webhook。
- 是否需要更新 `src/bootstrap.ts` 的 Public 权限和 Admin 视图同步。
- 是否影响 Astro 类型、查询、路由或 Dynamic Zone 映射。

修改 Astro 页面:

- 是否按 Site 过滤。
- 是否处理 locale。
- 是否过滤 published/status。
- 是否接入 SEO、JSON-LD、breadcrumb、sitemap noindex。
- 是否处理媒体 URL、缺图 fallback。
- 是否兼容两个现有 app。

## 15. 验证建议

Strapi 变更:

```powershell
cd D:\www\b2bcms
npm run build
```

Astro 变更:

```powershell
cd D:\www\b2bcms\astro_site
pnpm build
```

涉及 UI 或页面布局:

- 启动对应 app 的 `pnpm dev`。
- 用桌面和移动视口检查首屏、导航、表单、产品卡、FAQ、CTA。
- 检查文本是否溢出、图片是否加载、交互是否可用。

涉及部署、远程 API、Railway、Vercel、R2、GitHub:

- 需要网络和凭据，执行前确认环境和权限。
- 不要把真实 token 打印到日志或写入文档。

## 16. 当前后续路线

已完成:

- Strapi 内容模型、Public API 权限、SiteLayout、Lead Center、R2/Railway、Product Batch、n8n createWithImages、告警端点。
- Astro Phase A-E: SEO 输出、Core Web Vitals、JSON-LD、Webhook 实发、Sitemap/Robots、FAQ、内部链接、Related Products 增强。

后续规划:

- Phase F: GEO 优化，面向 AI 搜索引擎的 `llms.txt`、实体标记、问答结构。
- Phase G: AI 内容自动化，批量生成 SEO/GEO 页面和内容块。
- Phase H: 程序化 SEO 规模化，Webhook/Vercel 重建、知识图谱和内容工厂扩展。

## 17. 给后续 agent 的简短提醒

- 这个系统不是单站点 CMS，而是一个多站点内容中台 + 静态站点工厂。
- 任何业务内容字段变更都可能同时影响 Strapi schema、Astro 类型、查询、页面、SEO、sitemap 和 webhook。
- SiteLayout 已替代 Menu/Footer；Global 只做系统级 SEO fallback。
- Product 的 `status` 和 Strapi 的 `publishedAt` 是两套状态，生产过滤必须同时考虑。
- 自定义 Admin-only content-api 端点使用 `auth:false + 控制器内联验证`。
- `astro_site/` 是独立仓库；在根仓库提交时不会包含它。
- 安全优先: 不传播密钥、不硬编码 token、不把本地私密文档内容原样复制到可提交文件。
