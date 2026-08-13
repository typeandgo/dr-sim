import { REASON_LABELS } from './constants';
import type { DecisionReason, InventoryItem, Settings, TabSession } from './types';

// Rapor üretimi — 07-preset-and-templates.md §C.3 / §C.4.

const BLOCKED_REASONS: DecisionReason[] = ['blocked', 'default-block'];
const PASSED_REASONS: DecisionReason[] = ['allowed', 'default-pass'];

export interface ReportInput {
  session: TabSession | null;
  settings: Settings;
  now?: number;
  includeMeta?: boolean;
}

const sortItems = (items: InventoryItem[]): InventoryItem[] => [...items].sort((a, b) => a.key.localeCompare(b.key));

const byReason = (session: TabSession | null, reasons: DecisionReason[]): InventoryItem[] => {
  if (!session) return [];
  return sortItems(Object.values(session.inventory).filter((item) => reasons.includes(item.lastReason)));
};

export const blockedItems = (session: TabSession | null): InventoryItem[] => byReason(session, BLOCKED_REASONS);
export const passedItems = (session: TabSession | null): InventoryItem[] => byReason(session, PASSED_REASONS);

const bulletList = (items: InventoryItem[]): string => (items.length ? items.map((item) => `- ${item.method} ${item.path}`).join('\n') : '- (yok)');

const formatDate = (at: number): string => new Date(at).toISOString().slice(0, 16).replace('T', ' ');

const metaBlock = ({ session, settings, now = 0 }: ReportInput): string => {
  const simulatedFails = session?.failLog.filter((entry) => entry.simulated).length ?? 0;
  const realFails = (session?.failLog.length ?? 0) - simulatedFails;
  const total = session ? Object.values(session.inventory).reduce((sum, item) => sum + item.count, 0) : 0;
  const policy = settings.defaultPolicy === 'block' ? 'Listede olmayanlar bloklanır' : 'Listede olmayanlar geçer';
  const fault = settings.fault.kind === 'http' ? `${settings.fault.status} ${settings.fault.statusText}` : settings.fault.kind;

  return [
    `- **Tarih:** ${formatDate(now)}`,
    `- **Domain kapsamı:** ${settings.domains.map((domain) => domain.pattern).join(', ') || '(yok)'}`,
    `- **Varsayılan politika:** ${policy}`,
    `- **Arıza tipi:** ${fault}`,
    `- **Toplam istek:** ${total}`,
    `- **Fail dağılımı:** ${simulatedFails} simüle · ${realFails} gerçek`,
  ].join('\n');
};

// §C.4 — sayfa bazlı sonuç raporu (tamamen otomatik üretilir)
export const buildResultReport = (input: ReportInput): string => {
  const { session, includeMeta = true } = input;
  const title = session?.title || 'Sayfa';
  const route = session?.routePath || '/';

  const parts = [
    `**${title}** — \`${route}\``,
    '',
    "***Bloklanan EP'ler***",
    '',
    bulletList(blockedItems(session)),
    '',
    "***Bloklanmayan EP'ler***",
    '',
    bulletList(passedItems(session)),
    '',
    '***Çıktı***',
    '',
    '<gözlem>',
  ];

  if (includeMeta) parts.push('', '---', '', metaBlock(input));

  return `${parts.join('\n')}\n`;
};

export const buildJsonReport = ({ session, settings, now = 0 }: ReportInput): string => JSON.stringify(
  {
    generatedAt: now,
    title: session?.title ?? null,
    routePath: session?.routePath ?? null,
    origin: session?.origin ?? null,
    defaultPolicy: settings.defaultPolicy,
    domains: settings.domains.map((domain) => domain.pattern),
    fault: settings.fault,
    rules: settings.rules,
    blocked: blockedItems(session).map((item) => item.key),
    passed: passedItems(session).map((item) => item.key),
    inventory: session ? sortItems(Object.values(session.inventory)) : [],
    failLog: session?.failLog ?? [],
    successLog: session?.successLog ?? [],
  },
  null,
  2,
);

// Formata göre içerik + dosya kimliği (Revizyon 30). Walkthrough Revizyon 35'te
// üründen çıkarıldı; şablonun kendisi 07-preset-and-templates.md §C.3'te duruyor.
export interface ReportFile {
  content: string;
  extension: string;
  name: string;
}

export const buildReportFile = (format: string, input: ReportInput): ReportFile => {
  if (format === 'json') return { content: buildJsonReport(input), extension: 'json', name: 'dr-sim-rapor' };
  return { content: buildResultReport(input), extension: 'md', name: 'dr-sim-rapor' };
};

// Fail satırındaki sebep etiketi (02-ui-spec.md §3.9)
export const reasonLabel = (reason: DecisionReason): string => REASON_LABELS[reason] ?? reason;
