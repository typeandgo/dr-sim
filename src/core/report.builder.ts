import { isMessageKey, type MessageKey, type Translate } from './i18n';
import type { DecisionReason, InventoryItem, Settings, TabSession } from './types';

// Rapor üretimi — 07-preset-and-templates.md §C.3 / §C.4.

const BLOCKED_REASONS: DecisionReason[] = ['blocked', 'default-block'];
const PASSED_REASONS: DecisionReason[] = ['allowed', 'default-pass'];

export interface ReportInput {
  session: TabSession | null;
  settings: Settings;
  // Rapor, arayüzle aynı dilde üretilir (Revizyon 41)
  t: Translate;
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

const bulletList = (items: InventoryItem[], t: Translate): string => (items.length
  ? items.map((item) => `- ${item.method} ${item.path}`).join('\n')
  : `- ${t('common.none')}`);

const formatDate = (at: number): string => new Date(at).toISOString().slice(0, 16).replace('T', ' ');

const metaBlock = ({ session, settings, t, now = 0 }: ReportInput): string => {
  const simulatedFails = session?.failLog.filter((entry) => entry.simulated).length ?? 0;
  const realFails = (session?.failLog.length ?? 0) - simulatedFails;
  const total = session ? Object.values(session.inventory).reduce((sum, item) => sum + item.count, 0) : 0;
  const policy = settings.defaultPolicy === 'block' ? t('report.policyBlock') : t('report.policyPass');
  const fault = settings.fault.kind === 'http' ? `${settings.fault.status} ${settings.fault.statusText}` : settings.fault.kind;

  return [
    `- **${t('report.date')}:** ${formatDate(now)}`,
    `- **${t('report.domainScope')}:** ${settings.domains.map((domain) => domain.pattern).join(', ') || t('common.none')}`,
    `- **${t('report.defaultPolicy')}:** ${policy}`,
    `- **${t('report.faultType')}:** ${fault}`,
    `- **${t('report.totalRequests')}:** ${total}`,
    `- **${t('report.failBreakdown')}:** ${t('report.failBreakdownValue', { simulated: simulatedFails, real: realFails })}`,
  ].join('\n');
};

// §C.4 — sayfa bazlı sonuç raporu (tamamen otomatik üretilir)
export const buildResultReport = (input: ReportInput): string => {
  const { session, t, includeMeta = true } = input;
  const title = session?.title || t('report.page');
  const route = session?.routePath || '/';

  const parts = [
    `**${title}** — \`${route}\``,
    '',
    t('report.blockedEps'),
    '',
    bulletList(blockedItems(session), t),
    '',
    t('report.passedEps'),
    '',
    bulletList(passedItems(session), t),
    '',
    t('report.output'),
    '',
    t('report.observation'),
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
  // Dosya adı da arayüz diliyle aynı sözlükten gelir (Y1)
  const name = input.t('file.report');
  if (format === 'json') return { content: buildJsonReport(input), extension: 'json', name };
  return { content: buildResultReport(input), extension: 'md', name };
};

// Fail satırındaki sebep etiketi (02-ui-spec.md §3.9). Sözlükte karşılığı olmayan
// bir sebep gelirse ham kod gösterilir — boş etiketten iyidir.
export const reasonLabel = (reason: DecisionReason, t: Translate): string => {
  const key: string = `reason.${reason}`;
  return isMessageKey(key) ? t(key as MessageKey) : reason;
};
