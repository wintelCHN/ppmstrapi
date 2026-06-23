import { useState, useEffect, useCallback } from 'react'
import {
  Page,
  Layouts,
  useFetchClient,
  useNotification,
} from '@strapi/strapi/admin'
import {
  Box,
  Flex,
  Typography,
  Button,
  Badge,
  Loader,
  SingleSelect,
  SingleSelectOption,
  NumberInput,
  Field,
  Divider,
  Alert,
  Checkbox,
  Table,
  Thead,
  Tbody,
  Tr,
  Td,
  Th,
} from '@strapi/design-system'
import {
  Check,
  Pencil,
  Plus,
} from '@strapi/icons'

// ── Types ──

interface ProductSummary {
  documentId: string
  name: string
  sku: string
  moq: number
  status: string
  site: { documentId: string; site_name: string; name?: string } | null
  category: { documentId: string; name: string } | null
}

interface SiteOption {
  documentId: string
  name: string
}

interface CategoryOption {
  documentId: string
  name: string
  site: { documentId: string } | null
}

interface BatchResult {
  updated: number
  failed: number
  details: Array<{
    documentId: string
    status: 'updated' | 'failed' | 'skipped'
    reason?: string
  }>
}

const PAGE_SIZE = 100

// ── Component ──

export function ProductBatchPage() {
  const { get, post } = useFetchClient()
  const { toggleNotification } = useNotification()

  const [loading, setLoading] = useState(true)
  const [sites, setSites] = useState<SiteOption[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [products, setProducts] = useState<ProductSummary[]>([])
  const [productCount, setProductCount] = useState(0)
  const [selectedSite, setSelectedSite] = useState<string>('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Batch action state
  const [targetSite, setTargetSite] = useState<string>('')
  const [targetCategory, setTargetCategory] = useState<string>('')
  const [targetMoq, setTargetMoq] = useState<number | undefined>(undefined)
  const [applying, setApplying] = useState(false)
  const [result, setResult] = useState<BatchResult | null>(null)

  // ── Data fetching ──

  const fetchSites = useCallback(async () => {
    try {
      const res = await get(
        '/content-manager/collection-types/api::site.site?pageSize=200&sort=site_name:ASC',
      )
      setSites(
        (res.data?.results ?? []).map((s: any) => ({
          documentId: s.documentId,
          name: s.site_name ?? s.name ?? '',
        })),
      )
    } catch (err: any) {
      toggleNotification({ type: 'warning', message: `Failed to load sites: ${err?.message ?? String(err)}` })
    }
  }, [get, toggleNotification])

  const fetchCategories = useCallback(async (siteDocId?: string) => {
    try {
      const qs = siteDocId
        ? `?filters[site][documentId][$eq]=${siteDocId}&pageSize=500&sort=name:ASC&populate[site]=true`
        : '?pageSize=500&sort=name:ASC&populate[site]=true'
      const res = await get(
        `/content-manager/collection-types/api::category.category${qs}`,
      )
      setCategories(
        (res.data?.results ?? []).map((c: any) => ({
          documentId: c.documentId,
          name: c.name,
          site: c.site ?? null,
        })),
      )
    } catch (err: any) {
      toggleNotification({ type: 'warning', message: 'Failed to load categories' })
    }
  }, [get, toggleNotification])

  const fetchProducts = useCallback(async (siteDocId?: string) => {
    setLoading(true)
    setSelectedIds(new Set())
    try {
      const qs = siteDocId
        ? `?filters[site][documentId][$eq]=${siteDocId}&pageSize=${PAGE_SIZE}&sort=name:ASC`
        : `?pageSize=${PAGE_SIZE}&sort=name:ASC`
      const res = await get(
        `/content-manager/collection-types/api::product.product${qs}`,
      )
      const items = (res.data?.results ?? []).map((p: any) => ({
        documentId: p.documentId,
        name: p.name,
        sku: p.sku,
        moq: p.moq ?? 100,
        status: p.status ?? 'draft',
        site: p.site ?? null,
        category: p.category ?? null,
      }))
      setProducts(items)
      setProductCount(items.length)
    } catch (err: any) {
      toggleNotification({ type: 'warning', message: 'Failed to load products' })
    } finally {
      setLoading(false)
    }
  }, [get, toggleNotification])

  useEffect(() => {
    fetchSites()
    fetchCategories()
    fetchProducts()
  }, [fetchSites, fetchCategories, fetchProducts])

  // ── Handlers ──

  function handleSiteFilter(val: string) {
    setSelectedSite(val)
    fetchCategories(val || undefined)
    fetchProducts(val || undefined)
  }

  function toggleProduct(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setResult(null)
  }

  function toggleAll() {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(products.map((p) => p.documentId)))
    }
    setResult(null)
  }

  async function handleApply() {
    if (selectedIds.size === 0) {
      toggleNotification({ type: 'warning', message: 'Select at least one product' })
      return
    }

    const data: Record<string, any> = {}
    if (targetSite) {
      data.site = { documentId: targetSite }
    }
    if (targetCategory) {
      data.category = { documentId: targetCategory }
    }
    if (targetMoq !== undefined) {
      data.moq = targetMoq
    }

    if (Object.keys(data).length === 0) {
      toggleNotification({ type: 'warning', message: 'Set at least one field to update (Site, Category, or MOQ)' })
      return
    }

    setApplying(true)
    setResult(null)
    try {
      const res = await post('/api/products/batch-update', {
        data: {
          documentIds: [...selectedIds],
          data,
        },
      })
      const r = res.data as BatchResult
      setResult(r)
      toggleNotification({
        type: r.failed > 0 ? 'warning' : 'success',
        message: `Updated ${r.updated} product(s)${r.failed > 0 ? `, ${r.failed} failed` : ''}`,
      })
      // Refresh products after successful update
      fetchProducts(selectedSite || undefined)
      setSelectedIds(new Set())
    } catch (err: any) {
      toggleNotification({ type: 'warning', message: err?.message ?? 'Batch update failed' })
    } finally {
      setApplying(false)
    }
  }

  // Derive filtered categories based on selected target site
  const filteredCategories = targetSite
    ? categories.filter((c) => !c.site || c.site.documentId === targetSite)
    : categories

  const hasSelection = selectedIds.size > 0
  const selectedProducts = products.filter((p) => selectedIds.has(p.documentId))

  // ── Render ──

  return (
    <Page.Main>
      <Page.Title>Product Batch Tools</Page.Title>

      <Layouts.Header
        title="Product Batch Tools"
        subtitle="Batch update site, category, and MOQ for multiple products at once"
        as="h2"
        primaryAction={
          <Button
            startIcon={<Plus />}
            onClick={() =>
              window.location.href =
                '/admin/content-manager/collection-types/api::product.product'
            }
          >
            Manage Products
          </Button>
        }
      />

      <Layouts.Content>
        {/* ── Step 1: Select Products ── */}
        <Box paddingBottom={4}>
          <Flex gap={3} alignItems="flex-end" wrap="wrap">
            <Field.Root>
              <Field.Label>Filter by site</Field.Label>
              <SingleSelect
                placeholder="All sites"
                value={selectedSite}
                onChange={handleSiteFilter}
                onClear={() => handleSiteFilter('')}
              >
                {sites
                  .filter((s) => s.name)
                  .map((s) => (
                    <SingleSelectOption key={s.documentId} value={s.documentId}>
                      {s.name}
                    </SingleSelectOption>
                  ))}
              </SingleSelect>
            </Field.Root>
          </Flex>
        </Box>

        {loading ? (
          <Flex justifyContent="center" paddingTop={8}>
            <Loader>Loading products...</Loader>
          </Flex>
        ) : products.length === 0 ? (
          <Box padding={8} background="neutral0" shadow="tableShadow" hasRadius>
            <Typography variant="delta" textAlign="center">
              No products found{selectedSite ? ' for this site' : ''}.
            </Typography>
          </Box>
        ) : (
          <>
            {/* ── Selection summary ── */}
            <Box paddingBottom={3}>
              <Flex gap={3} alignItems="center">
                <Button variant="tertiary" size="S" onClick={toggleAll}>
                  {selectedIds.size === products.length
                    ? 'Deselect All'
                    : 'Select All'}
                </Button>
                <Badge backgroundColor="primary600">
                  Selected: {selectedIds.size} / {products.length}
                </Badge>
              </Flex>
            </Box>

            {/* ── Product table ── */}
            <Box
              background="neutral0"
              shadow="tableShadow"
              hasRadius
              padding={4}
              style={{ maxHeight: '480px', overflowY: 'auto' }}
            >
              <Table>
                <Thead>
                  <Tr>
                    <Th style={{ width: 40 }} />
                    <Th><Typography variant="sigma">SKU</Typography></Th>
                    <Th><Typography variant="sigma">Name</Typography></Th>
                    <Th><Typography variant="sigma">Site</Typography></Th>
                    <Th><Typography variant="sigma">Category</Typography></Th>
                    <Th><Typography variant="sigma">MOQ</Typography></Th>
                    <Th><Typography variant="sigma">Status</Typography></Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {products.map((p) => {
                    const checked = selectedIds.has(p.documentId)
                    return (
                      <Tr
                        key={p.documentId}
                        onClick={() => toggleProduct(p.documentId)}
                        style={{ cursor: 'pointer', background: checked ? 'var(--primary100)' : undefined }}
                      >
                        <Td>
                          <Checkbox
                            checked={checked}
                            onChange={() => toggleProduct(p.documentId)}
                          />
                        </Td>
                        <Td><Typography variant="omega">{p.sku}</Typography></Td>
                        <Td><Typography variant="omega">{p.name}</Typography></Td>
                        <Td>
                          <Typography variant="omega" textColor="neutral600">
                            {p.site?.site_name ?? p.site?.name ?? '—'}
                          </Typography>
                        </Td>
                        <Td>
                          <Typography variant="omega" textColor="neutral600">
                            {p.category?.name ?? '—'}
                          </Typography>
                        </Td>
                        <Td><Typography variant="omega">{p.moq}</Typography></Td>
                        <Td>
                          <Badge
                            backgroundColor={
                              p.status === 'published' ? 'success600' : 'neutral600'
                            }
                          >
                            {p.status}
                          </Badge>
                        </Td>
                      </Tr>
                    )
                  })}
                </Tbody>
              </Table>
            </Box>

            {products.length >= PAGE_SIZE && (
              <Box paddingTop={2}>
                <Typography variant="pi" textColor="neutral600">
                  Showing first {PAGE_SIZE} of {productCount} products.
                </Typography>
              </Box>
            )}
          </>
        )}

        <Divider />
        <Box paddingTop={6} />

        {/* ── Step 2: Batch Action ── */}
        <Box
          background="neutral0"
          padding={6}
          shadow="tableShadow"
          hasRadius
        >
          <Typography variant="delta" as="h3">
            Batch Action
          </Typography>
          <Typography variant="pi" textColor="neutral600">
            Set any combination of fields below. Only filled-in fields will be applied.
          </Typography>

          <Box paddingTop={4} paddingBottom={4}>
            <Flex gap={4} alignItems="flex-start" wrap="wrap">
              {/* ── Left: Site ── */}
              <Box style={{ flex: 1, minWidth: '220px' }}>
                <Field.Root>
                  <Field.Label>Change Site</Field.Label>
                  <SingleSelect
                    placeholder="(keep current)"
                    value={targetSite}
                    onChange={(val: string) => {
                      setTargetSite(val)
                      setResult(null)
                    }}
                    onClear={() => {
                      setTargetSite('')
                      setResult(null)
                    }}
                  >
                    {sites
                      .filter((s) => s.name)
                      .map((s) => (
                        <SingleSelectOption key={s.documentId} value={s.documentId}>
                          {s.name}
                        </SingleSelectOption>
                      ))}
                  </SingleSelect>
                  <Field.Hint>
                    Moves products to this site. Category will be cleared if it doesn't
                    belong.
                  </Field.Hint>
                </Field.Root>
              </Box>

              {/* ── Center: Category ── */}
              <Box style={{ flex: 1, minWidth: '220px' }}>
                <Field.Root>
                  <Field.Label>Change Category</Field.Label>
                  <SingleSelect
                    placeholder="(keep current)"
                    value={targetCategory}
                    onChange={(val: string) => {
                      setTargetCategory(val)
                      setResult(null)
                    }}
                    onClear={() => {
                      setTargetCategory('')
                      setResult(null)
                    }}
                  >
                    {filteredCategories
                      .filter((c) => c.name)
                      .map((c) => (
                        <SingleSelectOption key={c.documentId} value={c.documentId}>
                          {c.name}
                        </SingleSelectOption>
                      ))}
                  </SingleSelect>
                  <Field.Hint>
                    {targetSite
                      ? 'Filtered to selected site above.'
                      : 'Tip: set Site first to filter categories.'}
                  </Field.Hint>
                </Field.Root>
              </Box>

              {/* ── Right: MOQ ── */}
              <Box style={{ flex: 1, minWidth: '180px' }}>
                <Field.Root>
                  <Field.Label>Change MOQ</Field.Label>
                  <NumberInput
                    placeholder="(keep current)"
                    value={targetMoq ?? '' as any}
                    onValueChange={(val: number | undefined) => {
                      setTargetMoq(val)
                      setResult(null)
                    }}
                    min={1}
                  />
                  <Field.Hint>
                    Min: 1. Leave empty to keep current value.
                  </Field.Hint>
                </Field.Root>
              </Box>
            </Flex>
          </Box>

          {/* Active fields summary */}
          {(targetSite || targetCategory || targetMoq !== undefined) && (
            <Box paddingBottom={4}>
              <Alert variant="default" title="Will update:">
                <Flex gap={2} wrap="wrap">
                  {targetSite && (
                    <Badge backgroundColor="primary600">
                      Site: {sites.find((s) => s.documentId === targetSite)?.name ?? targetSite}
                    </Badge>
                  )}
                  {targetCategory && (
                    <Badge backgroundColor="secondary600">
                      Category: {filteredCategories.find((c) => c.documentId === targetCategory)?.name ?? targetCategory}
                    </Badge>
                  )}
                  {targetMoq !== undefined && (
                    <Badge backgroundColor="warning600">
                      MOQ: {targetMoq}
                    </Badge>
                  )}
                </Flex>
              </Alert>
            </Box>
          )}

          <Flex gap={3}>
            <Button
              disabled={!hasSelection || applying}
              onClick={handleApply}
              startIcon={<Pencil />}
            >
              Apply Batch Update
            </Button>
          </Flex>
        </Box>

        {/* ── Results ── */}
        {result && (
          <Box paddingTop={6}>
            <Alert
              title={
                result.failed > 0
                  ? `Batch update complete — ${result.updated} updated, ${result.failed} failed`
                  : `All ${result.updated} products updated successfully`
              }
              variant={result.failed > 0 ? 'warning' : 'success'}
            >
              {result.details
                .filter((d) => d.status !== 'updated')
                .map((d) => (
                  <Typography key={d.documentId} variant="pi">
                    {d.status === 'failed'
                      ? `✗ ${d.documentId}: ${d.reason ?? 'Unknown error'}`
                      : `⊘ ${d.documentId}: ${d.reason ?? 'Skipped'}`}
                  </Typography>
                ))}
            </Alert>
          </Box>
        )}

        {/* ── Selection preview / help ── */}
        {hasSelection && !result && (
          <Box paddingTop={6}>
            <Alert title={`${selectedIds.size} product(s) selected`} variant="default">
              <Typography variant="pi" textColor="neutral600">
                {selectedProducts.slice(0, 5).map((p) => p.name).join(', ')}
                {selectedProducts.length > 5
                  ? `, ... and ${selectedProducts.length - 5} more`
                  : ''}
              </Typography>
            </Alert>
          </Box>
        )}
      </Layouts.Content>
    </Page.Main>
  )
}
