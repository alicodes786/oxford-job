import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  completionTemplateSchema,
  checklistItemsFromTemplate,
  resolveCompletionTemplate,
} from '@/lib/completion-template';

// GET /api/listings/[id]/checklist
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: checklist, error } = await supabase
      .from('listing_checklist_templates')
      .select('*')
      .eq('listing_id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    const row = checklist as Record<string, unknown> | null;
    const template = row
      ? resolveCompletionTemplate({
          completion_template: row.completion_template,
          checklist_items: (row.checklist_items as unknown) ?? null,
        })
      : resolveCompletionTemplate({});

    return NextResponse.json({
      success: true,
      checklist: checklist || null,
      completion_template: template,
    });
  } catch (error) {
    console.error('Error fetching checklist:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      },
      { status: 500 }
    );
  }
}

// PUT /api/listings/[id]/checklist
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    let checklist_items = body.checklist_items;
    let completion_template: unknown = body.completion_template;
    let clearTemplate = false;

    if (completion_template !== undefined) {
      const parsed = completionTemplateSchema.safeParse(completion_template);
      if (!parsed.success) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid completion_template: ' + parsed.error.message,
          },
          { status: 400 }
        );
      }
      completion_template = parsed.data;
      checklist_items = checklistItemsFromTemplate(parsed.data);
    } else if (Array.isArray(checklist_items)) {
      // Legacy clients only send checklist_items — drop stored template so GET resolves from checklist
      clearTemplate = true;
    }

    const { data: existing } = await supabase
      .from('listing_checklist_templates')
      .select('id')
      .eq('listing_id', id)
      .single();

    let checklist;

    const updatePayload: Record<string, unknown> = {};
    if (checklist_items !== undefined) {
      updatePayload.checklist_items = checklist_items;
    }
    if (completion_template !== undefined) {
      updatePayload.completion_template = completion_template;
    }
    if (clearTemplate) {
      updatePayload.completion_template = null;
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No checklist_items or completion_template provided' },
        { status: 400 }
      );
    }

    if (existing) {
      const { data, error } = await supabase
        .from('listing_checklist_templates')
        .update(updatePayload)
        .eq('listing_id', id)
        .select()
        .single();

      if (error) throw error;
      checklist = data;
    } else {
      const insertRow: Record<string, unknown> = {
        listing_id: id,
        checklist_items: checklist_items ?? [],
      };
      if (completion_template !== undefined) {
        insertRow.completion_template = completion_template;
      }
      const { data, error } = await supabase
        .from('listing_checklist_templates')
        .insert(insertRow)
        .select()
        .single();

      if (error) throw error;
      checklist = data;
    }

    const template = resolveCompletionTemplate({
      completion_template: (checklist as Record<string, unknown>).completion_template,
      checklist_items: (checklist as Record<string, unknown>).checklist_items as unknown,
    });

    return NextResponse.json({
      success: true,
      checklist,
      completion_template: template,
    });
  } catch (error) {
    console.error('Error saving checklist:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      },
      { status: 500 }
    );
  }
}

// DELETE /api/listings/[id]/checklist
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { error } = await supabase.from('listing_checklist_templates').delete().eq('listing_id', id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Error deleting checklist:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      },
      { status: 500 }
    );
  }
}
