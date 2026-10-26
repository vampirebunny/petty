const missLines = [
  (name: string, trick: string) => ({
    title: 'Ooh, so close!',
    body: `${name} almost had ${trick}. Every try still counts.`,
  }),
  (name: string, trick: string) => ({
    title: 'Not this time!',
    body: `${name} missed ${trick}. Every try still counts.`,
  }),
  (name: string, trick: string) => ({
    title: 'Oops!',
    body: `${name} got distracted from ${trick}. Every try still counts.`,
  }),
];

export function missCopy(index: number, name: string, trick: string): { title: string; body: string } {
  const line = missLines[Math.abs(index) % missLines.length] ?? missLines[0];
  return line(name, trick);
}
