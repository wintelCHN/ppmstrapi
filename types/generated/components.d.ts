import type { Schema, Struct } from '@strapi/strapi';

export interface ElementsArticleMeta extends Struct.ComponentSchema {
  collectionName: 'components_elements_article_metas';
  info: {
    description: 'Structured data fields for Article/NewsArticle schema (JSON-LD)';
    displayName: 'Article Meta';
    icon: 'newspaper';
    name: 'ArticleMeta';
  };
  attributes: {
    author: Schema.Attribute.String;
    wordCount: Schema.Attribute.Integer;
  };
}

export interface ElementsComparisonColumn extends Struct.ComponentSchema {
  collectionName: 'components_elements_comparison_columns';
  info: {
    description: 'A single column in a comparison table (e.g. a product or feature set)';
    displayName: 'Comparison Column';
    icon: 'column';
    name: 'Comparison Column';
  };
  attributes: {
    header: Schema.Attribute.String & Schema.Attribute.Required;
    image: Schema.Attribute.Media<'images'>;
    is_featured: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    sort_order: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    sub_header: Schema.Attribute.String;
  };
}

export interface ElementsComparisonRow extends Struct.ComponentSchema {
  collectionName: 'components_elements_comparison_rows';
  info: {
    description: 'A single row/feature row in a comparison table';
    displayName: 'Comparison Row';
    icon: 'minus';
    name: 'Comparison Row';
  };
  attributes: {
    label: Schema.Attribute.String & Schema.Attribute.Required;
    sort_order: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    values: Schema.Attribute.JSON;
  };
}

export interface ElementsFaqItem extends Struct.ComponentSchema {
  collectionName: 'components_elements_faq_items';
  info: {
    description: 'A single FAQ question-answer pair for manual FAQ blocks';
    displayName: 'FAQ Item';
    icon: 'question';
    name: 'FAQ Item';
  };
  attributes: {
    answer: Schema.Attribute.Blocks;
    answer_summary: Schema.Attribute.Text;
    question: Schema.Attribute.String & Schema.Attribute.Required;
    sort_order: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
  };
}

export interface ElementsFeature extends Struct.ComponentSchema {
  collectionName: 'components_elements_features';
  info: {
    displayName: 'Feature';
    icon: 'traffic-light';
    name: 'feature';
  };
  attributes: {
    name: Schema.Attribute.String;
  };
}

export interface ElementsFeatureColumn extends Struct.ComponentSchema {
  collectionName: 'components_slices_feature_columns';
  info: {
    description: '';
    displayName: 'Feature column';
    icon: 'align-center';
    name: 'FeatureColumn';
  };
  attributes: {
    description: Schema.Attribute.Text;
    icon: Schema.Attribute.Media<'images'> & Schema.Attribute.Required;
    title: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface ElementsFeatureRow extends Struct.ComponentSchema {
  collectionName: 'components_slices_feature_rows';
  info: {
    description: '';
    displayName: 'Feature row';
    icon: 'arrows-alt-h';
    name: 'FeatureRow';
  };
  attributes: {
    description: Schema.Attribute.Text;
    link: Schema.Attribute.Component<'links.link', false>;
    media: Schema.Attribute.Media<'images' | 'videos'> &
      Schema.Attribute.Required;
    title: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface ElementsFooterSection extends Struct.ComponentSchema {
  collectionName: 'components_links_footer_sections';
  info: {
    displayName: 'Footer section';
    icon: 'chevron-circle-down';
    name: 'FooterSection';
  };
  attributes: {
    links: Schema.Attribute.Component<'links.link', true>;
    title: Schema.Attribute.String;
  };
}

export interface ElementsLogos extends Struct.ComponentSchema {
  collectionName: 'components_elements_logos';
  info: {
    displayName: 'Logos';
    icon: 'apple-alt';
    name: 'logos';
  };
  attributes: {
    logo: Schema.Attribute.Media<'images'>;
    title: Schema.Attribute.String;
  };
}

export interface ElementsNotificationBanner extends Struct.ComponentSchema {
  collectionName: 'components_elements_notification_banners';
  info: {
    displayName: 'Notification banner';
    icon: 'exclamation';
    name: 'NotificationBanner';
  };
  attributes: {
    text: Schema.Attribute.RichText;
    type: Schema.Attribute.Enumeration<['alert', 'info', 'warning']> &
      Schema.Attribute.Required;
  };
}

export interface ElementsOrganization extends Struct.ComponentSchema {
  collectionName: 'components_elements_organizations';
  info: {
    description: 'Company/brand info for Organization schema (JSON-LD) and Knowledge Graph';
    displayName: 'Organization';
    icon: 'building';
    name: 'Organization';
  };
  attributes: {
    address: Schema.Attribute.Text;
    areaServed: Schema.Attribute.String;
    businessType: Schema.Attribute.Enumeration<
      ['Brand', 'Manufacturer', 'Wholesaler', 'Supplier', 'Retailer']
    > &
      Schema.Attribute.DefaultTo<'Supplier'>;
    description: Schema.Attribute.Text;
    email: Schema.Attribute.Email;
    geoLatitude: Schema.Attribute.Float;
    geoLongitude: Schema.Attribute.Float;
    industry: Schema.Attribute.JSON;
    legalName: Schema.Attribute.String;
    logo: Schema.Attribute.Media<'images'>;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    openingHours: Schema.Attribute.JSON;
    priceRange: Schema.Attribute.String;
    sameAs: Schema.Attribute.JSON;
    telephone: Schema.Attribute.String;
    url: Schema.Attribute.String;
  };
}

export interface ElementsPlan extends Struct.ComponentSchema {
  collectionName: 'components_elements_plans';
  info: {
    displayName: 'Pricing plan';
    icon: 'search-dollar';
    name: 'plan';
  };
  attributes: {
    description: Schema.Attribute.Text;
    features: Schema.Attribute.Component<'elements.feature', true>;
    isRecommended: Schema.Attribute.Boolean;
    name: Schema.Attribute.String;
    price: Schema.Attribute.Decimal;
    pricePeriod: Schema.Attribute.String;
  };
}

export interface ElementsProductSchema extends Struct.ComponentSchema {
  collectionName: 'components_elements_product_schemas';
  info: {
    description: 'Structured data fields for Product schema (JSON-LD)';
    displayName: 'Product Schema';
    icon: 'shopping-cart';
    name: 'ProductSchema';
  };
  attributes: {
    aggregateRating: Schema.Attribute.JSON;
    availability: Schema.Attribute.Enumeration<
      ['InStock', 'OutOfStock', 'PreOrder', 'BackOrder']
    > &
      Schema.Attribute.DefaultTo<'InStock'>;
    brand: Schema.Attribute.String;
    gtin: Schema.Attribute.String;
    mpn: Schema.Attribute.String;
    priceValidUntil: Schema.Attribute.Date;
    shippingDetails: Schema.Attribute.JSON;
  };
}

export interface ElementsStatisticItem extends Struct.ComponentSchema {
  collectionName: 'components_elements_statistic_items';
  info: {
    description: 'A single statistic / data fact with optional counter animation';
    displayName: 'Statistic Item';
    icon: 'chart-pie';
    name: 'Statistic Item';
  };
  attributes: {
    description: Schema.Attribute.Text;
    icon: Schema.Attribute.Media<'images'>;
    label: Schema.Attribute.String & Schema.Attribute.Required;
    numeric_value: Schema.Attribute.Integer;
    sort_order: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    source: Schema.Attribute.Text;
    value: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface ElementsTestimonial extends Struct.ComponentSchema {
  collectionName: 'components_slices_testimonials';
  info: {
    displayName: 'Testimonial';
    icon: 'user-check';
    name: 'Testimonial';
  };
  attributes: {
    authorName: Schema.Attribute.String;
    authorTitle: Schema.Attribute.String;
    link: Schema.Attribute.String;
    logo: Schema.Attribute.Media<'images'>;
    picture: Schema.Attribute.Media<'images'>;
    text: Schema.Attribute.Text;
  };
}

export interface LayoutNavItem extends Struct.ComponentSchema {
  collectionName: 'components_layout_nav_items';
  info: {
    description: 'Navigation menu item with link type, display mode, and optional children';
    displayName: 'Navigation Item';
    icon: 'arrow-right';
    name: 'NavItem';
  };
  attributes: {
    category: Schema.Attribute.Relation<'manyToOne', 'api::category.category'>;
    children: Schema.Attribute.Component<'layout.nav-sub-item', true>;
    custom_url: Schema.Attribute.String;
    display_mode: Schema.Attribute.Enumeration<['inline', 'dropdown', 'cta']> &
      Schema.Attribute.DefaultTo<'inline'>;
    link_type: Schema.Attribute.Enumeration<['category', 'page', 'custom']> &
      Schema.Attribute.DefaultTo<'custom'>;
    open_new_tab: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    page: Schema.Attribute.Relation<'manyToOne', 'api::page.page'>;
    title: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface LayoutNavSubItem extends Struct.ComponentSchema {
  collectionName: 'components_layout_nav_sub_items';
  info: {
    description: 'Second-level navigation item (rendered inside a dropdown)';
    displayName: 'Navigation Sub Item';
    icon: 'arrow-down';
    name: 'NavSubItem';
  };
  attributes: {
    category: Schema.Attribute.Relation<'manyToOne', 'api::category.category'>;
    custom_url: Schema.Attribute.String;
    link_type: Schema.Attribute.Enumeration<['category', 'page', 'custom']> &
      Schema.Attribute.DefaultTo<'custom'>;
    open_new_tab: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    page: Schema.Attribute.Relation<'manyToOne', 'api::page.page'>;
    title: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface LayoutSiteFooter extends Struct.ComponentSchema {
  collectionName: 'components_layout_site_footers';
  info: {
    description: 'Footer configuration: logo, description, columns, bottom links, social links';
    displayName: 'Site Footer';
    icon: 'grip-horizontal';
    name: 'SiteFooter';
  };
  attributes: {
    bottom_links: Schema.Attribute.Component<'links.link', true>;
    bottom_text: Schema.Attribute.Text;
    columns: Schema.Attribute.Component<'elements.footer-section', true>;
    description: Schema.Attribute.Text;
    logo: Schema.Attribute.Media<'images'>;
    social_links: Schema.Attribute.JSON;
  };
}

export interface LayoutSiteHeader extends Struct.ComponentSchema {
  collectionName: 'components_layout_site_headers';
  info: {
    description: 'Header configuration: logo, layout style, sticky behavior';
    displayName: 'Site Header';
    icon: 'grip-horizontal';
    name: 'SiteHeader';
  };
  attributes: {
    layout: Schema.Attribute.Enumeration<
      ['default', 'centered', 'transparent', 'minimal']
    > &
      Schema.Attribute.DefaultTo<'default'>;
    logo: Schema.Attribute.Media<'images'> & Schema.Attribute.Required;
    logo_dark: Schema.Attribute.Media<'images'>;
    sticky: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
  };
}

export interface LinksButton extends Struct.ComponentSchema {
  collectionName: 'components_links_simple_buttons';
  info: {
    description: '';
    displayName: 'Button';
    icon: 'fingerprint';
    name: 'Button';
  };
  attributes: {
    text: Schema.Attribute.String;
    type: Schema.Attribute.Enumeration<['primary', 'secondary']>;
  };
}

export interface LinksButtonLink extends Struct.ComponentSchema {
  collectionName: 'components_links_buttons';
  info: {
    description: '';
    displayName: 'Button link';
    icon: 'fingerprint';
    name: 'Button-link';
  };
  attributes: {
    newTab: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    text: Schema.Attribute.String;
    type: Schema.Attribute.Enumeration<['primary', 'secondary']>;
    url: Schema.Attribute.String;
  };
}

export interface LinksLink extends Struct.ComponentSchema {
  collectionName: 'components_links_links';
  info: {
    description: '';
    displayName: 'Link';
    icon: 'link';
    name: 'Link';
  };
  attributes: {
    newTab: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    text: Schema.Attribute.String & Schema.Attribute.Required;
    url: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface MetaMetadata extends Struct.ComponentSchema {
  collectionName: 'components_meta_metadata';
  info: {
    displayName: 'Metadata';
    icon: 'robot';
    name: 'Metadata';
  };
  attributes: {
    articleSection: Schema.Attribute.String;
    canonicalOverride: Schema.Attribute.String;
    metaDescription: Schema.Attribute.Text & Schema.Attribute.Required;
    metaKeywords: Schema.Attribute.Text;
    metaTitle: Schema.Attribute.String & Schema.Attribute.Required;
    nofollow: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    noindex: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    ogDescriptionOverride: Schema.Attribute.Text;
    ogTitleOverride: Schema.Attribute.String;
    priority: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          max: 1;
          min: 0;
        },
        number
      >;
    shareImage: Schema.Attribute.Media<'images'>;
    twitterCardType: Schema.Attribute.Enumeration<
      ['summary', 'summary_large_image', 'app', 'player']
    > &
      Schema.Attribute.DefaultTo<'summary'>;
    twitterUsername: Schema.Attribute.String;
  };
}

export interface SectionsBottomActions extends Struct.ComponentSchema {
  collectionName: 'components_slices_bottom_actions';
  info: {
    displayName: 'Bottom actions';
    icon: 'angle-double-right';
    name: 'BottomActions';
  };
  attributes: {
    buttons: Schema.Attribute.Component<'links.button-link', true>;
    title: Schema.Attribute.String;
  };
}

export interface SectionsComparisonTable extends Struct.ComponentSchema {
  collectionName: 'components_sections_comparison_tables';
  info: {
    description: 'Product or feature comparison table for SEO/GEO pages';
    displayName: 'Comparison Table';
    icon: 'table';
    name: 'Comparison Table';
  };
  attributes: {
    columns: Schema.Attribute.Component<'elements.comparison-column', true>;
    compared_products: Schema.Attribute.Relation<
      'manyToMany',
      'api::product.product'
    >;
    cta_label: Schema.Attribute.String & Schema.Attribute.DefaultTo<'Compare'>;
    description: Schema.Attribute.Text;
    enable_sorting: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    highlight_column: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0>;
    mode: Schema.Attribute.Enumeration<['manual', 'products', 'features']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'products'>;
    rows: Schema.Attribute.Component<'elements.comparison-row', true>;
    title: Schema.Attribute.String;
  };
}

export interface SectionsCtaBanner extends Struct.ComponentSchema {
  collectionName: 'components_sections_cta_banners';
  info: {
    description: 'Enhanced call-to-action banner with A/B testing variant support';
    displayName: 'CTA Banner';
    icon: 'cursor';
    name: 'CTA Banner';
  };
  attributes: {
    ab_test_id: Schema.Attribute.String;
    alignment: Schema.Attribute.Enumeration<['left', 'center', 'right']> &
      Schema.Attribute.DefaultTo<'center'>;
    background_color: Schema.Attribute.Enumeration<
      ['brand', 'dark', 'light', 'gradient', 'none']
    > &
      Schema.Attribute.DefaultTo<'brand'>;
    background_image: Schema.Attribute.Media<'images'>;
    primary_button: Schema.Attribute.Component<'links.button-link', false> &
      Schema.Attribute.Required;
    secondary_button: Schema.Attribute.Component<'links.button-link', false>;
    subtitle: Schema.Attribute.Text;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    variant: Schema.Attribute.Enumeration<
      ['primary', 'secondary', 'minimal', 'floating']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'primary'>;
  };
}

export interface SectionsFaqGroup extends Struct.ComponentSchema {
  collectionName: 'components_sections_faq_groups';
  info: {
    description: 'FAQ accordion block \u2014 add Q&A items directly as a content block on any page';
    displayName: 'FAQ Group';
    icon: 'question-circle';
    name: 'FAQ Group';
  };
  attributes: {
    description: Schema.Attribute.Text;
    enable_schema_markup: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<true>;
    items: Schema.Attribute.Component<'elements.faq-item', true> &
      Schema.Attribute.Required;
    layout: Schema.Attribute.Enumeration<['accordion', 'grid', 'list']> &
      Schema.Attribute.DefaultTo<'accordion'>;
    max_items: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          max: 50;
          min: 1;
        },
        number
      > &
      Schema.Attribute.DefaultTo<10>;
    show_search: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    title: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'Frequently Asked Questions'>;
  };
}

export interface SectionsFeatureColumnsGroup extends Struct.ComponentSchema {
  collectionName: 'components_slices_feature_columns_groups';
  info: {
    displayName: 'Feature columns group';
    icon: 'star-of-life';
    name: 'FeatureColumnsGroup';
  };
  attributes: {
    features: Schema.Attribute.Component<'elements.feature-column', true>;
  };
}

export interface SectionsFeatureRowsGroup extends Struct.ComponentSchema {
  collectionName: 'components_slices_feature_rows_groups';
  info: {
    displayName: 'Feaures row group';
    icon: 'bars';
    name: 'FeatureRowsGroup';
  };
  attributes: {
    features: Schema.Attribute.Component<'elements.feature-row', true>;
  };
}

export interface SectionsHero extends Struct.ComponentSchema {
  collectionName: 'components_slices_heroes';
  info: {
    displayName: 'Hero';
    icon: 'heading';
    name: 'Hero';
  };
  attributes: {
    buttons: Schema.Attribute.Component<'links.button-link', true>;
    description: Schema.Attribute.String;
    label: Schema.Attribute.String;
    picture: Schema.Attribute.Media<'images'>;
    smallTextWithLink: Schema.Attribute.RichText;
    title: Schema.Attribute.String;
  };
}

export interface SectionsLargeVideo extends Struct.ComponentSchema {
  collectionName: 'components_slices_large_videos';
  info: {
    displayName: 'Large video';
    icon: 'play-circle';
    name: 'LargeVideo';
  };
  attributes: {
    description: Schema.Attribute.String;
    poster: Schema.Attribute.Media<'images'>;
    title: Schema.Attribute.String;
    video: Schema.Attribute.Media<'videos'> & Schema.Attribute.Required;
  };
}

export interface SectionsLeadForm extends Struct.ComponentSchema {
  collectionName: 'components_sections_lead_forms';
  info: {
    description: 'Contact/inquiry form that submits to Lead Center. Configure appearance here; Astro frontend renders the form and POSTs to /api/public/lead.';
    displayName: 'Lead Form (Lead Center)';
    icon: 'envelop';
    name: 'Lead form';
  };
  attributes: {
    description: Schema.Attribute.Text;
    formType: Schema.Attribute.Enumeration<['quick', 'rfq', 'contact']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'quick'>;
    submitButtonText: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'Submit Inquiry'>;
    successMessage: Schema.Attribute.Text &
      Schema.Attribute.DefaultTo<"Thank you! Your inquiry has been submitted. We'll get back to you soon.">;
    title: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'Get in Touch'>;
  };
}

export interface SectionsPricing extends Struct.ComponentSchema {
  collectionName: 'components_sections_pricings';
  info: {
    displayName: 'Pricing';
    icon: 'dollar-sign';
    name: 'Pricing';
  };
  attributes: {
    plans: Schema.Attribute.Component<'elements.plan', true>;
    title: Schema.Attribute.String;
  };
}

export interface SectionsRichText extends Struct.ComponentSchema {
  collectionName: 'components_sections_rich_texts';
  info: {
    displayName: 'Rich text';
    icon: 'text-height';
    name: 'RichText';
  };
  attributes: {
    content: Schema.Attribute.RichText;
  };
}

export interface SectionsStatistics extends Struct.ComponentSchema {
  collectionName: 'components_sections_statistics';
  info: {
    description: 'Data statistics / counter block for credibility and SEO';
    displayName: 'Statistics';
    icon: 'chart-bar';
    name: 'Statistics';
  };
  attributes: {
    animate_counters: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<true>;
    columns: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          max: 6;
          min: 2;
        },
        number
      > &
      Schema.Attribute.DefaultTo<4>;
    description: Schema.Attribute.Text;
    items: Schema.Attribute.Component<'elements.statistic-item', true> &
      Schema.Attribute.Required;
    layout: Schema.Attribute.Enumeration<['grid', 'inline', 'carousel']> &
      Schema.Attribute.DefaultTo<'grid'>;
    show_source: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    title: Schema.Attribute.String;
  };
}

export interface SectionsTestimonialsGroup extends Struct.ComponentSchema {
  collectionName: 'components_slices_testimonials_groups';
  info: {
    displayName: 'Testimonials group';
    icon: 'user-friends';
    name: 'TestimonialsGroup';
  };
  attributes: {
    description: Schema.Attribute.Text;
    link: Schema.Attribute.Component<'links.link', false>;
    logos: Schema.Attribute.Component<'elements.logos', true>;
    testimonials: Schema.Attribute.Component<'elements.testimonial', true>;
    title: Schema.Attribute.String;
  };
}

export interface SharedFaqReference extends Struct.ComponentSchema {
  collectionName: 'components_shared_faq_references';
  info: {
    description: 'Reference an existing FAQ content type \u2014 display inline or link to standalone page';
    displayName: 'FAQ Reference';
    icon: 'question-circle';
    name: 'FAQ Reference';
  };
  attributes: {
    display_mode: Schema.Attribute.Enumeration<['inline', 'linked']> &
      Schema.Attribute.DefaultTo<'inline'>;
    faq: Schema.Attribute.Relation<'manyToOne', 'api::faq.faq'>;
    max_items: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          max: 50;
          min: 1;
        },
        number
      > &
      Schema.Attribute.DefaultTo<10>;
  };
}

export interface SharedRelatedProducts extends Struct.ComponentSchema {
  collectionName: 'components_shared_related_products';
  info: {
    description: 'Display related products via manual selection, category, tags, or hybrid mode.';
    displayName: 'Related Products';
    icon: 'shopping-cart';
    name: 'Related products';
  };
  attributes: {
    category_filter: Schema.Attribute.Relation<
      'manyToOne',
      'api::category.category'
    >;
    limit: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          max: 20;
          min: 1;
        },
        number
      > &
      Schema.Attribute.DefaultTo<6>;
    manual_products: Schema.Attribute.Relation<
      'manyToMany',
      'api::product.product'
    >;
    mode: Schema.Attribute.Enumeration<
      ['manual', 'category', 'tag', 'hybrid']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'manual'>;
    show_cta: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    show_description: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<true>;
    sort_by: Schema.Attribute.Enumeration<
      ['featured', 'newest', 'alphabetical', 'manual_priority']
    > &
      Schema.Attribute.DefaultTo<'featured'>;
    tag_filters: Schema.Attribute.JSON;
    title: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'Related Products'>;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'elements.article-meta': ElementsArticleMeta;
      'elements.comparison-column': ElementsComparisonColumn;
      'elements.comparison-row': ElementsComparisonRow;
      'elements.faq-item': ElementsFaqItem;
      'elements.feature': ElementsFeature;
      'elements.feature-column': ElementsFeatureColumn;
      'elements.feature-row': ElementsFeatureRow;
      'elements.footer-section': ElementsFooterSection;
      'elements.logos': ElementsLogos;
      'elements.notification-banner': ElementsNotificationBanner;
      'elements.organization': ElementsOrganization;
      'elements.plan': ElementsPlan;
      'elements.product-schema': ElementsProductSchema;
      'elements.statistic-item': ElementsStatisticItem;
      'elements.testimonial': ElementsTestimonial;
      'layout.nav-item': LayoutNavItem;
      'layout.nav-sub-item': LayoutNavSubItem;
      'layout.site-footer': LayoutSiteFooter;
      'layout.site-header': LayoutSiteHeader;
      'links.button': LinksButton;
      'links.button-link': LinksButtonLink;
      'links.link': LinksLink;
      'meta.metadata': MetaMetadata;
      'sections.bottom-actions': SectionsBottomActions;
      'sections.comparison-table': SectionsComparisonTable;
      'sections.cta-banner': SectionsCtaBanner;
      'sections.faq-group': SectionsFaqGroup;
      'sections.feature-columns-group': SectionsFeatureColumnsGroup;
      'sections.feature-rows-group': SectionsFeatureRowsGroup;
      'sections.hero': SectionsHero;
      'sections.large-video': SectionsLargeVideo;
      'sections.lead-form': SectionsLeadForm;
      'sections.pricing': SectionsPricing;
      'sections.rich-text': SectionsRichText;
      'sections.statistics': SectionsStatistics;
      'sections.testimonials-group': SectionsTestimonialsGroup;
      'shared.faq-reference': SharedFaqReference;
      'shared.related-products': SharedRelatedProducts;
    }
  }
}
