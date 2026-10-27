export type LensId = 'new' | 'it' | 'sales';
export type Relevance = 'start' | 'useful' | 'skim';

export const LENS_STORAGE_KEY = 'vaathi.lens';
export const DEFAULT_LENS: LensId = 'new';

export const LENSES: { id: LensId; label: string; blurb: string }[] = [
  {
    id: 'new',
    label: 'New to AI',
    blurb: 'Everyday words, one picture, and a task you can try today.',
  },
  {
    id: 'it',
    label: 'I work in IT',
    blurb: 'Where it sits in a system, what can fail, and what it costs.',
  },
  {
    id: 'sales',
    label: 'I talk to customers',
    blurb: 'A sentence you can say out loud, and what not to promise.',
  },
];

export const RELEVANCE_LABEL: Record<Relevance, string> = {
  start: 'Start here',
  useful: 'Useful',
  skim: 'Skim',
};

const LENS_IDS = new Set<string>(LENSES.map((lens) => lens.id));

type Row = Record<LensId, Relevance>;

function row(it: Relevance, sales: Relevance): Row {
  return { new: 'start', it, sales };
}

export const RELEVANCE: Record<string, Row> = {
  'what-ai-means': row('useful', 'start'),
  'what-gen-ai-is': row('useful', 'start'),
  'systems-from-outside': row('useful', 'start'),
  'llms-plain-language': row('start', 'skim'),
  'why-vectors-embeddings': row('start', 'skim'),
  'transformers-beginner': row('start', 'skim'),
  'how-transformers-work': row('start', 'skim'),
  'how-a-model-is-built': row('start', 'skim'),
  'gpus-vs-cpus': row('start', 'skim'),
  'how-data-is-labeled': row('start', 'skim'),
  'bleu-and-rouge': row('start', 'skim'),
  'prompting-clear-communication': row('start', 'start'),
  'prompt-engineering-in-practice': row('start', 'start'),
  'limits-risks-responsible-use': row('start', 'start'),
  'personal-ai-workflow': row('useful', 'start'),
  'tool-landscape': row('useful', 'start'),
  'agentic-workflows': row('start', 'useful'),
  'memory-for-agents': row('start', 'useful'),
  'cloud-frontier-models': row('start', 'useful'),
  'claude-basics': row('start', 'useful'),
  'claude-code-basics': row('start', 'skim'),
  'aws-bedrock-basics': row('start', 'skim'),
  'where-to-go-next': row('start', 'start'),
  // Build path
  'python-just-enough': row('start', 'skim'),
  'calling-a-model': row('start', 'useful'),
  'vectors-in-code': row('start', 'skim'),
  'tool-calls-in-code': row('start', 'useful'),
  'agent-loop-in-code': row('start', 'useful'),
  'assemble-a-python-agent': row('start', 'skim'),
  'memory-in-code': row('start', 'useful'),
  'grow-chat-into-agent': row('start', 'useful'),
  'from-code-to-sandbox': row('start', 'start'),
};

export function isLensId(value: string | null | undefined): value is LensId {
  return !!value && LENS_IDS.has(value);
}

export function relevanceFor(lessonId: string, lens: LensId): Relevance {
  return RELEVANCE[lessonId]?.[lens] ?? 'start';
}
