// Detailed logging system for sync operations

export interface SyncLogEntry {
  timestamp: string;
  operation: 'event_unchanged' | 'event_cancellations' | 'event_date_changes' | 'event_checkout_type_changes' | 'event_additions' | 'event_errors';
  eventId: string;
  listingName: string;
  eventDetails: {
    checkinDate: string;
    checkoutDate: string;
    checkoutType?: string;
    title?: string;
  };
  reasoning: string;
  metadata?: {
    existingEventId?: string;
    oldDates?: {
      checkin: string;
      checkout: string;
    };
    newDates?: {
      checkin: string;
      checkout: string;
    };
    errorDetails?: string;
    feedName?: string;
    uuid?: string;
    matchType?: string;
    operation?: string;
    replacedEventUuid?: string;
    oldCheckoutType?: string;
    newCheckoutType?: string;
    oldEventId?: string;
    newEventId?: string;
    sqlOperation?: string;
    updatedFields?: string;
    checkoutType?: string;
  };
}

export class SyncLogger {
  private logs: SyncLogEntry[] = [];
  private listingName: string;

  constructor(listingName: string) {
    this.listingName = listingName;
  }

  private createLogEntry(
    operation: SyncLogEntry['operation'],
    eventId: string,
    eventDetails: SyncLogEntry['eventDetails'],
    reasoning: string,
    metadata?: SyncLogEntry['metadata']
  ): SyncLogEntry {
    return {
      timestamp: new Date().toISOString(),
      operation,
      eventId,
      listingName: this.listingName,
      eventDetails,
      reasoning,
      metadata
    };
  }

  logEventUnchanged(eventId: string, eventDetails: SyncLogEntry['eventDetails'], reasoning: string, metadata?: SyncLogEntry['metadata']) {
    this.logs.push(this.createLogEntry('event_unchanged', eventId, eventDetails, reasoning, metadata));
  }

  logEventCancellation(eventId: string, eventDetails: SyncLogEntry['eventDetails'], reasoning: string, metadata?: SyncLogEntry['metadata']) {
    this.logs.push(this.createLogEntry('event_cancellations', eventId, eventDetails, reasoning, metadata));
  }

  logEventDateChange(eventId: string, eventDetails: SyncLogEntry['eventDetails'], reasoning: string, metadata?: SyncLogEntry['metadata']) {
    this.logs.push(this.createLogEntry('event_date_changes', eventId, eventDetails, reasoning, metadata));
  }

  logEventCheckoutTypeChange(eventId: string, eventDetails: SyncLogEntry['eventDetails'], reasoning: string, metadata?: SyncLogEntry['metadata']) {
    this.logs.push(this.createLogEntry('event_checkout_type_changes', eventId, eventDetails, reasoning, metadata));
  }

  logEventAddition(eventId: string, eventDetails: SyncLogEntry['eventDetails'], reasoning: string, metadata?: SyncLogEntry['metadata']) {
    this.logs.push(this.createLogEntry('event_additions', eventId, eventDetails, reasoning, metadata));
  }

  logEventError(eventId: string, eventDetails: SyncLogEntry['eventDetails'], reasoning: string, metadata?: SyncLogEntry['metadata']) {
    this.logs.push(this.createLogEntry('event_errors', eventId, eventDetails, reasoning, metadata));
  }

  getLogs(): SyncLogEntry[] {
    return [...this.logs];
  }

  getLogsByOperation(operation: SyncLogEntry['operation']): SyncLogEntry[] {
    return this.logs.filter(log => log.operation === operation);
  }

  getSummary() {
    const summary = {
      total: this.logs.length,
      event_unchanged: this.logs.filter(l => l.operation === 'event_unchanged').length,
      event_cancellations: this.logs.filter(l => l.operation === 'event_cancellations').length,
      event_date_changes: this.logs.filter(l => l.operation === 'event_date_changes').length,
      event_checkout_type_changes: this.logs.filter(l => l.operation === 'event_checkout_type_changes').length,
      event_additions: this.logs.filter(l => l.operation === 'event_additions').length,
      event_errors: this.logs.filter(l => l.operation === 'event_errors').length
    };
    return summary;
  }

  clear() {
    this.logs = [];
  }
} 