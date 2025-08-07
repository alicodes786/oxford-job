import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Simple test endpoint to simulate a sync with cancellations and modifications
export async function GET(request: Request) {
  try {
    // First, let's test the basic Slack notification endpoint
    const testResponse = await fetch(`${request.url.split('/test-sync-events')[0]}/test-slack`, {
      method: 'GET'
    });
    
    if (!testResponse.ok) {
      console.error('Basic Slack test failed', await testResponse.text());
      throw new Error('Basic Slack notification test failed');
    }
    
    const testResult = await testResponse.json();
    console.log('Basic Slack test result:', testResult);
    
    // Now let's test a more realistic scenario by running a sync with simulated data
    const syncResponse = await fetch(`${request.url.split('/test-sync-events')[0]}/sync-events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ test: true }) // This will be ignored but completes the request
    });
    
    if (!syncResponse.ok) {
      throw new Error('Failed to run sync test');
    }
    
    const syncResult = await syncResponse.json();
    
    return NextResponse.json({
      success: true,
      message: 'Test sync completed successfully',
      basicTest: testResult,
      syncTest: syncResult
    });
  } catch (error) {
    console.error('Error running sync test:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
}

// POST endpoint for more advanced simulation
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { simulate, createTestFeed } = body;
    
    // Create a test feed if requested
    if (createTestFeed) {
      try {
        // Find or create test listing
        const testListingId = await ensureTestListing();
        
        // Create a temporary iCal feed
        const { data: feedData, error: feedError } = await supabase
          .from('ical_feeds')
          .insert({
            external_id: `test-feed-${Date.now()}`,
            url: 'https://www.airbnb.com/calendar/ical/658587657837235616.ics?s=3cf029c5a837b391a28061187820b06d&locale=en-GB',
            name: 'Test iCal Feed',
            is_active: true,
            color: '#FF0000',
            last_synced: null
          })
          .select();
          
        if (feedError || !feedData || feedData.length === 0) {
          throw feedError || new Error('Failed to create test feed');
        }
        
        const feedId = feedData[0].id;
        
        // Associate feed with listing
        const { error: associationError } = await supabase
          .from('listing_ical_feeds')
          .insert({
            listing_id: testListingId,
            ical_feed_id: feedId
          });
          
        if (associationError) throw associationError;
        
        // Run a sync to populate events
        const syncResponse = await fetch(`${request.url.split('/test-sync-events')[0]}/sync-events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ test: true })
        });
        
        if (!syncResponse.ok) {
          throw new Error('Failed to run sync after creating test feed');
        }
        
        const syncResult = await syncResponse.json();
        
        return NextResponse.json({
          success: true,
          message: 'Test feed created and synced successfully',
          testListingId,
          feedId,
          syncResult
        });
      } catch (error) {
        console.error('Error creating test feed:', error);
        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : 'An unknown error occurred'
        }, { status: 500 });
      }
    }
    
    // Simulate a cancellation by adding a temporary event and then "canceling" it
    if (simulate === 'cancellation') {
      // Create a temporary event
      const tempEvent = {
        // Let Supabase auto-generate the UUID
        event_id: `temp-${Date.now()}`,
        listing_name: '185.2',
        listing_hours: 'Default hours',
        checkin_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        checkout_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days from now
        checkout_type: 'open',
        checkout_time: '10:00:00',
        is_active: true,
        event_type: 'ical'
      };
      
      // Insert the event
      const { data: insertedEvent, error: insertError } = await supabase
        .from('events')
        .insert(tempEvent)
        .select();
        
      if (insertError || !insertedEvent) throw insertError || new Error('Failed to insert test event');
      
      // Now mark it as canceled
      const { error: updateError } = await supabase
        .from('events')
        .update({ is_active: false })
        .eq('uuid', insertedEvent[0].uuid);
        
      if (updateError) throw updateError;
      
      // Send a simulated notification
      await fetch(`${request.url.split('/test-sync-events')[0]}/test-slack`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: '🚨 Test Cancellation Alert',
          content: `
*This is a test cancellation notification*

• *Listing:* 185.2
• *Check-in:* ${new Date(tempEvent.checkin_date).toLocaleDateString()}
• *Check-out:* ${new Date(tempEvent.checkout_date).toLocaleDateString()}

This is a simulated cancellation for testing purposes.
          `
        })
      });
      
      return NextResponse.json({
        success: true,
        message: 'Cancellation simulation completed',
        event: insertedEvent[0]
      });
    }
    
    // Simulate a modification
    if (simulate === 'modification') {
      // Create initial event
      const originalEvent = {
        // Let Supabase auto-generate the UUID
        event_id: `temp-event-id-${Date.now()}`,
        listing_name: '185.2',
        listing_hours: 'Default hours',
        checkin_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days from now
        checkout_date: new Date(Date.now() + 17 * 24 * 60 * 60 * 1000).toISOString(), // 17 days from now
        checkout_type: 'open',
        checkout_time: '10:00:00',
        is_active: true,
        event_type: 'ical'
      };
      
      // Insert the original event
      const { data: insertedOriginal, error: insertError } = await supabase
        .from('events')
        .insert(originalEvent)
        .select();
        
      if (insertError || !insertedOriginal) throw insertError || new Error('Failed to insert original event');
      
      // Now deactivate the original and create a modified version
      const { error: updateError } = await supabase
        .from('events')
        .update({ is_active: false })
        .eq('uuid', insertedOriginal[0].uuid);
        
      if (updateError) throw updateError;
      
      // Create modified event with same event_id but different dates
      const modifiedEvent = {
        // Let Supabase auto-generate the UUID
        event_id: originalEvent.event_id, // Same event ID
        listing_name: '185.2',
        listing_hours: 'Default hours',
        checkin_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days from now (1 day later)
        checkout_date: new Date(Date.now() + 19 * 24 * 60 * 60 * 1000).toISOString(), // 19 days from now (2 days longer)
        checkout_type: 'open',
        checkout_time: '10:00:00',
        is_active: true,
        event_type: 'ical'
      };
      
      // Insert the modified event
      const { data: insertedModified, error: insertModifiedError } = await supabase
        .from('events')
        .insert(modifiedEvent)
        .select();
        
      if (insertModifiedError || !insertedModified) throw insertModifiedError || new Error('Failed to insert modified event');
      
      // Send a simulated notification
      await fetch(`${request.url.split('/test-sync-events')[0]}/test-slack`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: '📅 Test Modification Alert',
          content: `
*This is a test modification notification*

• *Listing:* 185.2
• *Old Check-in:* ${new Date(originalEvent.checkin_date).toLocaleDateString()} → *New Check-in:* ${new Date(modifiedEvent.checkin_date).toLocaleDateString()}
• *Old Check-out:* ${new Date(originalEvent.checkout_date).toLocaleDateString()} → *New Check-out:* ${new Date(modifiedEvent.checkout_date).toLocaleDateString()}

This is a simulated modification for testing purposes.
          `
        })
      });
      
      return NextResponse.json({
        success: true,
        message: 'Modification simulation completed',
        originalEvent: insertedOriginal[0],
        modifiedEvent: insertedModified[0]
      });
    }
    
    // Simulate multi-feed sync
    if (simulate === 'multi-feed') {
      try {
        // Find or create test listing
        const testListingId = await ensureTestListing();
        
        // Create multiple test feeds
        const feedIds = [];
        
        // Create 3 test feeds
        for (let i = 0; i < 3; i++) {
          // Create the feed
          const { data: feedData, error: feedError } = await supabase
            .from('ical_feeds')
            .insert({
              external_id: `test-feed-${i}-${Date.now()}`,
              url: 'https://www.airbnb.com/calendar/ical/658587657837235616.ics?s=3cf029c5a837b391a28061187820b06d&locale=en-GB',
              name: `Test Feed ${i + 1}`,
              is_active: true,
              color: '#FF0000',
              last_synced: null
            })
            .select();
            
          if (feedError || !feedData || feedData.length === 0) {
            throw feedError || new Error(`Failed to create test feed ${i + 1}`);
          }
          
          const feedId = feedData[0].id;
          feedIds.push(feedId);
          
          // Associate feed with listing
          const { error: associationError } = await supabase
            .from('listing_ical_feeds')
            .insert({
              listing_id: testListingId,
              ical_feed_id: feedId
            });
            
          if (associationError) throw associationError;
        }
        
        // Run a sync to populate events
        const syncResponse = await fetch(`${request.url.split('/test-sync-events')[0]}/sync-events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ test: true })
        });
        
        if (!syncResponse.ok) {
          throw new Error('Failed to run sync for multi-feed test');
        }
        
        const syncResult = await syncResponse.json();
        
        return NextResponse.json({
          success: true,
          message: 'Multi-feed test completed successfully',
          testListingId,
          feedIds,
          syncResult
        });
      } catch (error) {
        console.error('Error running multi-feed test:', error);
        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : 'An unknown error occurred'
        }, { status: 500 });
      }
    }
    
    return NextResponse.json({
      success: false,
      error: 'Invalid simulation type. Use "cancellation", "modification", "createTestFeed", or "multi-feed".'
    }, { status: 400 });
  } catch (error) {
    console.error('Error running simulation:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    }, { status: 500 });
  }
}

// Helper function to ensure a test listing exists
async function ensureTestListing() {
  // Check if test listing already exists
  const { data: existingListing } = await supabase
    .from('listings')
    .select('id')
    .eq('name', 'Test Listing')
    .maybeSingle();
    
  if (existingListing) {
    return existingListing.id;
  }
  
  // Create a new test listing
  const { data: listingData, error } = await supabase
    .from('listings')
    .insert({
      external_id: `test-listing-${Date.now()}`,
      name: 'Test Listing',
      hours: 2.0,
      color: '#0000FF'
    })
    .select();
    
  if (error || !listingData || listingData.length === 0) {
    throw error || new Error('Failed to create test listing');
  }
  
  return listingData[0].id;
} 