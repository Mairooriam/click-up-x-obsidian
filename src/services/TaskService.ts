import { TCreateTask } from "../interfaces/api.types";
import { ApiService } from "./ApiService";
import { Notice } from "obsidian";

export class TaskService {
	private static instance: TaskService;
	private apiService: ApiService;

	private constructor() {
		this.apiService = ApiService.getInstance();
	}

	public static getInstance(): TaskService {
		if (!TaskService.instance) {
			TaskService.instance = new TaskService();
		}
		return TaskService.instance;
	}

	/**
	 * Creates a new task in the specified list
	 */
	public async createTask(listId: string, taskData: TCreateTask) {
		try {
			const task = await this.apiService.createTask({
				data: taskData,
				listId: listId,
			});

			if (task.err) {
				console.log(task);
				throw new Error(task.err);
			}

			new Notice("Created new task!", 3000);
			return task;
		} catch (err: any) {
			const errorResponse = await this.apiService.showError(err);
			return { error: errorResponse, success: false };
		}
	}

	/**
	 * Creates a task from the selected text in the editor
	 */
    public async createTaskFromSelection(selection: string, listId: string) {
        console.log("🔍 createTaskFromSelection called with:", { selection, listId });
        
        if (!selection || selection.trim().length === 0) {
            console.error("❌ Empty selection provided");
            new Notice("No text selected!", 3000);
            return { error: "No selection", success: false };
        }

        if (!listId) {
            console.error("❌ No listId provided");
            new Notice("No list selected!", 3000);
            return { error: "No list", success: false };
        }

        const requestData: TCreateTask = {
            name: selection.trim(),
            description: "",
            assignees: [],
            priority: 3,
        };

        console.log("📝 Creating task with data:", requestData);

        try {
            const task = await this.apiService.createTask({
                data: requestData,
                listId,
            });

            console.log("✅ Task creation response:", task);

            if (task.err) {
                console.error("❌ Task creation failed:", task.err);
                throw new Error(task.err);
            }

            new Notice("Created task from selection!", 3000);
            return task;
        } catch (err: any) {
            console.error("❌ Exception in createTaskFromSelection:", err);
            const errorResponse = await this.apiService.showError(err);
            return { error: errorResponse, success: false };
        }
    }

	/**
	 * Gets tasks from a list
	 */
	public async getTasks(listId: string) {
		try {
			return await this.apiService.getTasks(listId);
		} catch (err: any) {
			const errorResponse = await this.apiService.showError(err);
			return { error: errorResponse, success: false };
		}
	}

	/**
	 * Format task data for table display
	 */
	public formatTasksForTable(tasks: any[]) {
		return tasks.map((task: any, index: number) => {
			return {
				order: index + 1,
				name: task.name,
				status: task.status.status,
				date_created: new Date(
					Number(task.date_created)
				).toLocaleString("en-US"),
				creator: task.creator.username,
				assignees: task.assignees.map((u: any) => u.username),
				priority: task?.priority?.priority ?? "Low",
			};
		});
	}


	
}
