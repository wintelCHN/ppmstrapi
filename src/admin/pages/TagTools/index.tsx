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
  Badge,
  Loader,
  Dialog,
  Textarea,
  SingleSelect,
  SingleSelectOption,
  Field,
  Grid,
  Divider,
  Alert,
  LinkButton,
} from '@strapi/design-system';
import {
  ArrowClockwise,
  CloudUpload,
  Download,
  Stack,
  Trash,
  Plus,
} from '@strapi/icons';

// ── Types ──

interface TagSummary {
  documentId: string;
  name: string;
  slug: string;
  tagtype: 'product_type' | 'use_scenario' | 'attribute';
  products: { count: number };
  relatedtags: { count: number };
  publishedAt: string | null;
  site: { documentId: string; name: string; slug: string } | null;
}

interface StatData {
  totalTags: number;
  totalProductLinks: number;
  byType: Record<string, number>;
  orphanTags: number;
}

interface DupeGroup {
  normalizedName: string;
  tags: TagSummary[];
}

interface SiteOption {
  documentId: string;
  name: string;
}

const TAG_TYPE_LABELS: Record<string, string> = {
  product_type: 'Product Type',
  use_scenario: 'Use Scenario',
  attribute: 'Attribute',
};

const TAG_TYPE_COLORS: Record<string, string> = {
  product_type: 'primary600',
  use_scenario: 'success600',
  attribute: 'warning600',
};

// ── Component ──

export function TagToolsPage() {
  const { get, post, del } = useFetchClient();
  const { toggleNotification } = useNotification();

  const [loading, setLoading] = useState(true);
  const [statData, setStatData] = useState<StatData | null>(null);
  const [dupeGroups, setDupeGroups] = useState<DupeGroup[]>([]);
  const [tags, setTags] = useState<TagSummary[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [selectedSite, setSelectedSite] = useState<string>('');

  // Merge
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [mergeSourceIds, setMergeSourceIds] = useState<string[]>([]);
  const [mergeRunning, setMergeRunning] = useState(false);

  // Import
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importCsv, setImportCsv] = useState('');
  const [importRunning, setImportRunning] = useState(false);

  // ── Data ──

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const qs = selectedSite
        ? `?filters[site][documentId][$eq]=${selectedSite}`
        : '';
      const [statsRes, dupesRes, tagsRes, sitesRes] = await Promise.all([
        get(`/api/tags/statistics${qs}`),
        get(`/api/tags/suggest-duplicates${qs}`),
        get(`/api/tags${qs}?pagination[pageSize]=500&sort=name:ASC&populate[products][count]=true&populate[site]=true`),
        get('/content-manager/collection-types/api::site.site?pageSize=200&sort=site_name:ASC'),
      ]);
      setStatData(statsRes.data as StatData);
      setDupeGroups((dupesRes.data ?? []) as DupeGroup[]);
      setTags((tagsRes.data ?? []) as TagSummary[]);
      setSites(
        (sitesRes.data?.results ?? []).map((s: any) => ({
          documentId: s.documentId,
          name: s.site_name ?? s.name ?? '',
        })),
      );
    } catch (err: any) {
      toggleNotification({ type: 'warning', message: err?.message ?? 'Failed to load data' });
    } finally {
      setLoading(false);
    }
  }, [get, toggleNotification, selectedSite]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Merge ──

  function openMergeForDupeGroup(group: DupeGroup) {
    const ids = group.tags.map((t) => t.documentId);
    setMergeSourceIds(ids);
    setMergeTargetId(ids[0]);
    setIsMergeOpen(true);
  }

  async function handleMerge() {
    if (!mergeTargetId || mergeSourceIds.length < 2) return;
    const sources = mergeSourceIds.filter((id) => id !== mergeTargetId);
    if (sources.length === 0) {
      toggleNotification({ type: 'warning', message: 'Select at least one source tag' });
      return;
    }
    setMergeRunning(true);
    try {
      const res = await post('/api/tags/merge', {
        data: { targetDocumentId: mergeTargetId, sourceDocumentIds: sources },
      });
      toggleNotification({ type: 'success', message: `Merged ${sources.length} tag(s) into one` });
    } catch (err: any) {
      toggleNotification({ type: 'warning', message: err?.message ?? 'Merge failed' });
    } finally {
      setMergeRunning(false);
      setIsMergeOpen(false);
      setMergeTargetId('');
      setMergeSourceIds([]);
      fetchAll();
    }
  }

  // ── CSV Import ──

  async function handleImport() {
    setImportRunning(true);
    const lines = importCsv.trim().split('\n');
    if (lines.length < 2) {
      toggleNotification({ type: 'warning', message: 'CSV must have a header + at least one data row' });
      setImportRunning(false);
      return;
    }
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    let created = 0;
    let skipped = 0;
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = cols[idx] ?? ''; });
      if (!row.name) { skipped++; continue; }
      try {
        let relatedkeywords: string[] = [];
        if (row.relatedkeywords) {
          try {
            relatedkeywords = JSON.parse(row.relatedkeywords);
          } catch {
            relatedkeywords = row.relatedkeywords.split(';').map((k) => k.trim()).filter(Boolean);
          }
        }
        await post('/content-manager/collection-types/api::tag.tag', {
          name: row.name,
          tagtype: row.tagtype || 'product_type',
          targetkeyword: row.targetkeyword || null,
          relatedkeywords,
          seotitle: row.seotitle || null,
          metadesc: row.metadesc || null,
          ...(selectedSite ? { site: { documentId: selectedSite } } : {}),
        });
        created++;
      } catch {
        skipped++;
      }
    }
    toggleNotification({
      type: 'success',
      message: `Imported ${created} tag(s)${skipped > 0 ? `, ${skipped} skipped` : ''}`,
    });
    setImportRunning(false);
    setIsImportOpen(false);
    setImportCsv('');
    fetchAll();
  }

  function handleExport() {
    const header = 'name,slug,tagtype,targetkeyword,relatedkeywords,seotitle,metadesc,productCount';
    const rows = tags.map((t) =>
      [
        t.name,
        t.slug,
        t.tagtype,
        '',
        JSON.stringify([]),
        '',
        '',
        t.products?.count ?? 0,
      ].join(','),
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tags-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toggleNotification({ type: 'success', message: `Exported ${tags.length} tag(s)` });
  }

  // ── Render ──

  return (
    <Page.Main>
      <Page.Title>Tag Tools</Page.Title>

      <Layouts.Header
        title="Tag Tools"
        subtitle="Batch merge, CSV import/export, and statistics for the Tag taxonomy"
        as="h2"
        primaryAction={
          <LinkButton
            to="/admin/content-manager/collection-types/api::tag.tag"
            startIcon={<Plus />}
          >
            Manage Tags
          </LinkButton>
        }
      />

      <Layouts.Content>

        {loading ? (
          <Flex justifyContent="center" paddingTop={8}>
            <Loader>Loading tag data...</Loader>
          </Flex>
        ) : (
          <>
            {/* ── Site filter ── */}
            <Box paddingBottom={4}>
              <Flex gap={3} alignItems="flex-end" wrap="wrap">
                <Field.Root>
                  <Field.Label>Scope to site</Field.Label>
                  <SingleSelect
                    placeholder="All sites"
                    value={selectedSite}
                    onChange={(v: string) => setSelectedSite(v as string)}
                    onClear={() => setSelectedSite('')}
                  >
                    {sites.filter((s) => s.name).map((s) => (
                      <SingleSelectOption key={s.documentId} value={s.documentId}>
                        {s.name}
                      </SingleSelectOption>
                    ))}
                  </SingleSelect>
                </Field.Root>
                <Button variant="ghost" startIcon={<ArrowClockwise />} onClick={fetchAll}>
                  Refresh
                </Button>
              </Flex>
            </Box>

            {/* ── Duplicate alert ── */}
            {dupeGroups.length > 0 && (
              <Box paddingBottom={4}>
                {dupeGroups.map((group, i) => (
                  <Box key={i} paddingBottom={2}>
                    <Alert
                      title={`Duplicate: "${group.normalizedName}" (${group.tags.length} tags)`}
                      variant="warning"
                      onAction={() => openMergeForDupeGroup(group)}
                      actionLabel="Merge"
                    >
                      {group.tags.map((t) => t.name).join(', ')}
                    </Alert>
                  </Box>
                ))}
              </Box>
            )}

            {/* ── Statistics ── */}
            {statData && (
              <Box paddingBottom={6}>
                <Grid.Root gap={4}>
                  <Grid.Item col={2} s={6} xs={12}>
                    <Box background="neutral0" padding={5} shadow="tableShadow" hasRadius>
                      <Typography variant="alpha">{statData.totalTags}</Typography>
                      <Typography variant="omega" textColor="neutral600">Total Tags</Typography>
                    </Box>
                  </Grid.Item>
                  <Grid.Item col={2} s={6} xs={12}>
                    <Box background="neutral0" padding={5} shadow="tableShadow" hasRadius>
                      <Typography variant="alpha">{statData.totalProductLinks}</Typography>
                      <Typography variant="omega" textColor="neutral600">Product Links</Typography>
                    </Box>
                  </Grid.Item>
                  <Grid.Item col={2} s={6} xs={12}>
                    <Box background="neutral0" padding={5} shadow="tableShadow" hasRadius>
                      <Typography variant="alpha">{statData.orphanTags}</Typography>
                      <Typography variant="omega" textColor="neutral600">Orphan Tags</Typography>
                    </Box>
                  </Grid.Item>
                  <Grid.Item col={6} s={12} xs={12}>
                    <Box background="neutral0" padding={5} shadow="tableShadow" hasRadius>
                      <Flex gap={3} wrap="wrap">
                        {Object.entries(statData.byType).map(([tp, count]) => (
                          <Badge key={tp} backgroundColor={TAG_TYPE_COLORS[tp] ?? 'neutral600'}>
                            {TAG_TYPE_LABELS[tp] ?? tp}: {count}
                          </Badge>
                        ))}
                      </Flex>
                      <Box paddingTop={2}>
                        <Typography variant="omega" textColor="neutral600">Breakdown by type</Typography>
                      </Box>
                    </Box>
                  </Grid.Item>
                </Grid.Root>
              </Box>
            )}

            <Divider />

            {/* ── Tool buttons ── */}
            <Box paddingTop={6} paddingBottom={6}>
              <Flex gap={4} wrap="wrap">
                {/* CSV Import */}
                <Box background="neutral0" padding={5} shadow="tableShadow" hasRadius style={{ flex: '1 1 260px', maxWidth: '320px' }}>
                  <Flex direction="column" gap={3}>
                    <Typography variant="delta">Import CSV</Typography>
                    <Typography variant="pi" textColor="neutral600">
                      Bulk-create tags from a CSV file.
                    </Typography>
                    <Button
                      variant="secondary"
                      startIcon={<CloudUpload />}
                      onClick={() => setIsImportOpen(true)}
                      fullWidth
                    >
                      Import CSV
                    </Button>
                  </Flex>
                </Box>

                {/* CSV Export */}
                <Box background="neutral0" padding={5} shadow="tableShadow" hasRadius style={{ flex: '1 1 260px', maxWidth: '320px' }}>
                  <Flex direction="column" gap={3}>
                    <Typography variant="delta">Export CSV</Typography>
                    <Typography variant="pi" textColor="neutral600">
                      Download all {tags.length} tags as a CSV spreadsheet.
                    </Typography>
                    <Button
                      variant="secondary"
                      startIcon={<Download />}
                      onClick={handleExport}
                      fullWidth
                    >
                      Export {tags.length} tags
                    </Button>
                  </Flex>
                </Box>

                {/* Manual Merge */}
                <Box background="neutral0" padding={5} shadow="tableShadow" hasRadius style={{ flex: '1 1 260px', maxWidth: '320px' }}>
                  <Flex direction="column" gap={3}>
                    <Typography variant="delta">Merge Tags</Typography>
                    <Typography variant="pi" textColor="neutral600">
                      Combine duplicate tags — select a target and source tags to consolidate.
                    </Typography>
                    <Button
                      variant="secondary"
                      startIcon={<Stack />}
                      onClick={() => {
                        setMergeSourceIds([]);
                        setMergeTargetId('');
                        setIsMergeOpen(true);
                      }}
                      fullWidth
                    >
                      Open Merge Tool
                    </Button>
                  </Flex>
                </Box>
              </Flex>
            </Box>
          </>
        )}

        {/* ──────────────────────────────────────
            Merge Dialog
            ────────────────────────────────────── */}
        {isMergeOpen && (
          <Dialog.Root open onOpenChange={(open: boolean) => { if (!open) setIsMergeOpen(false); }}>
            <Dialog.Content style={{ maxWidth: '640px' }}>
              <Dialog.Header>Merge Tags</Dialog.Header>
              <Dialog.Body alignItems="stretch">
                <Flex direction="column" gap={4} alignItems="stretch">
                  <Typography>
                    Merge source tags into a single <strong>target tag</strong>. All product
                    relations, keywords, and related tags will be transferred. Source tags
                    will be <strong>deleted</strong>.
                  </Typography>

                  <Field.Root required>
                    <Field.Label>Target Tag (keep)</Field.Label>
                    <SingleSelect
                      placeholder="Select the tag to keep"
                      value={mergeTargetId}
                      onChange={(v: string) => setMergeTargetId(v)}
                    >
                      {tags.map((t) => (
                        <SingleSelectOption key={t.documentId} value={t.documentId}>
                          {t.name} — {t.tagtype} ({t.products?.count ?? 0} products)
                        </SingleSelectOption>
                      ))}
                    </SingleSelect>
                    <Field.Hint>This tag will absorb all data from the source tags.</Field.Hint>
                  </Field.Root>

                  <Field.Root required>
                    <Field.Label>Source Tags (will be deleted)</Field.Label>
                    <Flex direction="column" gap={1}>
                      {tags
                        .filter((t) => t.documentId !== mergeTargetId)
                        .map((t) => {
                          const checked = mergeSourceIds.includes(t.documentId);
                          return (
                            <Button
                              key={t.documentId}
                              variant={checked ? 'danger' : 'tertiary'}
                              size="S"
                              onClick={() =>
                                setMergeSourceIds((prev) =>
                                  prev.includes(t.documentId)
                                    ? prev.filter((id) => id !== t.documentId)
                                    : [...prev, t.documentId],
                                )
                              }
                            >
                              {checked ? '✓ ' : ''}{t.name}
                              <Typography variant="pi" textColor="neutral500" style={{ marginLeft: 8 }}>
                                ({t.products?.count ?? 0} products)
                              </Typography>
                            </Button>
                          );
                        })}
                    </Flex>
                    <Field.Hint>
                      Click to toggle. Selected: {mergeSourceIds.length} source tag(s).
                    </Field.Hint>
                  </Field.Root>
                </Flex>
              </Dialog.Body>
              <Dialog.Footer>
                <Button variant="tertiary" onClick={() => setIsMergeOpen(false)} disabled={mergeRunning}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  loading={mergeRunning}
                  startIcon={<Stack />}
                  onClick={handleMerge}
                  disabled={!mergeTargetId || mergeSourceIds.length < 1}
                >
                  Merge {mergeSourceIds.length} into target
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Root>
        )}

        {/* ──────────────────────────────────────
            CSV Import Dialog
            ────────────────────────────────────── */}
        {isImportOpen && (
          <Dialog.Root open onOpenChange={(open: boolean) => { if (!open) setIsImportOpen(false); }}>
            <Dialog.Content style={{ maxWidth: '700px' }}>
              <Dialog.Header>Import Tags from CSV</Dialog.Header>
              <Dialog.Body alignItems="stretch">
                <Flex direction="column" gap={4} alignItems="stretch">
                  <Box>
                    <Typography variant="omega">
                      CSV format: <code>name,tagtype,targetkeyword,relatedkeywords,seotitle,metadesc</code>
                    </Typography>
                    <Typography variant="pi" textColor="neutral600">
                      relatedkeywords accepts a JSON array or semicolon-separated string.
                      tagtype must be one of: product_type, use_scenario, attribute.
                    </Typography>
                  </Box>
                  <Textarea
                    label="CSV content"
                    name="csv"
                    placeholder={`name,tagtype,targetkeyword,relatedkeywords,seotitle,metadesc
treadmill,product_type,commercial treadmill,"[""gym"",""cardio""]",Commercial Treadmills,Explore our treadmills`}
                    value={importCsv}
                    onChange={(e: any) => setImportCsv(e.target.value)}
                    style={{ minHeight: '180px', fontFamily: 'monospace', fontSize: '13px' }}
                  />
                </Flex>
              </Dialog.Body>
              <Dialog.Footer>
                <Button variant="tertiary" onClick={() => setIsImportOpen(false)} disabled={importRunning}>
                  Cancel
                </Button>
                <Button
                  loading={importRunning}
                  startIcon={<CloudUpload />}
                  onClick={handleImport}
                  disabled={!importCsv.trim()}
                >
                  Import
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Root>
        )}
      </Layouts.Content>
    </Page.Main>
  );
}
