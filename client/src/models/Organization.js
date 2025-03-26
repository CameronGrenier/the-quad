export class Organization {
  constructor({ orgID, name, description, thumbnail, banner, privacy }) {
    this.orgID = orgID;
    this.name = name;
    this.description = description;
    this.thumbnail = thumbnail;
    this.banner = banner;
    this.privacy = privacy;
  }
  async createOrganization() { /* see OrganizationController.registerOrganization */ }
  async modifyOrganization() { /* implement as needed */ }
  async joinOrganization() { /* implement membership joining logic */ }
}