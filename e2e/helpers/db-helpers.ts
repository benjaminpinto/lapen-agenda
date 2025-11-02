import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function resetTestDatabase() {
  try {
    await execAsync('python setup_db.py', { cwd: process.cwd() });
  } catch (error) {
    console.error('Failed to reset database:', error);
  }
}

export async function seedTestData() {
  // Add test data seeding if needed
}

export async function cleanupTestData() {
  // Clean up test data after tests
}
