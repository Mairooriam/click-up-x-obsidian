import type {Task} from "./types.js"
import {Lexer} from "./lexer.js"
import { Parser } from "./parser.js";

export interface TaskIndex {
    taskMap: Map<string, Task>;
    linkMap: Map<string, string[]>;
    parentMap: Map<string, string | null>;
    levelMap: Map<string, number>;
    rootTasks: Task[];
}

export class TaskIndexer {

    indexTasks(tasks: Task[]): TaskIndex {
        const tasksWithLevels = this.computeLevels(tasks);
        
        const taskMap = new Map<string, Task>();
        const linkMap = new Map<string, string[]>();
        const parentMap = new Map<string, string | null>();
        const levelMap = new Map<string, number>();
        const rootTasks: Task[] = [];

        for (const task of tasksWithLevels) {
            taskMap.set(task.id, task);
            parentMap.set(task.id, task.parent);
            levelMap.set(task.id, task.level || 0);

            if (task.parent === null) {
                rootTasks.push(task);
            } else {
                if (!linkMap.has(task.parent)) linkMap.set(task.parent, []);
                linkMap.get(task.parent)!.push(task.id);
            }
        }

        return { taskMap, linkMap, parentMap, levelMap, rootTasks };
    }

	indexSelection(selection: string): TaskIndex{
		const lexer = new Lexer(selection);
		let tokens = lexer.tokenize();
		const parser = new Parser(tokens);
		const tasks = parser.parse();
		
		const tasksWithLevels = this.computeLevels(tasks);
        
        const taskMap = new Map<string, Task>();
        const linkMap = new Map<string, string[]>();
        const parentMap = new Map<string, string | null>();
        const levelMap = new Map<string, number>();
        const rootTasks: Task[] = [];

        for (const task of tasksWithLevels) {
            taskMap.set(task.id, task);
            parentMap.set(task.id, task.parent);
            levelMap.set(task.id, task.level || 0);

            if (task.parent === null) {
                rootTasks.push(task);
            } else {
                if (!linkMap.has(task.parent)) linkMap.set(task.parent, []);
                linkMap.get(task.parent)!.push(task.id);
            }
        }

        return { taskMap, linkMap, parentMap, levelMap, rootTasks };
	}
    
    computeLevels(tasks: Task[]): Task[] {
        const taskMap = new Map<string, Task>();
        tasks.forEach(task => taskMap.set(task.id, task));

        const computeLevel = (task: Task): number => {
            if (!task.parent) return 0;
            
            const parent = taskMap.get(task.parent);
            if (!parent) return 0;
            
            return computeLevel(parent) + 1;
        };

        return tasks.map(task => ({
            ...task,
            level: computeLevel(task)
        }));
    }
}
