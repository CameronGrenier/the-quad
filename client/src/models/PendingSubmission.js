export class PendingSubmission {
    constructor({ orgID = null, eventID = null }) {
      this.orgID = orgID;
      this.eventID = eventID;
    }
  }