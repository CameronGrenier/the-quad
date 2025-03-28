/**
 * PendingSubmission class represents a pending submission in the system.
 */
export class PendingSubmission {
  constructor({ orgID = null, eventID = null }) {
    this.orgID = orgID;
    this.eventID = eventID;
  }
}