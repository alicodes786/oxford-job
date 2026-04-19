import { z } from 'zod';
import type { ChecklistItem } from '@/lib/models';

export type CompletionQuestionType =
  | 'checkbox'
  | 'text'
  | 'textarea'
  | 'rating'
  | 'single_choice'
  | 'number';

const completionQuestionTypeSchema = z.enum([
  'checkbox',
  'text',
  'textarea',
  'rating',
  'single_choice',
  'number',
]);

const staticBlockSchema = z.object({
  type: z.literal('static'),
  id: z.string(),
  title: z.string().optional(),
  body: z.string().optional(),
});

const guestRatingBlockSchema = z.object({
  type: z.literal('guest_rating'),
  id: z.string(),
  label: z.string(),
  required: z.boolean(),
  scale: z.union([z.literal(5), z.literal(10)]),
});

const damageBlockSchema = z.object({
  type: z.literal('damage'),
  id: z.string(),
  label: z.string(),
  required: z.boolean(),
  requireImagesWhenYes: z.boolean(),
  options: z.tuple([z.string(), z.string(), z.string()]).optional(),
});

const questionBlockSchema = z.object({
  type: z.literal('question'),
  id: z.string(),
  questionType: completionQuestionTypeSchema,
  label: z.string(),
  required: z.boolean(),
  placeholder: z.string().optional(),
  options: z.array(z.string()).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  order: z.number().optional(),
});

const notesBlockSchema = z.object({
  type: z.literal('notes'),
  id: z.string(),
  label: z.string(),
  placeholder: z.string(),
  required: z.boolean(),
});

const postCleaningBlockSchema = z.object({
  type: z.literal('post_cleaning'),
  id: z.string(),
  label: z.string(),
  required: z.boolean(),
  maxFiles: z.number().positive().max(20),
});

const completionBlockSchema = z.discriminatedUnion('type', [
  staticBlockSchema,
  guestRatingBlockSchema,
  damageBlockSchema,
  questionBlockSchema,
  notesBlockSchema,
  postCleaningBlockSchema,
]);

export const completionTemplateSchema = z.object({
  version: z.number().int().min(1),
  blocks: z.array(completionBlockSchema).min(1),
});

export type CompletionBlock = z.infer<typeof completionBlockSchema>;
export type CompletionTemplate = z.infer<typeof completionTemplateSchema>;

export function getDefaultCompletionTemplate(): CompletionTemplate {
  return {
    version: 1,
    blocks: [
      {
        type: 'guest_rating',
        id: 'default-guest-rating',
        label: 'How dirty or clean did the guest leave the unit?',
        required: true,
        scale: 5,
      },
      {
        type: 'damage',
        id: 'default-damage',
        label: 'Was there any notable damage?',
        required: true,
        requireImagesWhenYes: true,
        options: ['Yes', 'No', 'Maybe'],
      },
      {
        type: 'post_cleaning',
        id: 'default-post-cleaning',
        label: 'Post-cleaning photos',
        required: false,
        maxFiles: 10,
      },
    ],
  };
}

/** Legacy checklist rows stored alongside the rich template (for older UI / reports). */
export function checklistItemsFromTemplate(template: CompletionTemplate): ChecklistItem[] {
  let order = 1;
  const out: ChecklistItem[] = [];
  for (const block of template.blocks) {
    switch (block.type) {
      case 'static':
        out.push({
          id: block.id,
          type: 'text',
          question: [block.title, block.body].filter(Boolean).join(' — ') || 'Note',
          required: false,
          order: order++,
        });
        break;
      case 'guest_rating':
        out.push({
          id: block.id,
          type: 'rating',
          question: block.label,
          required: block.required,
          order: order++,
        });
        break;
      case 'damage':
        out.push({
          id: block.id,
          type: 'checkbox',
          question: block.label,
          required: block.required,
          order: order++,
        });
        break;
      case 'question': {
        const qt = block.questionType;
        const type: ChecklistItem['type'] =
          qt === 'rating' ? 'rating' : qt === 'checkbox' ? 'checkbox' : 'text';
        out.push({
          id: block.id,
          type,
          question: block.label,
          required: block.required,
          order: order++,
        });
        break;
      }
      case 'notes':
        out.push({
          id: block.id,
          type: 'text',
          question: block.label,
          required: block.required,
          order: order++,
        });
        break;
      case 'post_cleaning':
        out.push({
          id: block.id,
          type: 'checkbox',
          question: block.label,
          required: block.required,
          order: order++,
        });
        break;
    }
  }
  return out;
}

function legacyChecklistToTemplate(items: ChecklistItem[]): CompletionTemplate {
  const sorted = [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const blocks: CompletionBlock[] = sorted.map((item) => {
    if (item.type === 'rating') {
      return {
        type: 'question',
        id: item.id,
        questionType: 'rating',
        label: item.question,
        required: item.required,
      };
    }
    if (item.type === 'text') {
      return {
        type: 'question',
        id: item.id,
        questionType: 'textarea',
        label: item.question,
        required: item.required,
      };
    }
    return {
      type: 'question',
      id: item.id,
      questionType: 'checkbox',
      label: item.question,
      required: item.required,
    };
  });
  const candidate = { version: 1 as const, blocks };
  const parsed = completionTemplateSchema.safeParse(candidate);
  return parsed.success ? parsed.data : getDefaultCompletionTemplate();
}

function isLegacyChecklistItemArray(value: unknown): value is ChecklistItem[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  const first = value[0];
  return (
    first !== null &&
    typeof first === 'object' &&
    'id' in first &&
    'type' in first &&
    'question' in first &&
    'required' in first
  );
}

/**
 * Normalizes stored DB row fields into a validated `CompletionTemplate`.
 * Prefers `completion_template`; falls back to legacy `checklist_items`; then default.
 */
export function resolveCompletionTemplate(input: {
  completion_template?: unknown;
  checklist_items?: unknown;
}): CompletionTemplate {
  const rawTemplate = input.completion_template;
  if (rawTemplate !== undefined && rawTemplate !== null) {
    const parsed = completionTemplateSchema.safeParse(rawTemplate);
    if (parsed.success) return parsed.data;
  }
  if (isLegacyChecklistItemArray(input.checklist_items)) {
    return legacyChecklistToTemplate(input.checklist_items);
  }
  return getDefaultCompletionTemplate();
}
