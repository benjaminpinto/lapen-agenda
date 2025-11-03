import { APIRequestContext } from '@playwright/test';

export async function cleanupTestData(request: APIRequestContext, projectName: string) {
  try {
    // Delete test users by project-specific prefix
    const response = await request.delete(`/api/test/cleanup?email_prefix=${projectName}.`);
    if (response.ok()) {
      const data = await response.json();
      if (data.users_deleted > 0 || data.bets_deleted > 0) {
        console.log(`[Cleanup ${projectName}] Deleted ${data.users_deleted} users and ${data.bets_deleted} bets`);
      }
    }
  } catch (error) {
    console.error(`[Cleanup ${projectName}] Error:`, error);
  }
}

export function getProjectPrefix(projectName: string): string {
  return `${projectName}.${Date.now()}.${Math.random().toString(36).substring(7)}`;
}
