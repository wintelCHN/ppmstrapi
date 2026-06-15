# B2B Lead Center Implementation Specification

Version: 1.0

Status: Development

Target Stack:

* Strapi v5
* PostgreSQL
* Astro
* Multiple Sites
* One Shared Strapi Backend

---

# 1. Project Goal

Implement a centralized B2B Lead Center.

Current system already supports:

* Multiple Astro frontend websites
* One Strapi backend
* Shared content management

This task ONLY focuses on:

* Lead collection
* Lead storage
* Lead attribution
* Lead notification
* Lead management

This task DOES NOT include:

* SEO system
* GEO system
* Blog system
* Content generation
* CRM integration
* Marketing automation

The implementation must remain simple, maintainable, and scalable.

---

# 2. Business Requirements

All websites must submit inquiries into one centralized system.

Example:

```text
Site A
    \
Site B ----> Lead Center
    /
Site C
```

The business team must be able to:

* View all leads
* Filter leads by website
* Filter leads by date
* Filter leads by status
* Export leads
* Receive notifications for new inquiries

---

# 3. Architecture

## Existing Architecture

```text
Astro Sites
      │
      ▼
   Strapi
```

---

## New Architecture

```text
Astro Sites
      │
      ▼

Lead API Endpoint

      │
      ▼

Lead Validation

      │
      ▼

Strapi Lead Collection

      │
      ├── Admin Dashboard
      ├── Email Notification
      └── Export
```

---

# 4. Lead Data Model

Create a new collection type.

Collection Name:

Lead

---

## Fields

### Basic Information

```typescript
name: string
```

Required

---

```typescript
email: string
```

Required

---

```typescript
phone: string
```

Optional

---

```typescript
whatsapp: string
```

Optional

---

```typescript
company: string
```

Optional

---

```typescript
country: string
```

Optional

---

### Inquiry Information

```typescript
message: text
```

Required

---

```typescript
product_interest: string
```

Optional

---

```typescript
quantity: string
```

Optional

---

### Attribution Information

```typescript
site_id: string
```

Required

Purpose:

Identify which website generated the lead.

Example:

```text
proneofit
proneocamping
site001
```

---

```typescript
site_domain: string
```

Required

Example:

```text
proneofit.com
proneocamping.com
```

---

```typescript
page_url: string
```

Required

Example:

```text
/products/treadmill
/contact
```

---

```typescript
page_title: string
```

Optional

---

### Marketing Attribution

```typescript
utm_source: string
utm_medium: string
utm_campaign: string
utm_term: string
utm_content: string
```

All optional.

---

### Technical Information

```typescript
ip_address: string
```

Auto-generated

---

```typescript
user_agent: text
```

Auto-generated

---

### Lead Status

```typescript
status: enum
```

Values:

```text
new
contacted
qualified
closed_won
closed_lost
spam
```

Default:

```text
new
```

---

### Timestamps

Use Strapi built-in fields.

```text
createdAt
updatedAt
publishedAt
```

---

# 5. Lead Form Strategy

The system should support multiple form UIs.

However, all forms must submit to the same endpoint.

---

## Form Type A

Quick Inquiry

Fields:

```text
Name
Email
Message
```

---

## Form Type B

RFQ Form

Fields:

```text
Name
Email
Company
Product
Quantity
Message
```

---

## Form Type C

Contact Form

Fields:

```text
Name
Email
Phone
Company
Message
```

---

All form types must submit using the same API contract.

---

# 6. API Endpoint

Create a public API endpoint.

Route:

```http
POST /api/public/lead
```

Purpose:

Accept lead submissions from Astro websites.

---

# 7. Request Payload

```json
{
  "name": "John Smith",

  "email": "john@example.com",

  "phone": "+1 888888888",

  "company": "ABC Corp",

  "country": "USA",

  "message": "Please send quotation.",

  "product_interest": "Commercial Treadmill",

  "quantity": "500",

  "site_id": "proneofit",

  "site_domain": "proneofit.com",

  "page_url": "/products/treadmill",

  "page_title": "Commercial Treadmill",

  "utm_source": "google",

  "utm_medium": "organic",

  "utm_campaign": "manufacturer"
}
```

---

# 8. Validation Rules

Server-side validation required.

---

## Name

Required

Minimum length:

```text
2
```

---

## Email

Required

Must be valid email format.

---

## Message

Required

Minimum length:

```text
10
```

---

## Site ID

Required

---

## Site Domain

Required

---

If validation fails:

```http
400 Bad Request
```

---

# 9. Spam Protection

Implement basic anti-spam measures.

---

## Honeypot Field

Frontend:

```html
<input
 name="website"
 style="display:none"
/>
```

If populated:

```text
Reject Submission
```

---

## Rate Limiting

Limit:

```text
5 requests
per IP
per 10 minutes
```

---

# 10. Lead Creation Flow

```text
User submits form

        │

        ▼

Validate Payload

        │

        ▼

Spam Check

        │

        ▼

Create Lead

        │

        ▼

Return Success
```

---

# 11. Response Format

Success

```json
{
  "success": true,
  "message": "Lead submitted successfully."
}
```

---

Validation Error

```json
{
  "success": false,
  "message": "Invalid email address."
}
```

---

Server Error

```json
{
  "success": false,
  "message": "Internal server error."
}
```

---

# 12. Email Notification

When a lead is created:

Send notification email.

---

Email Subject

```text
New Lead Received
```

---

Email Content

```text
Name

Email

Company

Country

Message

Site

Page URL

Created Time
```

---

Notification recipients should be configurable via environment variables.

Example:

```env
LEAD_NOTIFY_EMAIL=sales@example.com
```

---

# 13. Strapi Admin Requirements

Business users must be able to:

---

## List Leads

Columns:

```text
Created At
Name
Email
Company
Country
Site
Status
```

---

## Search Leads

Search by:

```text
Name
Email
Company
```

---

## Filter Leads

Filter by:

```text
Status
Site
Date Range
```

---

## Edit Lead

Business users can update:

```text
Status
Notes
```

---

# 14. Lead Notes

Create field:

```typescript
internal_notes: text
```

Admin only.

Not exposed publicly.

Purpose:

Sales follow-up notes.

---

# 15. Export Function

Support CSV export.

Fields:

```text
Created At
Name
Email
Phone
Company
Country
Message
Site
Status
```

---

# 16. Security Requirements

Public API must:

* Validate all input
* Sanitize all strings
* Prevent HTML injection
* Prevent spam submissions

Never expose:

```text
Admin API
Private Fields
Internal Notes
```

to public users.

---

# 17. Deliverables

Claude Code must implement:

## Backend

* Lead Collection Type
* Public Lead API
* Validation Logic
* Spam Protection
* Email Notification

---

## Frontend

Reusable Astro component:

```text
LeadForm.astro
```

Configurable props:

```typescript
type
siteId
siteDomain
product
```

---

## Admin

* Lead List
* Lead Status Management
* Lead Notes
* CSV Export

---

# Definition of Done

The feature is considered complete when:

1. Any Astro site can submit leads.

2. Leads are stored centrally in Strapi.

3. Lead source website is recorded.

4. Lead page URL is recorded.

5. Admin users can manage lead status.

6. Email notifications are sent.

7. Spam protection is active.

8. Leads can be exported to CSV.

9. No SEO or GEO functionality is required.

10. The implementation works for unlimited Astro websites connected to the same Strapi instance.

```
```
