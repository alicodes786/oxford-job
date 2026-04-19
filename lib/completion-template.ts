import { z } from 'zod';
import type { ChecklistItem } from '@/lib/models';

export const COMPLETION_TEMPLATE_VERSION = 1 as const;

/** Question types admins can attach as custom blocks */
export const completionQuestionTypeSchema = z.enum([
  'checkbox',
  'text',
  'textarea',
  'rating',
  'single_choice',
  'number',
]);

export type CompletionQuestionType = z.infer<typeof completionQuestionTypeSchema>;

const baseBlock = z.object({ id: z.string().min(1) });

export const completionBlockSchema = z.discriminatedUnion('type', [
  baseBlock.extend({
    type: z.literal('static'),
    title: z.string().optional(),
    body: z.string().optional(),
  }),
  baseBlock.extend({
    type: z.literal('guest_rating'),
    label: z.string(),
    required: z.boolean(),
    scale: z.union([z.literal(5), z.literal(10)]).default(5),
  }),
  baseBlock.extend({
    type: z.literal('damage'),
    label: z.string(),
    required: z.boolean(),
    requireImagesWhenYes: z.boolean(),
    options: z.tuple([z.string(), z.string(), z.string()]).optional(),
  }),
  baseBlock.extend({
    type: z.literal('question'),
    questionType: completionQuestionTypeSchema,
    label: z.string(),
    required: z.boolean(),
    placeholder: z.string().optional(),
    options: z.array(z.string()).min(1).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    order: z.number().optional(),
  }),
  baseBlock.extend({
    type: z.literal('notes'),
    label: z.string(),
    placeholder: z.string(),
    required: z.boolean(),
  }),
  baseBlock.extend({
    type: z.literal('post_cleaning'),
    label: z.string(),
    required: z.boolean(),
    maxFiles: z.number().min(1).max(20).default(10),
  }),
]);

export type CompletionBlock = z.infer<typeof completionBlockSchema>;

export const completionTemplateSchema = z.object({
  version: z.literal(COMPLETION_TEMPLATE_VERSION),
  blocks: z.array(completionBlockSchema).min(1),
});

export type CompletionTemplate = z.infer<typeof completionTemplateSchema>;

/** Persist legacy checklist_items array from a resolved template (for APIs that only read checklist_items). */
export function checklistItemsFromTemplate(template: CompletionTemplate): ChecklistItem[] {
  return template.blocks
    .filter((b): b is Extract<CompletionBlock, { type: 'question' }> => b.type === 'question')
    .map((b, i) => ({
      id: b.id,
      type:
        b.questionType === 'checkbox'
          ? 'checkbox'
          : b.questionType === 'rating'
            ? 'rating'
            : 'text',
      question: b.label,
      required: b.required,
      order: b.order ?? i + 1,
    }));
}

export const completionAnswersPayloadSchema = z.object({
  version: z.literal(1),
  values: z.record(z.string(), z.unknown()),
});

export type CompletionAnswersPayload = z.infer<typeof completionAnswersPayloadSchema>;

/** Default block ids — stable for migrations */
export const DEFAULT_BLOCK_IDS = {
  guest_rating: 'guest_rating',
  damage: 'damage',
  notes: 'notes',
  post_cleaning: 'post_cleaning',
} as const;

const defaultDamageOptions = ['Yes', 'No', 'Maybe'] as const;

function defaultCheckboxQuestions(): CompletionBlock[] {
  const items: Array<{ id: string; label: string }> = [
    { id: 'remote_in_unit', label: 'Remote in Unit' },
    { id: 'iron_in_unit', label: 'Iron in Unit' },
    { id: 'hair_dryer_in_unit', label: 'Hair dryer in Unit' },
    { id: 'new_bedding_clean', label: 'New bedding is clean' },
    { id: 'bathroom_clean', label: 'Bathroom - including WC/Sink are Clean' },
    { id: 'hot_water_working', label: 'Hot water working' },
    { id: 'heating_working', label: 'Heating working' },
    { id: 'floors_cleaned_and_hoovered', label: 'Floors mopped and hoovered' },
    {
      id: 'cutlery_check',
      label:
        'Cutlery Check - confirm correct number of items are in the unit - in case of anything missing- please enter below.',
    },
    {
      id: 'towels_checked',
      label: 'Correct number of towels left + towels checked for stains.',
    },
    {
      id: 'keys_left_in_box',
      label: 'If applicable- Keys Left back in the Box (185/ SC/ SA/ SW12)',
    },
  ];
  return items.map((item, i) => ({
    type: 'question' as const,
    id: item.id,
    questionType: 'checkbox' as const,
    label: item.label,
    required: false,
    order: i,
  }));
}

export function emptyValuesForTemplate(template: CompletionTemplate): Record<string, unknown> {
  const v: Record<string, unknown> = {};
  for (const block of template.blocks) {
    switch (block.type) {
      case 'static':
        break;
      case 'guest_rating':
        v[block.id] = undefined;
        break;
      case 'damage':
        v[block.id] = undefined;
        break;
      case 'question':
        if (block.questionType === 'checkbox') v[block.id] = false;
        else if (block.questionType === 'rating') v[block.id] = undefined;
        else if (block.questionType === 'number') v[block.id] = undefined;
        else v[block.id] = '';
        break;
      case 'notes':
        v[block.id] = '';
        break;
      case 'post_cleaning':
        v[block.id] = [];
        break;
      default:
        break;
    }
  }
  return v;
}

export function getDefaultCompletionTemplate(): CompletionTemplate {
  return {
    version: COMPLETION_TEMPLATE_VERSION,
    blocks: [
      {
        type: 'static',
        id: 'intro',
        title: 'Job completion',
        body: 'Complete all required sections before ending the job.',
      },
      {
        type: 'guest_rating',
        id: DEFAULT_BLOCK_IDS.guest_rating,
        label: 'How dirty or clean did the guest leave the unit?',
        required: true,
        scale: 5,
      },
      {
        type: 'damage',
        id: DEFAULT_BLOCK_IDS.damage,
        label: 'Was there any notable damage?',
        required: true,
        requireImagesWhenYes: true,
        options: [...defaultDamageOptions],
      },
      ...defaultCheckboxQuestions(),
      {
        type: 'notes',
        id: DEFAULT_BLOCK_IDS.notes,
        label: 'Details on Missing Items / Cutlery / Other issues noted. (N/A if none)',
        placeholder: 'Enter your answer',
        required: true,
      },
      {
        type: 'post_cleaning',
        id: DEFAULT_BLOCK_IDS.post_cleaning,
        label: 'Add pictures or video post cleaning. Notable area (Bed , WC, Kitchen)',
        required: false,
        maxFiles: 10,
      },
    ],
  };
}

export function checklistItemsToQuestionBlocks(items: ChecklistItem[]): CompletionBlock[] {
  return items
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((item, index) => {
      const qt = item.type === 'checkbox' ? 'checkbox' : item.type === 'rating' ? 'rating' : 'text';
      const base: CompletionBlock = {
        type: 'question',
        id: item.id,
        questionType: qt as CompletionQuestionType,
        label: item.question,
        required: item.required,
        order: index,
      };
      if (qt === 'rating') {
        return { ...base, min: 1, max: 5 };
      }
      return base;
    });
}

/** Merge saved completion_template or legacy checklist_items into a full template */
export function resolveCompletionTemplate(row: {
  completion_template?: unknown;
  checklist_items?: unknown;
}): CompletionTemplate {
  if (row.completion_template) {
    const parsed = completionTemplateSchema.safeParse(row.completion_template);
    if (parsed.success) return parsed.data;
  }
  const legacy = row.checklist_items;
  if (legacy && Array.isArray(legacy) && legacy.length > 0) {
    const def = getDefaultCompletionTemplate();
    const withoutOldQuestions = def.blocks.filter((b) => b.type !== 'question');
    const questions = checklistItemsToQuestionBlocks(legacy as ChecklistItem[]);
    return {
      version: COMPLETION_TEMPLATE_VERSION,
      blocks: [...withoutOldQuestions, ...questions],
    };
  }
  return getDefaultCompletionTemplate();
}

export type SubmissionValidationError = { field: string; message: string };

export function validateCompletionSubmission(
  template: CompletionTemplate,
  values: Record<string, unknown>,
  ctx: {
    damageImageCount: number;
    postCleaningImageCount: number;
  }
): SubmissionValidationError[] {
  const errors: SubmissionValidationError[] = [];

  for (const block of template.blocks) {
    const v = values[block.id];

    switch (block.type) {
      case 'static':
        break;
      case 'guest_rating': {
        if (block.required) {
          const n = typeof v === 'number' ? v : Number(v);
          if (!Number.isFinite(n) || n < 1 || n > block.scale) {
            errors.push({ field: block.id, message: `Rating is required (1–${block.scale})` });
          }
        }
        break;
      }
      case 'damage': {
        if (block.required) {
          const choice = typeof v === 'string' ? v : '';
          const opts = block.options ?? [...defaultDamageOptions];
          if (!opts.includes(choice as 'Yes' | 'No' | 'Maybe')) {
            errors.push({ field: block.id, message: 'Damage question is required' });
          } else if (choice === 'Yes' && block.requireImagesWhenYes && ctx.damageImageCount < 1) {
            errors.push({ field: block.id, message: 'Please upload at least one damage image' });
          }
        }
        break;
      }
      case 'question': {
        if (!block.required) break;
        switch (block.questionType) {
          case 'checkbox':
            if (v !== true) errors.push({ field: block.id, message: 'Required' });
            break;
          case 'text':
          case 'textarea':
            if (typeof v !== 'string' || !v.trim()) errors.push({ field: block.id, message: 'Required' });
            break;
          case 'rating': {
            const n = typeof v === 'number' ? v : Number(v);
            const min = block.min ?? 1;
            const max = block.max ?? 5;
            if (!Number.isFinite(n) || n < min || n > max) {
              errors.push({ field: block.id, message: `Rating required (${min}–${max})` });
            }
            break;
          }
          case 'single_choice': {
            const opts = block.options ?? [];
            if (typeof v !== 'string' || !opts.includes(v)) {
              errors.push({ field: block.id, message: 'Please select an option' });
            }
            break;
          }
          case 'number': {
            const n = typeof v === 'number' ? v : Number(v);
            const min = block.min ?? -Infinity;
            const max = block.max ?? Infinity;
            if (!Number.isFinite(n) || n < min || n > max) {
              errors.push({ field: block.id, message: 'Valid number required' });
            }
            break;
          }
          default:
            break;
        }
        break;
      }
      case 'notes': {
        if (block.required && (typeof v !== 'string' || !v.trim())) {
          errors.push({ field: block.id, message: 'This field is required' });
        }
        break;
      }
      case 'post_cleaning': {
        if (block.required && ctx.postCleaningImageCount < 1) {
          errors.push({ field: block.id, message: 'Please upload at least one image' });
        }
        break;
      }
      default:
        break;
    }
  }

  return errors;
}

/** Derive legacy checklist_items map (checkbox questions only) for DB + dashboards */
export function deriveLegacyChecklistMap(
  template: CompletionTemplate,
  values: Record<string, unknown>
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const block of template.blocks) {
    if (block.type === 'question' && block.questionType === 'checkbox') {
      out[block.id] = values[block.id] === true;
    }
  }
  return out;
}

/**
 * Extract core DB fields from template + values (for job_completions columns)
 */
export function extractJobCompletionFields(
  template: CompletionTemplate,
  values: Record<string, unknown>
): {
  cleanliness_rating: number;
  damage_question: 'Yes' | 'No' | 'Maybe';
  missing_items_details: string;
} {
  let cleanliness_rating = 0;
  let damage_question: 'Yes' | 'No' | 'Maybe' = 'No';
  let missing_items_details = '';

  for (const block of template.blocks) {
    if (block.type === 'guest_rating') {
      const n = values[block.id];
      cleanliness_rating =
        typeof n === 'number' ? n : Math.round(Number(n)) || 0;
    }
    if (block.type === 'damage') {
      const c = values[block.id];
      if (c === 'Yes' || c === 'No' || c === 'Maybe') damage_question = c;
    }
    if (block.type === 'notes') {
      const t = values[block.id];
      missing_items_details = typeof t === 'string' ? t : '';
    }
  }

  return { cleanliness_rating, damage_question, missing_items_details };
}

export function getCompletionCompletionPercentage(
  template: CompletionTemplate | null,
  values: Record<string, unknown> | null | undefined,
  legacyChecklistItems?: Record<string, unknown> | null
): number {
  if (values && template) {
    let total = 0;
    let done = 0;
    for (const block of template.blocks) {
      if (block.type === 'static') continue;
      if (block.type === 'guest_rating') {
        total++;
        const n = values[block.id];
        const ok = typeof n === 'number' ? n >= 1 : Number(n) >= 1;
        if (ok) done++;
        continue;
      }
      if (block.type === 'damage') {
        total++;
        const c = values[block.id];
        if (c === 'Yes' || c === 'No' || c === 'Maybe') done++;
        continue;
      }
      if (block.type === 'question') {
        total++;
        const v = values[block.id];
        if (block.questionType === 'checkbox' && v === true) done++;
        else if (
          (block.questionType === 'text' || block.questionType === 'textarea') &&
          typeof v === 'string' &&
          v.trim()
        )
          done++;
        else if (block.questionType === 'rating') {
          const n = typeof v === 'number' ? v : Number(v);
          if (Number.isFinite(n)) done++;
        } else if (block.questionType === 'single_choice' && typeof v === 'string' && v) done++;
        else if (block.questionType === 'number') {
          const n = typeof v === 'number' ? v : Number(v);
          if (Number.isFinite(n)) done++;
        }
        continue;
      }
      if (block.type === 'notes') {
        total++;
        if (typeof values[block.id] === 'string' && (values[block.id] as string).trim()) done++;
        continue;
      }
      if (block.type === 'post_cleaning') {
        if (!block.required) continue;
        total++;
        const media = values[block.id];
        const ok = Array.isArray(media) && media.length > 0;
        if (ok) done++;
        continue;
      }
    }
    if (total === 0) return 0;
    return Math.round((done / total) * 100);
  }
  if (legacyChecklistItems) {
    const items = Object.values(legacyChecklistItems);
    if (items.length === 0) return 0;
    const completed = items.filter((x) => x === true).length;
    return Math.round((completed / items.length) * 100);
  }
  return 0;
}

export function formatBlockLabel(block: CompletionBlock): string {
  switch (block.type) {
    case 'static':
      return block.title || 'Note';
    case 'guest_rating':
      return block.label;
    case 'damage':
      return block.label;
    case 'question':
      return block.label;
    case 'notes':
      return block.label;
    case 'post_cleaning':
      return block.label;
    default: {
      const _b: never = block;
      return String(_b);
    }
  }
}

export function formatAnswerForDisplay(block: CompletionBlock, value: unknown): string {
  if (value === undefined || value === null) return '—';
  if (block.type === 'post_cleaning' && Array.isArray(value)) {
    return `${value.length} file(s)`;
  }
  if (block.type === 'guest_rating' && typeof value === 'number') {
    return `${value}/${block.scale === 10 ? 10 : 5}`;
  }
  if (block.type === 'question' && block.questionType === 'checkbox') {
    return value === true ? 'Yes' : 'No';
  }
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return JSON.stringify(value);
}
