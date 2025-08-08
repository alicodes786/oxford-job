import { NextResponse } from 'next/server';
import { getSettings, updateSettings, updateIcalSettings, getBankAccounts, addBankAccount, removeBankAccount } from '@/lib/settings';

// GET handler for retrieving settings
export async function GET() {
  try {
    const settings = getSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error getting settings:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve settings' },
      { status: 500 }
    );
  }
}

// POST handler for updating settings
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Handle different operations
    if (body.operation === 'add_bank_account') {
      if (!body.bankAccount || typeof body.bankAccount !== 'string') {
        return NextResponse.json(
          { error: 'Bank account name is required' },
          { status: 400 }
        );
      }
      
      const updatedSettings = addBankAccount(body.bankAccount);
      return NextResponse.json({ 
        success: true, 
        message: 'Bank account added successfully',
        settings: updatedSettings 
      });
    }
    
    if (body.operation === 'remove_bank_account') {
      if (!body.bankAccount || typeof body.bankAccount !== 'string') {
        return NextResponse.json(
          { error: 'Bank account name is required' },
          { status: 400 }
        );
      }
      
      const updatedSettings = removeBankAccount(body.bankAccount);
      return NextResponse.json({ 
        success: true, 
        message: 'Bank account removed successfully',
        settings: updatedSettings 
      });
    }
    
    // Handle iCal settings updates
    if (body.ical) {
      const updatedSettings = updateIcalSettings(body.ical);
      return NextResponse.json({ 
        success: true, 
        message: 'Settings updated successfully',
        settings: updatedSettings 
      });
    }
    
    // Handle general settings updates
    const updatedSettings = updateSettings(body);
    return NextResponse.json({ 
      success: true, 
      message: 'Settings updated successfully',
      settings: updatedSettings 
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update settings' },
      { status: 500 }
    );
  }
} 