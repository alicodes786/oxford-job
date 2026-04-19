import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET - Fetch all issues for a listing
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;

    const { data: issues, error } = await supabase
      .from('listing_issue_log')
      .select('*')
      .eq('listing_id', listingId)
      .order('issue_date', { ascending: false });

    if (error) {
      console.error('Error fetching issues:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch issues'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      issues: issues || []
    });
  } catch (error) {
    console.error('Error in issues GET:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// POST - Create a new issue
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: listingId } = await params;
    const body = await request.json();

    // Validate required fields
    if (!body.issue_date || !body.description) {
      return NextResponse.json({
        success: false,
        error: 'issue_date and description are required'
      }, { status: 400 });
    }

    const { data: issue, error } = await supabase
      .from('listing_issue_log')
      .insert({
        listing_id: listingId,
        issue_date: body.issue_date,
        description: body.description,
        assigned_to: body.assigned_to || null,
        cost: body.cost || null,
        status: body.status || 'open',
        job_completion_id: body.job_completion_id || null,
        created_by_name: body.created_by_name || 'Admin'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating issue:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to create issue'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      issue
    });
  } catch (error) {
    console.error('Error in issues POST:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

