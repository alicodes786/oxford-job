import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET - Fetch all bank accounts
export async function GET() {
  try {
    const { data: bankAccounts, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching bank accounts:', error);
      return NextResponse.json(
        { error: 'Failed to fetch bank accounts' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      bankAccounts: bankAccounts || []
    });
  } catch (error) {
    console.error('Error in GET /api/bank-accounts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create a new bank account
export async function POST(request: Request) {
  try {
    const { name } = await request.json();

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'Bank account name is required' },
        { status: 400 }
      );
    }

    const { data: bankAccount, error } = await supabase
      .from('bank_accounts')
      .insert([{ name: name.trim() }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return NextResponse.json(
          { error: 'Bank account already exists' },
          { status: 400 }
        );
      }
      console.error('Error creating bank account:', error);
      return NextResponse.json(
        { error: 'Failed to create bank account' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Bank account created successfully',
      bankAccount
    });
  } catch (error) {
    console.error('Error in POST /api/bank-accounts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a bank account
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');

    if (!name) {
      return NextResponse.json(
        { error: 'Bank account name is required' },
        { status: 400 }
      );
    }

    // Check if any listings are using this bank account
    const { data: listings, error: listingsError } = await supabase
      .from('listings')
      .select('id, name')
      .eq('bank_account', name);

    if (listingsError) {
      console.error('Error checking listings:', listingsError);
      return NextResponse.json(
        { error: 'Failed to check bank account usage' },
        { status: 500 }
      );
    }

    if (listings && listings.length > 0) {
      return NextResponse.json(
        { error: `Cannot delete bank account "${name}" - it's assigned to ${listings.length} properties` },
        { status: 400 }
      );
    }

    // Delete the bank account
    const { error } = await supabase
      .from('bank_accounts')
      .delete()
      .eq('name', name);

    if (error) {
      console.error('Error deleting bank account:', error);
      return NextResponse.json(
        { error: 'Failed to delete bank account' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Bank account deleted successfully'
    });
  } catch (error) {
    console.error('Error in DELETE /api/bank-accounts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 