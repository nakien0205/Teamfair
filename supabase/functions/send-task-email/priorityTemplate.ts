export function renderTaskPriorityRow(priority?: string | null): string {
  if (!priority?.trim()) return "";

  return `
              <div class="task-row">
                <div class="task-label">Mức độ ưu tiên:</div>
                <div class="task-value">${priority}</div>
              </div>`;
}
