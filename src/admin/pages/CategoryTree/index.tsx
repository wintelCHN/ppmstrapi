import { useState, useEffect, useCallback } from 'react';
import {
  Page,
  Layouts,
  useFetchClient,
  useNotification,
} from '@strapi/strapi/admin';
import {
  Box,
  Flex,
  Typography,
  Button,
  IconButton,
  Badge,
  Loader,
  EmptyStateLayout,
  Dialog,
  TextInput,
  Textarea,
  SingleSelect,
  SingleSelectOption,
  Field,
  Grid,
  Divider,
} from '@strapi/design-system';
import { Plus, Pencil, Trash, ArrowClockwise, Check, Cross } from '@strapi/icons';

// ──────────────────────────────────────
// Types
// ──────────────────────────────────────

interface CategoryResult {
  id: number;
  documentId: string;
  name: string;
  slug: string;
  description: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  status: 'draft' | 'published';
  publishedAt: string | null;
  locale: string;
  parent: {
    id: number;
    documentId: string;
    name: string;
    slug: string;
  } | null;
  site: {
    id: number;
    documentId: string;
    slug: string;
    site_name: string;
  } | null;
  children: { count: number };
}

interface TreeNode extends CategoryResult {
  children_nodes: TreeNode[];
  depth: number;
}

interface SiteOption {
  documentId: string;
  site_name: string;
}

// ──────────────────────────────────────
// Tree Utilities
// ──────────────────────────────────────

function buildTree(flatList: CategoryResult[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const cat of flatList) {
    nodeMap.set(cat.documentId, { ...cat, children_nodes: [], depth: 0 });
  }

  for (const node of nodeMap.values()) {
    const parentDocId = node.parent?.documentId;
    if (parentDocId && nodeMap.has(parentDocId)) {
      nodeMap.get(parentDocId)!.children_nodes.push(node);
    } else {
      roots.push(node);
    }
  }

  function assignDepth(nodes: TreeNode[], depth: number) {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    for (const node of nodes) {
      node.depth = depth;
      assignDepth(node.children_nodes, depth + 1);
    }
  }
  assignDepth(roots, 0);

  return roots;
}

function flattenTree(nodes: TreeNode[]): CategoryResult[] {
  const result: CategoryResult[] = [];
  function walk(list: TreeNode[]) {
    for (const node of list) {
      const { children_nodes, depth, ...cat } = node;
      result.push(cat as CategoryResult);
      walk(node.children_nodes);
    }
  }
  walk(nodes);
  return result;
}

// ──────────────────────────────────────
// Category Tree Page Component
// ──────────────────────────────────────

export function CategoryTreePage() {
  const { get, post, put, del } = useFetchClient();
  const { toggleNotification } = useNotification();

  // Data state
  const [allCategories, setAllCategories] = useState<CategoryResult[]>([]);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSite, setSelectedSite] = useState<string>(''); // '' = All Sites

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<CategoryResult | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    parentDocumentId: '' as string,
    siteDocumentId: '',
    seo_title: '',
    seo_description: '',
    seo_keywords: '',
  });
  const [saving, setSaving] = useState(false);

  // ── Data Fetching ──

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Pagination loop: pull all pages to guarantee full dataset (>500 categories)
      const allCats: CategoryResult[] = [];
      let page = 1;
      while (true) {
        const catRes = await get(
          '/content-manager/collection-types/api::category.category',
          { params: { pageSize: 500, page, sort: 'name:asc' } },
        );
        allCats.push(...catRes.data.results);
        if (catRes.data.pagination.page >= catRes.data.pagination.pageCount) break;
        page++;
      }

      const siteRes = await get('/content-manager/collection-types/api::site.site', {
        params: { pageSize: 100 },
      });

      setAllCategories(allCats);

      const siteList: SiteOption[] = siteRes.data.results;
      setSites(siteList);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err.message || 'Failed to load data';
      setError(msg);
      toggleNotification({ type: 'danger', message: msg });
    } finally {
      setLoading(false);
    }
  }, [get, toggleNotification]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Rebuild tree whenever categories or site filter changes
  useEffect(() => {
    const filtered = selectedSite
      ? allCategories.filter((c) => c.site?.documentId === selectedSite)
      : allCategories;
    setTree(buildTree(filtered));
  }, [allCategories, selectedSite]);

  // ── Expand / Collapse ──

  const toggleExpand = (docId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  };

  const expandAll = () => {
    const allExpandable = new Set<string>();
    function collect(nodes: TreeNode[]) {
      for (const n of nodes) {
        if (n.children_nodes.length > 0) {
          allExpandable.add(n.documentId);
          collect(n.children_nodes);
        }
      }
    }
    collect(tree);
    setExpanded(allExpandable);
  };

  const collapseAll = () => setExpanded(new Set());

  // ── CRUD ──

  const openCreateDialog = (parentDocId?: string) => {
    setEditingCat(null);
    setFormData({
      name: '',
      slug: '',
      description: '',
      parentDocumentId: parentDocId || '',
      siteDocumentId: selectedSite || sites[0]?.documentId || '',
      seo_title: '',
      seo_description: '',
      seo_keywords: '',
    });
    setDialogOpen(true);
  };

  const openEditDialog = (cat: CategoryResult) => {
    setEditingCat(cat);
    setFormData({
      name: cat.name,
      slug: cat.slug,
      description: cat.description || '',
      parentDocumentId: cat.parent?.documentId || '',
      siteDocumentId: cat.site?.documentId || '',
      seo_title: cat.seo_title || '',
      seo_description: cat.seo_description || '',
      seo_keywords: cat.seo_keywords || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toggleNotification({ type: 'warning', message: 'Name is required' });
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: formData.name.trim(),
        slug: formData.slug.trim() || undefined,
        site: { documentId: formData.siteDocumentId },
        locale: 'en',
      };

      if (formData.parentDocumentId) {
        payload.parent = { documentId: formData.parentDocumentId };
      }

      if (formData.description.trim()) {
        payload.description = formData.description.trim();
      }

      if (formData.seo_title.trim()) {
        payload.seo_title = formData.seo_title.trim();
      }

      if (formData.seo_description.trim()) {
        payload.seo_description = formData.seo_description.trim();
      }

      if (formData.seo_keywords.trim()) {
        payload.seo_keywords = formData.seo_keywords.trim();
      }

      if (editingCat) {
        await put(
          `/content-manager/collection-types/api::category.category/${editingCat.documentId}`,
          payload,
        );
        toggleNotification({ type: 'success', message: 'Category updated' });
      } else {
        await post('/content-manager/collection-types/api::category.category', payload);
        toggleNotification({ type: 'success', message: 'Category created' });
      }

      setDialogOpen(false);
      fetchData();
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message || err.message || 'Save failed';
      toggleNotification({ type: 'danger', message: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!window.confirm('Delete this category and all its sub-categories?')) return;

    try {
      await del(`/content-manager/collection-types/api::category.category/${docId}`);
      toggleNotification({ type: 'success', message: 'Category deleted' });
      fetchData();
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message || err.message || 'Delete failed';
      toggleNotification({ type: 'danger', message: msg });
    }
  };

  const handlePublish = async (docId: string) => {
    try {
      await post(
        `/content-manager/collection-types/api::category.category/${docId}/actions/publish`,
      );
      toggleNotification({ type: 'success', message: 'Category published' });
      fetchData();
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message || err.message || 'Publish failed';
      toggleNotification({ type: 'danger', message: msg });
    }
  };

  // ── Build select options (indented for tree) ──

  const parentOptions = flattenTree(tree)
    .filter((c) => c.documentId !== editingCat?.documentId)
    .map((c) => {
      const depth = tree.find((n) => n.documentId === c.documentId)?.depth || 0;
      const indent = '  '.repeat(depth);
      const hasChildren = c.children?.count > 0;
      return { ...c, indent, hasChildren };
    });

  // ── Render ──

  const renderTreeNode = (node: TreeNode): React.ReactNode => {
    const isExpanded = expanded.has(node.documentId);
    const hasChildren = node.children_nodes.length > 0;
    const INDENT_PER_LEVEL = 28;
    const indentPx = node.depth * INDENT_PER_LEVEL;

    return (
      <Box key={node.documentId}>
        <Flex
          paddingLeft={indentPx}
          paddingY={2}
          paddingRight={4}
          alignItems="center"
          gap={1}
          borderBottom="1px solid"
          borderColor="neutral150"
          minHeight="48px"
        >
          {/* Expand/Collapse */}
          <Box width="28px" textAlign="center" flexShrink={0}>
            {hasChildren ? (
              <IconButton
                onClick={() => toggleExpand(node.documentId)}
                label={isExpanded ? 'Collapse' : 'Expand'}
                variant="ghost"
                size="S"
                style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
              >
                <span style={{ fontSize: '12px' }}>&#9654;</span>
              </IconButton>
            ) : (
              <span style={{ fontSize: '10px', color: '#ccc' }}>&#9679;</span>
            )}
          </Box>

          {/* Name */}
          <Typography
            fontWeight={node.depth === 0 ? 'bold' : 'regular'}
            style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {node.name}
          </Typography>

          {/* Slug */}
          <Typography
            variant="pi"
            textColor="neutral500"
            style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 1 }}
          >
            /{node.slug}
          </Typography>

          <Box flex="1" />

          {/* Child count */}
          {hasChildren && (
            <Typography variant="pi" textColor="neutral500" flexShrink={0}>
              {node.children_nodes.length} children
            </Typography>
          )}

          {/* Site badge */}
          {node.site && (
            <Badge size="S" textColor="neutral600" backgroundColor="neutral150" flexShrink={0}>
              {node.site.site_name || node.site.slug || 'no site'}
            </Badge>
          )}

          {/* Status */}
          <Badge
            size="S"
            variant={node.publishedAt ? 'success' : 'secondary'}
            flexShrink={0}
          >
            {node.publishedAt ? 'Published' : 'Draft'}
          </Badge>

          {/* Actions */}
          <Flex gap={0} flexShrink={0}>
            {!node.publishedAt && (
              <IconButton onClick={() => handlePublish(node.documentId)} label="Publish" variant="ghost" size="S">
                <Check />
              </IconButton>
            )}
            <IconButton onClick={() => openCreateDialog(node.documentId)} label="Add child" variant="ghost" size="S">
              <Plus />
            </IconButton>
            <IconButton onClick={() => openEditDialog(node)} label="Edit" variant="ghost" size="S">
              <Pencil />
            </IconButton>
            <IconButton onClick={() => handleDelete(node.documentId)} label="Delete" variant="ghost" size="S">
              <Trash />
            </IconButton>
          </Flex>
        </Flex>

        {/* Render children if expanded */}
        {isExpanded && hasChildren && node.children_nodes.map((child) => renderTreeNode(child))}
      </Box>
    );
  };

  return (
    <Page.Main>
      <Page.Title>Categories</Page.Title>

      <Layouts.Header
        title="Categories"
        subtitle={
          selectedSite
            ? `${tree.length} in ${sites.find((s) => s.documentId === selectedSite)?.site_name || 'selected site'} · ${allCategories.length} total — tree view with expand / collapse`
            : `${allCategories.length} total — tree view with expand / collapse`
        }
        primaryAction={
          <Button startIcon={<Plus />} onClick={() => openCreateDialog()}>
            Add Root Category
          </Button>
        }
      />

      <Layouts.Content>
        {/* Toolbar */}
        <Flex gap={2} paddingBottom={4} justifyContent="space-between">
          <Flex gap={2}>
            <Button variant="tertiary" onClick={expandAll}>
              Expand All
            </Button>
            <Button variant="tertiary" onClick={collapseAll}>
              Collapse All
            </Button>
            <Button variant="tertiary" startIcon={<ArrowClockwise />} onClick={fetchData}>
              Refresh
            </Button>
          </Flex>
          <Flex gap={2} alignItems="center">
            <Typography variant="pi" textColor="neutral600">
              Site:
            </Typography>
            <Box style={{ minWidth: '180px' }}>
              <SingleSelect
                placeholder="All Sites"
                value={selectedSite}
                onChange={(value: string) => setSelectedSite(value)}
                size="S"
              >
                <SingleSelectOption value="">All Sites</SingleSelectOption>
                {sites
                  .filter((s) => s.site_name)
                  .map((s) => (
                    <SingleSelectOption key={s.documentId} value={s.documentId}>
                      {s.site_name}
                    </SingleSelectOption>
                  ))}
              </SingleSelect>
            </Box>
          </Flex>
        </Flex>

        {/* Content */}
        {loading ? (
          <Flex justifyContent="center" paddingTop={8}>
            <Loader>Loading categories...</Loader>
          </Flex>
        ) : error ? (
          <EmptyStateLayout
            content={error}
            action={
              <Button variant="secondary" onClick={fetchData}>
                Retry
              </Button>
            }
          />
        ) : tree.length === 0 ? (
          <EmptyStateLayout
            content="No categories found"
            action={
              <Button startIcon={<Plus />} onClick={() => openCreateDialog()}>
                Add Root Category
              </Button>
            }
          />
        ) : (
          <Box background="neutral0" borderRadius={2} shadow="tableShadow" overflow="hidden">
            {/* Header */}
            <Flex
              paddingLeft={4}
              paddingRight={4}
              paddingY={2}
              borderBottom="2px solid"
              borderColor="neutral200"
              gap={1}
              alignItems="center"
            >
              <Box width="28px" flexShrink={0} />
              <Typography variant="sigma" textColor="neutral600" style={{ flex: 1 }}>
                Name
              </Typography>
              <Typography variant="sigma" textColor="neutral600" style={{ width: '180px', flexShrink: 1 }}>
                Slug
              </Typography>
              <Box width="100px" flexShrink={0} />
              <Box width="80px" flexShrink={0} />
              <Box width="80px" flexShrink={0} />
              <Box width="140px" flexShrink={0} textAlign="right">
                <Typography variant="sigma" textColor="neutral600">
                  Actions
                </Typography>
              </Box>
            </Flex>

            {/* Tree rows */}
            {tree.map((node) => renderTreeNode(node))}
          </Box>
        )}

        {/* ── Create / Edit Dialog ── */}
        {dialogOpen && (
          <Dialog.Root open={dialogOpen} onOpenChange={(open: boolean) => !open && setDialogOpen(false)}>
            <Dialog.Content style={{ maxWidth: '640px' }}>
              <Dialog.Header>
                {editingCat ? 'Edit Category' : 'Add Category'}
              </Dialog.Header>
              <Dialog.Body alignItems="stretch">
                <Flex direction="column" gap={4} alignItems="stretch">
                  {/* ── Basic Information ── */}
                  <Flex direction="column" gap={3}>
                    <Typography variant="sigma" textColor="neutral600">
                      Basic Information
                    </Typography>

                    <Field.Root required>
                      <Field.Label>Name</Field.Label>
                      <TextInput
                        placeholder="e.g. Fishing Rods"
                        value={formData.name}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setFormData((prev) => ({ ...prev, name: e.target.value }))
                        }
                      />
                      <Field.Hint>Display name for this category.</Field.Hint>
                      <Field.Error />
                    </Field.Root>

                    <Field.Root>
                      <Field.Label>Slug</Field.Label>
                      <TextInput
                        placeholder="Auto-generated if empty"
                        value={formData.slug}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setFormData((prev) => ({ ...prev, slug: e.target.value }))
                        }
                      />
                      <Field.Hint>URL-friendly identifier. Leave blank to auto-generate from name.</Field.Hint>
                    </Field.Root>

                    <Field.Root>
                      <Field.Label>Description</Field.Label>
                      <Textarea
                        placeholder="Brief description of this category"
                        value={formData.description}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                          setFormData((prev) => ({ ...prev, description: e.target.value }))
                        }
                      />
                      <Field.Hint>Optional. Displayed on category pages.</Field.Hint>
                    </Field.Root>
                  </Flex>

                  <Divider />

                  {/* ── Organization ── */}
                  <Flex direction="column" gap={3}>
                    <Typography variant="sigma" textColor="neutral600">
                      Organization
                    </Typography>

                    <Grid.Root gap={4}>
                      <Grid.Item col={6}>
                        <Field.Root>
                          <Field.Label>Parent Category</Field.Label>
                          <SingleSelect
                            placeholder="None (root category)"
                            value={formData.parentDocumentId}
                            onChange={(value: string) =>
                              setFormData((prev) => ({ ...prev, parentDocumentId: value }))
                            }
                          >
                            <SingleSelectOption value="">— None (root) —</SingleSelectOption>
                            {parentOptions.map((opt) => (
                              <SingleSelectOption key={opt.documentId} value={opt.documentId}>
                                {opt.indent}
                                {opt.hasChildren ? '📁 ' : '📄 '}
                                {opt.name}
                              </SingleSelectOption>
                            ))}
                          </SingleSelect>
                          <Field.Hint>Select a parent to create a sub-category.</Field.Hint>
                        </Field.Root>
                      </Grid.Item>
                      <Grid.Item col={6}>
                        <Field.Root required>
                          <Field.Label>Site</Field.Label>
                          <SingleSelect
                            placeholder="Select site"
                            value={formData.siteDocumentId}
                            onChange={(value: string) =>
                              setFormData((prev) => ({ ...prev, siteDocumentId: value }))
                            }
                          >
                            {sites
                              .filter((s) => s.site_name)
                              .map((s) => (
                                <SingleSelectOption key={s.documentId} value={s.documentId}>
                                  {s.site_name}
                                </SingleSelectOption>
                              ))}
                          </SingleSelect>
                          <Field.Hint>The site this category belongs to.</Field.Hint>
                        </Field.Root>
                      </Grid.Item>
                    </Grid.Root>
                  </Flex>

                  <Divider />

                  {/* ── SEO Metadata ── */}
                  <Flex direction="column" gap={3}>
                    <Flex gap={2} alignItems="center">
                      <Typography variant="sigma" textColor="neutral600">
                        SEO Metadata
                      </Typography>
                      <Typography variant="pi" textColor="neutral400">
                        (all optional)
                      </Typography>
                    </Flex>

                    <Field.Root>
                      <Field.Label>SEO Title</Field.Label>
                      <TextInput
                        placeholder="Defaults to category name if empty"
                        value={formData.seo_title}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setFormData((prev) => ({ ...prev, seo_title: e.target.value }))
                        }
                      />
                      <Field.Hint>Browser tab title. Defaults to category name if left empty.</Field.Hint>
                    </Field.Root>

                    <Field.Root>
                      <Field.Label>SEO Description</Field.Label>
                      <Textarea
                        placeholder="Meta description for search engines"
                        value={formData.seo_description}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                          setFormData((prev) => ({ ...prev, seo_description: e.target.value }))
                        }
                      />
                      <Field.Hint>Recommended 150–160 characters. Appears in search results.</Field.Hint>
                    </Field.Root>

                    <Field.Root>
                      <Field.Label>SEO Keywords</Field.Label>
                      <TextInput
                        placeholder="e.g. fishing, rods, equipment"
                        value={formData.seo_keywords}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setFormData((prev) => ({ ...prev, seo_keywords: e.target.value }))
                        }
                      />
                      <Field.Hint>Comma-separated keywords for search engines.</Field.Hint>
                    </Field.Root>
                  </Flex>
                </Flex>
              </Dialog.Body>
              <Dialog.Footer>
                <Button variant="tertiary" onClick={() => setDialogOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={handleSave} loading={saving}>
                  {editingCat ? 'Update' : 'Create'}
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Root>
        )}
      </Layouts.Content>
    </Page.Main>
  );
}
