# Related Products Block Implementation Specification

Version: 1.0

Status: New Feature

Target Stack:

* Strapi v5
* PostgreSQL
* Astro
* Multi-Site Architecture

---

# 1. Objective

Implement a reusable Related Products Block.

Purpose:

Allow any page type to display related products.

Supported page types:

* Product Detail Page
* Category Page
* SEO Landing Page
* GEO Page
* Blog Article
* Custom Landing Page

The implementation must support:

* Manual Product Selection
* Automatic Product Selection
* Hybrid Selection

The solution must scale to:

* 500+ Products
* 5,000+ Pages
* Multiple Websites

without requiring manual maintenance for every page.

---

# 2. Design Principles

The Related Products feature must NOT be hardcoded.

Bad Example:

```text
Page
 ├─ Product A
 ├─ Product B
 └─ Product C
```

This does not scale.

Instead:

```text
Page
 └─ Related Products Block

Related Products Block
 ├─ Mode
 ├─ Rules
 ├─ Filters
 └─ Display Settings
```

Rendering logic determines which products are displayed.

---

# 3. Strapi Component

Create a reusable component.

Component Name:

```text
shared.related-products
```

Category:

```text
Shared
```

---

# 4. Component Schema

```typescript
title: string

mode: enum

manual_products: relation(Product[])

category_filter: relation(Category)

tag_filters: string[]

limit: integer

sort_by: enum

show_description: boolean

show_cta: boolean
```

---

# 5. Field Definitions

## title

Type:

```typescript
string
```

Purpose:

Frontend section title.

Example:

```text
Related Products

Recommended Products

Popular Fitness Equipment
```

Default:

```text
Related Products
```

---

## mode

Type:

```typescript
enum
```

Values:

```text
manual
category
tag
hybrid
```

Required.

---

## manual_products

Type:

```typescript
many-to-many
```

Target:

```text
Product
```

Only used when:

```text
manual
hybrid
```

---

## category_filter

Type:

```typescript
relation
```

Target:

```text
Product Category
```

Used when:

```text
category
hybrid
```

---

## tag_filters

Type:

```typescript
JSON Array
```

Example:

```json
[
  "treadmill",
  "commercial",
  "gym"
]
```

Used when:

```text
tag
hybrid
```

---

## limit

Type:

```typescript
integer
```

Default:

```text
6
```

Allowed:

```text
1-20
```

---

## sort_by

Type:

```typescript
enum
```

Values:

```text
featured
newest
alphabetical
manual_priority
```

Default:

```text
featured
```

---

## show_description

Type:

```typescript
boolean
```

Default:

```text
true
```

---

## show_cta

Type:

```typescript
boolean
```

Default:

```text
true
```

---

# 6. Product Model Requirements

Existing Product model should support:

```typescript
name

slug

category

featured

createdAt
```

Optional:

```typescript
tags
```

If tags do not exist yet:

Create:

```typescript
tags: string[]
```

---

# 7. Supported Modes

---

# Mode 1

Manual

Purpose:

Editor manually selects products.

Configuration:

```text
mode = manual
```

Example:

```text
Product A
Product B
Product C
```

Output:

Exactly those products.

No automatic logic.

---

# Mode 2

Category

Purpose:

Automatically load products from category.

Configuration:

```text
mode = category

category_filter = Treadmill
```

Query:

```sql
SELECT *
FROM products
WHERE category = treadmill
ORDER BY featured DESC
LIMIT 6
```

Output:

Products from selected category.

---

# Mode 3

Tag

Purpose:

Automatically load products by tags.

Configuration:

```json
{
  "mode": "tag",
  "tag_filters": [
    "commercial",
    "gym"
  ]
}
```

Logic:

Find products matching one or more tags.

Order by relevance.

Limit results.

---

# Mode 4

Hybrid

Purpose:

Combine manual selection with automation.

Configuration:

```text
mode = hybrid

manual_products = [A, B]

limit = 6
```

Logic:

Step 1

Load manual products.

```text
A
B
```

Step 2

Determine remaining slots.

```text
6 - 2 = 4
```

Step 3

Fill remaining slots using:

Category Filter

or

Tag Filter

Step 4

Remove duplicates.

Final output:

```text
A
B
C
D
E
F
```

---

# 8. Dynamic Zone Integration

The component must be reusable.

Allowed in:

```text
Product Page

SEO Page

GEO Page

Blog Page

Landing Page
```

Implementation:

```typescript
Dynamic Zone

content_blocks[]
```

Add:

```text
shared.related-products
```

as a block option.

---

# 9. Astro Frontend Component

Create:

```text
src/components/content/RelatedProducts.astro
```

Purpose:

Render all Related Product blocks.

---

# 10. Astro Props

```typescript
interface Props {
  block: RelatedProductsBlock
}
```

---

# 11. Product Query Service

Create:

```text
src/lib/relatedProducts.ts
```

Export:

```typescript
getRelatedProducts()
```

---

Function Responsibilities

Handle:

```text
manual

category

tag

hybrid
```

selection logic.

The Astro component should not contain business logic.

---

# 12. Rendering Rules

Desktop:

```text
4 products per row
```

Tablet:

```text
2 products per row
```

Mobile:

```text
1 product per row
```

---

# 13. Product Card

Create reusable component:

```text
ProductCard.astro
```

Fields:

```text
Image

Product Name

Short Description

View Details Button
```

---

# 14. Empty State

If no products found:

Render nothing.

Do not show:

```text
No products found
```

Avoid SEO issues.

---

# 15. Future Compatibility

The implementation must be compatible with future:

```text
SEO Pages

GEO Pages

Keyword Cluster Pages

AI Generated Pages

Programmatic Landing Pages
```

without requiring schema changes.

---

# 16. Performance Requirements

The component must:

* Use server-side queries
* Avoid duplicate product requests
* Limit maximum products to 20
* Cache requests when possible

---

# 17. Definition of Done

Feature is complete when:

✓ Strapi has reusable component

✓ Component available in Dynamic Zones

✓ Manual mode works

✓ Category mode works

✓ Tag mode works

✓ Hybrid mode works

✓ Astro component renders correctly

✓ Product cards reusable

✓ Works on all page types

✓ No SEO/GEO dependency

✓ Ready for future content expansion

End of Specification

```
```
