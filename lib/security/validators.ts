export const JIRA_KEY_RE = /^[A-Z]{1,4}-\d+$/;
export const isValidJiraKey = (s: string) => JIRA_KEY_RE.test(s.trim());
