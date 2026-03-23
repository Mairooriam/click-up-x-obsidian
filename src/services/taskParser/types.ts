export interface Task {
    id: string;
    name: string;
    parent: string | null; 
    flags?: Record<string, string>;
    level: number;
}

export function getTaskLevel(taskId: string, parentMap: Map<string, string | null>): number {
    let level = 0;
    let currentParent = parentMap.get(taskId);
    
    while (currentParent !== null && currentParent !== undefined) {
        level++;
        currentParent = parentMap.get(currentParent);
    }
    
    return level;
}

export function getTaskWithLevel(task: Task, parentMap: Map<string, string | null>): Task & { level: number } {
    return {
        ...task,
        level: getTaskLevel(task.id, parentMap)
    };
}