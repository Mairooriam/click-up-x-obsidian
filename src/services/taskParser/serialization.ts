import type { Task } from "./types.js";
import { readFileSync } from "fs";
import { resolve } from "path";
import {TaskIndex} from "./taskIndex.js"
 
//TODO: currently spray and pray. with the |obj and string.
export function deserializeTasks(jsonData: string | object): Task[] {
    try {
        const parsed = typeof jsonData === "string" ? JSON.parse(jsonData) : jsonData;

        const taskArray = Array.isArray(parsed)
            ? parsed
            : parsed.data?.tasks || parsed.tasks || [parsed];

        return taskArray.map((taskData: any): Task => {
            if (!taskData.id || typeof taskData.id !== "string") {
                throw new Error(`Invalid or missing 'id' field in task: ${JSON.stringify(taskData)}`);
            }
            if (!taskData.name || typeof taskData.name !== "string") {
                throw new Error(`Invalid or missing 'name' field in task: ${JSON.stringify(taskData)}`);
            }

            const task: Task = {
                id: taskData.id,
                name: taskData.name,
                parent: taskData.parent || null,
                level: taskData.level || 0,
            };

            if (taskData.flags && typeof taskData.flags === "object") {
                task.flags = taskData.flags;
            }

            return task;
        });
    } catch (error) {
        throw new Error(`Failed to deserialize tasks: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
}

export function deserializeTasksFromFile(filePath: string): Task[] {
    try {
        const absolutePath = resolve(filePath);
        const fileContent = readFileSync(absolutePath, 'utf-8');
        return deserializeTasks(fileContent);
    } catch (error) {
        throw new Error(`Failed to read file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export function serializeTaskToMd(tasks: TaskIndex): string {
    const { rootTasks, linkMap, taskMap } = tasks;

    const serializeTask = (task: Task, level: number): string => {
        // Serialize the current task
        let md = "\t".repeat(level) + `- ${task.name} [id:${task.id}]`;
        if (task.parent) {
            md += ` [parent:${task.parent}]`;
        }
        md += "\n";

        const children = linkMap.get(task.id) || [];
        for (const childId of children) {
            const childTask = taskMap.get(childId);
            if (childTask) {
                md += serializeTask(childTask, level + 1); 
            }
        }

        return md;
    };

    let result = "";
    for (const root of rootTasks) {
        result += serializeTask(root, 0);
    }

    return result;
}
