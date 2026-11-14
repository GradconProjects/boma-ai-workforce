/**
 * Allow-list of tools a bot file may request. Deny by default: a tool must exist here
 * (and later have an implementation) before any bot can be granted it.
 */
export const KNOWN_TOOLS = new Set<string>([
  // Chief of Staff / task engine
  "task_create",
  "task_assign",
  "task_cancel",
  "task_read",
  "owner_message",
  "approval_request",
  "draft_writer",
  "bot_edit_propose",
  // Facebook Page Poster
  "facebook_publish",
  "facebook_read_own_page",
  "facebook_insights",
  // Templates / later phases
  "web_research",
]);
