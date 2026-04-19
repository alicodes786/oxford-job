'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Edit, Trash2, GripVertical, Save, ClipboardList, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import {
  type CompletionBlock,
  type CompletionQuestionType,
  type CompletionTemplate,
  getDefaultCompletionTemplate,
  completionTemplateSchema,
} from '@/lib/completion-template';

interface CompletionFormBuilderProps {
  listingId: string;
  listingName: string;
}

const QUESTION_TYPES: { value: CompletionQuestionType; label: string }[] = [
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'text', label: 'Short text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'rating', label: 'Rating (1–5)' },
  { value: 'single_choice', label: 'Single choice' },
  { value: 'number', label: 'Number' },
];

function newBlockId(): string {
  return `blk-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function CompletionFormBuilder({ listingId, listingName }: CompletionFormBuilderProps) {
  const [template, setTemplate] = useState<CompletionTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [addType, setAddType] = useState<CompletionBlock['type']>('question');

  const [draft, setDraft] = useState<Partial<CompletionBlock>>({});

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/listings/${listingId}/checklist`);
      const data = await res.json();
      if (data.success && data.completion_template) {
        const parsed = completionTemplateSchema.safeParse(data.completion_template);
        setTemplate(parsed.success ? parsed.data : getDefaultCompletionTemplate());
      } else {
        setTemplate(getDefaultCompletionTemplate());
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load completion form');
      setTemplate(getDefaultCompletionTemplate());
    } finally {
      setIsLoading(false);
    }
  }, [listingId]);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = (type: CompletionBlock['type']) => {
    setEditingIndex(null);
    setAddType(type);
    const id = newBlockId();
    if (type === 'static') {
      setDraft({ type: 'static', id, title: '', body: '' });
    } else if (type === 'guest_rating') {
      setDraft({
        type: 'guest_rating',
        id,
        label: 'How dirty or clean did the guest leave the unit?',
        required: true,
        scale: 5,
      });
    } else if (type === 'damage') {
      setDraft({
        type: 'damage',
        id,
        label: 'Was there any notable damage?',
        required: true,
        requireImagesWhenYes: true,
        options: ['Yes', 'No', 'Maybe'],
      });
    } else if (type === 'question') {
      setDraft({
        type: 'question',
        id,
        questionType: 'checkbox',
        label: '',
        required: true,
      });
    } else if (type === 'notes') {
      setDraft({
        type: 'notes',
        id,
        label: 'Additional notes',
        placeholder: '',
        required: true,
      });
    } else if (type === 'post_cleaning') {
      setDraft({
        type: 'post_cleaning',
        id,
        label: 'Post-cleaning photos',
        required: false,
        maxFiles: 10,
      });
    }
    setDialogOpen(true);
  };

  const openEdit = (index: number) => {
    if (!template) return;
    setEditingIndex(index);
    setDraft({ ...template.blocks[index] });
    setAddType(template.blocks[index].type);
    setDialogOpen(true);
  };

  const applyDraft = () => {
    if (!template) return;
    const parsed = completionBlockFromDraft(draft, addType);
    if (!parsed) {
      toast.error('Please fill required fields');
      return;
    }
    const next = { ...template, blocks: [...template.blocks] };
    if (editingIndex !== null) {
      next.blocks[editingIndex] = parsed;
    } else {
      next.blocks.push(parsed);
    }
    const checked = completionTemplateSchema.safeParse(next);
    if (!checked.success) {
      toast.error('Invalid form: ' + checked.error.message);
      return;
    }
    setTemplate(checked.data);
    setDialogOpen(false);
    setDraft({});
  };

  const removeBlock = (index: number) => {
    if (!template || !confirm('Remove this block?')) return;
    const next = {
      ...template,
      blocks: template.blocks.filter((_, i) => i !== index),
    };
    if (next.blocks.length === 0) {
      toast.error('At least one block is required');
      return;
    }
    setTemplate(next);
  };

  const move = (index: number, dir: -1 | 1) => {
    if (!template) return;
    const j = index + dir;
    if (j < 0 || j >= template.blocks.length) return;
    const blocks = [...template.blocks];
    [blocks[index], blocks[j]] = [blocks[j], blocks[index]];
    setTemplate({ ...template, blocks });
  };

  const handleSave = async () => {
    if (!template) return;
    const checked = completionTemplateSchema.safeParse(template);
    if (!checked.success) {
      toast.error('Invalid template: ' + checked.error.message);
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(`/api/listings/${listingId}/checklist`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completion_template: checked.data }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Completion form saved');
        if (data.completion_template) setTemplate(data.completion_template);
      } else {
        toast.error(data.error || 'Save failed');
      }
    } catch (e) {
      console.error(e);
      toast.error('Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  const resetDefault = () => {
    if (!confirm('Replace the form with the default template?')) return;
    setTemplate(getDefaultCompletionTemplate());
  };

  if (isLoading || !template) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-gray-500">Loading completion form…</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Cleaner job completion form — {listingName}
            </CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              Configure every section cleaners see when they finish a job for this listing (ratings, damage,
              custom questions, photos).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={resetDefault}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset to default
            </Button>
            <Select onValueChange={(v) => openAdd(v as CompletionBlock['type'])}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Add block" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="static">Static note</SelectItem>
                <SelectItem value="guest_rating">Guest cleanliness rating</SelectItem>
                <SelectItem value="damage">Damage question</SelectItem>
                <SelectItem value="question">Custom question</SelectItem>
                <SelectItem value="notes">Notes / free text</SelectItem>
                <SelectItem value="post_cleaning">Post-cleaning media</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-1" />
              {isSaving ? 'Saving…' : 'Save form'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {template.blocks.map((block, index) => (
          <div
            key={block.id}
            className="border rounded-lg p-3 flex gap-3 items-start bg-white hover:bg-gray-50/50"
          >
            <div className="flex flex-col gap-1 pt-1">
              <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => move(index, -1)} disabled={index === 0}>
                ▲
              </Button>
              <GripVertical className="h-4 w-4 text-gray-400" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => move(index, 1)}
                disabled={index === template.blocks.length - 1}
              >
                ▼
              </Button>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold uppercase text-gray-500">{block.type.replace('_', ' ')}</div>
              <div className="font-medium text-gray-900 truncate">{blockSummary(block)}</div>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(index)}>
                <Edit className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="sm" className="text-red-600" onClick={() => removeBlock(index)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingIndex !== null ? 'Edit block' : 'Add block'}</DialogTitle>
            </DialogHeader>
            <BlockEditorForm draft={draft} setDraft={setDraft} addType={addType} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={applyDraft}>
                {editingIndex !== null ? 'Update' : 'Add'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function blockSummary(block: CompletionBlock): string {
  switch (block.type) {
    case 'static':
      return block.title || block.body || 'Note';
    case 'guest_rating':
      return block.label;
    case 'damage':
      return block.label;
    case 'question':
      return block.label || 'Question';
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

function completionBlockFromDraft(
  draft: Partial<CompletionBlock>,
  addType: CompletionBlock['type']
): CompletionBlock | null {
  if (!draft.id) return null;
  switch (addType) {
    case 'static':
      return {
        type: 'static',
        id: draft.id,
        title: (draft as CompletionBlock & { type: 'static' }).title,
        body: (draft as CompletionBlock & { type: 'static' }).body,
      };
    case 'guest_rating': {
      const d = draft as Extract<CompletionBlock, { type: 'guest_rating' }>;
      if (!d.label?.trim()) return null;
      return {
        type: 'guest_rating',
        id: d.id,
        label: d.label.trim(),
        required: !!d.required,
        scale: d.scale === 10 ? 10 : 5,
      };
    }
    case 'damage': {
      const d = draft as Extract<CompletionBlock, { type: 'damage' }>;
      if (!d.label?.trim()) return null;
      return {
        type: 'damage',
        id: d.id,
        label: d.label.trim(),
        required: !!d.required,
        requireImagesWhenYes: !!d.requireImagesWhenYes,
        options:
          d.options && d.options.length === 3
            ? ([d.options[0], d.options[1], d.options[2]] as [string, string, string])
            : undefined,
      };
    }
    case 'question': {
      const d = draft as Extract<CompletionBlock, { type: 'question' }>;
      if (!d.label?.trim()) return null;
      const base: Extract<CompletionBlock, { type: 'question' }> = {
        type: 'question',
        id: d.id,
        questionType: d.questionType || 'checkbox',
        label: d.label.trim(),
        required: !!d.required,
        placeholder: d.placeholder,
        options: d.options,
        min: d.min,
        max: d.max,
        order: d.order,
      };
      if (base.questionType === 'single_choice' && (!base.options || base.options.length < 2)) {
        return null;
      }
      return base;
    }
    case 'notes': {
      const d = draft as Extract<CompletionBlock, { type: 'notes' }>;
      if (!d.label?.trim()) return null;
      return {
        type: 'notes',
        id: d.id,
        label: d.label.trim(),
        placeholder: d.placeholder || '',
        required: !!d.required,
      };
    }
    case 'post_cleaning': {
      const d = draft as Extract<CompletionBlock, { type: 'post_cleaning' }>;
      if (!d.label?.trim()) return null;
      return {
        type: 'post_cleaning',
        id: d.id,
        label: d.label.trim(),
        required: !!d.required,
        maxFiles: d.maxFiles && d.maxFiles > 0 ? d.maxFiles : 10,
      };
    }
    default:
      return null;
  }
}

function BlockEditorForm({
  draft,
  setDraft,
  addType,
}: {
  draft: Partial<CompletionBlock>;
  setDraft: React.Dispatch<React.SetStateAction<Partial<CompletionBlock>>>;
  addType: CompletionBlock['type'];
}) {
  if (addType === 'static') {
    const d = draft as Extract<CompletionBlock, { type: 'static' }>;
    return (
      <div className="space-y-3">
        <div>
          <Label>Title</Label>
          <Input
            value={d.title || ''}
            onChange={(e) => setDraft({ ...d, type: 'static', title: e.target.value })}
          />
        </div>
        <div>
          <Label>Body</Label>
          <Textarea
            value={d.body || ''}
            onChange={(e) => setDraft({ ...d, type: 'static', body: e.target.value })}
            rows={4}
          />
        </div>
      </div>
    );
  }

  if (addType === 'guest_rating') {
    const d = draft as Extract<CompletionBlock, { type: 'guest_rating' }>;
    return (
      <div className="space-y-3">
        <div>
          <Label>Label</Label>
          <Input
            value={d.label || ''}
            onChange={(e) => setDraft({ ...d, type: 'guest_rating', label: e.target.value })}
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={!!d.required}
            onCheckedChange={(c) => setDraft({ ...d, type: 'guest_rating', required: c })}
          />
          <Label>Required</Label>
        </div>
        <div>
          <Label>Scale</Label>
          <Select
            value={String(d.scale ?? 5)}
            onValueChange={(v) =>
              setDraft({ ...d, type: 'guest_rating', scale: v === '10' ? 10 : 5 })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">1–5</SelectItem>
              <SelectItem value="10">1–10</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  if (addType === 'damage') {
    const d = draft as Extract<CompletionBlock, { type: 'damage' }>;
    const opts = d.options || ['Yes', 'No', 'Maybe'];
    return (
      <div className="space-y-3">
        <div>
          <Label>Label</Label>
          <Input
            value={d.label || ''}
            onChange={(e) => setDraft({ ...d, type: 'damage', label: e.target.value })}
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={!!d.required}
            onCheckedChange={(c) => setDraft({ ...d, type: 'damage', required: c })}
          />
          <Label>Required</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={!!d.requireImagesWhenYes}
            onCheckedChange={(c) => setDraft({ ...d, type: 'damage', requireImagesWhenYes: c })}
          />
          <Label>Require photos when &quot;Yes&quot;</Label>
        </div>
        {d.requireImagesWhenYes && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-900">
              When cleaners select &quot;Yes&quot; for damage, they will be required to upload at least one photo before submitting.
            </p>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          {opts.map((o, i) => (
            <div key={i}>
              <Label className="text-xs">Option {i + 1}</Label>
              <Input
                value={o}
                onChange={(e) => {
                  const next = [...opts] as [string, string, string];
                  next[i] = e.target.value;
                  setDraft({ ...d, type: 'damage', options: next });
                }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (addType === 'question') {
    const d = draft as Extract<CompletionBlock, { type: 'question' }>;
    const qt = d.questionType || 'checkbox';
    return (
      <div className="space-y-3">
        <div>
          <Label>Question type</Label>
          <Select
            value={qt}
            onValueChange={(v) =>
              setDraft({
                ...d,
                type: 'question',
                questionType: v as CompletionQuestionType,
                options: v === 'single_choice' ? ['Option A', 'Option B'] : undefined,
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUESTION_TYPES.map((q) => (
                <SelectItem key={q.value} value={q.value}>
                  {q.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Question</Label>
          <Textarea
            value={d.label || ''}
            onChange={(e) => setDraft({ ...d, type: 'question', label: e.target.value })}
            rows={2}
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={!!d.required}
            onCheckedChange={(c) => setDraft({ ...d, type: 'question', required: c })}
          />
          <Label>Required</Label>
        </div>
        {(qt === 'text' || qt === 'textarea' || qt === 'number') && (
          <div>
            <Label>Placeholder</Label>
            <Input
              value={d.placeholder || ''}
              onChange={(e) => setDraft({ ...d, type: 'question', placeholder: e.target.value })}
            />
          </div>
        )}
        {qt === 'single_choice' && (
          <div>
            <Label>Options (one per line)</Label>
            <Textarea
              value={(d.options || []).join('\n')}
              onChange={(e) =>
                setDraft({
                  ...d,
                  type: 'question',
                  options: e.target.value
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              rows={4}
            />
          </div>
        )}
        {(qt === 'rating' || qt === 'number') && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Min</Label>
              <Input
                type="number"
                value={d.min ?? ''}
                onChange={(e) =>
                  setDraft({ ...d, type: 'question', min: parseFloat(e.target.value) || undefined })
                }
              />
            </div>
            <div>
              <Label>Max</Label>
              <Input
                type="number"
                value={d.max ?? ''}
                onChange={(e) =>
                  setDraft({ ...d, type: 'question', max: parseFloat(e.target.value) || undefined })
                }
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  if (addType === 'notes') {
    const d = draft as Extract<CompletionBlock, { type: 'notes' }>;
    return (
      <div className="space-y-3">
        <div>
          <Label>Label</Label>
          <Input
            value={d.label || ''}
            onChange={(e) => setDraft({ ...d, type: 'notes', label: e.target.value })}
          />
        </div>
        <div>
          <Label>Placeholder</Label>
          <Input
            value={d.placeholder || ''}
            onChange={(e) => setDraft({ ...d, type: 'notes', placeholder: e.target.value })}
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={!!d.required}
            onCheckedChange={(c) => setDraft({ ...d, type: 'notes', required: c })}
          />
          <Label>Required</Label>
        </div>
      </div>
    );
  }

  if (addType === 'post_cleaning') {
    const d = draft as Extract<CompletionBlock, { type: 'post_cleaning' }>;
    return (
      <div className="space-y-3">
        <div>
          <Label>Label</Label>
          <Input
            value={d.label || ''}
            onChange={(e) => setDraft({ ...d, type: 'post_cleaning', label: e.target.value })}
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={!!d.required}
            onCheckedChange={(c) => setDraft({ ...d, type: 'post_cleaning', required: c })}
          />
          <Label>Required</Label>
        </div>
        <div>
          <Label>Max files</Label>
          <Input
            type="number"
            min={1}
            max={20}
            value={d.maxFiles ?? 10}
            onChange={(e) =>
              setDraft({
                ...d,
                type: 'post_cleaning',
                maxFiles: Math.min(20, Math.max(1, parseInt(e.target.value, 10) || 10)),
              })
            }
          />
        </div>
      </div>
    );
  }

  return null;
}
