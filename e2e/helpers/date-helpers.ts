export function generateUniqueDate(browserName: string, testTitle: string, baseOffset: number = 30): string {
  const hash = simpleHash(`${browserName}-${testTitle}-${Date.now()}`);
  const daysOffset = baseOffset + (hash % 900);
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysOffset);
  return futureDate.toISOString().split('T')[0];
}

function simpleHash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return Math.abs(hash);
}
