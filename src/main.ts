import { CreateTaskModal } from "./components/CreateTaskModal";
import { Editor, MarkdownView, Notice, Plugin, TFile, Modal as ModalBase } from "obsidian";
import { MainAppModal } from "./signIn";
import "../styles.css";
import { SigninRequiredModal } from "./components/SigninRequired";
import { ClickUpSettingTab } from "./settings";
import { createTable } from "./utils";
import { deserializeTasks, TaskIndexer, serializeTaskToMd} from './services/taskParser/index';
import {
	ApiService,
	AuthService,
	StorageService,
	TaskService,
} from "./services";
import {
	ClickUpPluginSettings,
	DEFAULT_SETTINGS,
	TCreateTask,
} from "./interfaces";
import * as dotenv from "dotenv";
import { sep } from "path";
import { Gettasks } from "./clickupTypes/types";

import lodash from "lodash";
const { isEqual } = lodash;

dotenv.config({
	debug: false,
});

type TClickUpRedirectParams = {
	action: string;
	code: string;
};

export default class ClickUpPlugin extends Plugin {
	settings: ClickUpPluginSettings; // settings fields data
	settingsTab: ClickUpSettingTab;
	modal: MainAppModal;
	apiService: ApiService;
	authService: AuthService;
	storageService: StorageService;
	taskService: TaskService;
	/**
	 * Logs a message to a file in the user's vault.
	 * 
	 * @param {string} message - The message to log.
	 * @param {string} [filePath="ClickUpLogs/log.txt"] - The file path where the log will be written.
	 */
	private async logToFile(message: string, filePath: string = "ClickUpLogs/log.txt") {
		const vault = this.app.vault;

		// Ensure the directory exists
		const directory = filePath.split("/").slice(0, -1).join("/");
		if (!vault.getAbstractFileByPath(directory)) {
			await vault.createFolder(directory);
		}

		// Check if the file exists
		let logFile = vault.getAbstractFileByPath(filePath);
		if (!logFile) {
			// Create the file if it doesn't exist
			await vault.create(filePath, "");
			logFile = vault.getAbstractFileByPath(filePath);
		}

		// Append the log message to the file
		const logMessage = `[${new Date().toISOString()}] ${message}\n`;
		await vault.append(logFile as TFile, logMessage);
	}

	async onload() {
		// Initialize services
		this.apiService = ApiService.getInstance();
		this.authService = AuthService.getInstance();
		this.storageService = StorageService.getInstance();
		this.taskService = TaskService.getInstance();

		// Register settings tab
		this.settingsTab = new ClickUpSettingTab(this.app, this);
		this.addSettingTab(this.settingsTab);

		// Register protocol handler
		this.registerObsidianProtocolHandler("ClickUpPlugin", async (e) => {
			const parameters = e as TClickUpRedirectParams;
			this.storageService.setCode(parameters.code);
		});

		// Load settings and init
		await this.loadSettings();
		this.modal = new MainAppModal(this);

		// Check auth status
		if (!this.authService.isAuthenticated()) {
			this.logOut();
		} else {
			//TODO: uncomment this once done figuring stuff out
			// this.saveSettings();
			// this.settingsTab.renderSettings();
			// this.fetchUser(JSON.stringify(this.storageService.getToken()));
		}

		// ==================== OBSIDIAN COMMANDS ====================
		this.addCommand({
			id: "Sync to cursor",
			name: "Sync to cursor",
			editorCallback: async (editor: Editor) => {

				// Check if taskIndex already exists
				if (this.storageService.getTaskIndex()) {
					const confirmation = await this.showConfirmationModal(
						"A task index already exists. Do you want to overwrite it?"
					);

					if (!confirmation) {
						new Notice("Task index update canceled.");
						return;
					}
				}



				try {
					const fetchedTasks = await this.apiService.getTasks("901522227733", {
						subtasks: true,
					});

				const tasks = deserializeTasks(fetchedTasks);
				const indexer = new TaskIndexer();
				const taskIndex = indexer.index(tasks);
				const result: string = serializeTaskToMd(taskIndex);
				this.storageService.setTaskIndex(taskIndex);

				const cursor = editor.getCursor();
				editor.replaceRange(result, cursor);

				} catch (error) {
					console.error("Failed to fetch tasks:", error);
				}
			},
		});

		this.addCommand({
			id: "create-task-clickUp-selection",
			name: "Create ClickUp task from selection",
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				const selectedText = editor.getSelection();

				if (!selectedText.trim()) {
					new Notice("No text selected");
					return;
				}

				// console.log("Raw selection:", selectedText);
				const taskIndexer = new TaskIndexer;
				const taskIndex = taskIndexer.indexSelection(selectedText);
				console.log(taskIndex);

				if (!isEqual(this.storageService.getTaskIndex, taskIndex)){
					new Notice("Index in storage is not equal to the lexed one");
					return;
				}


				// console.log("Parsed tasks:", parseResult);
				// console.log("Task map:", parseResult.taskMap);
				// console.log("Link map:", parseResult.linkMap);
				// console.log("Parent map:", parseResult.parentMap);
				// console.log("Root tasks:", parseResult.roots);

				// // Log each task with its flags
				// parseResult.taskMap.forEach((task, taskId) => {
				// 	console.log(`Task ${taskId}:`, {
				// 		name: task.name,
				// 		level: task.level,
				// 		flags: task.flags,
				// 		children: task.parent ? [task.parent] : []
				// 	});
				// });
			},
		});
	}

	async logOut() {
		this.clearUser();
		this.settingsTab.renderSignIn();
	}

	async fetchUser(token: string) {
		const user = await this.apiService.getAuthorizedUser();
		const teams = await this.apiService.getTeams();
		await this.saveData({ user, token, teams });
		await this.loadSettings();
	}

	async clearUser() {
		this.storageService.clearAllData();
		await this.saveData({ token: null, user: null, teams: [] });
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private async showConfirmationModal(message: string): Promise<boolean> {
		return new Promise((resolve) => {
			const modal = new (class extends ModalBase {
				onClose() {
					super.onClose();
					resolve(false);
				}
			})(this.app);
			
			modal.contentEl.createEl("p", { text: message });
			const buttonContainer = modal.contentEl.createDiv();
			buttonContainer.createEl("button", { text: "Yes" }).onclick = () => {
				resolve(true);
				modal.close();
			};
			buttonContainer.createEl("button", { text: "No" }).onclick = () => {
				resolve(false);
				modal.close();
			};
			modal.open();
		});
	}

	async syncronizeListNote(id: string) {
		const note = this.app.vault
			.getFiles()
			.filter((f) => f.path.startsWith("ClickUp"))
			.find((f) => f.path.includes(`[${id}]`));

		if (!note) {
			console.log("could not find note to sync");
			return;
		}

		const vault = this.app.vault;
		const tasks = await this.apiService.getTasks(id);
		const rows = this.taskService.formatTasksForTable(tasks);
		const tableHTML = createTable(rows);
		const filePath = note!.path.toString();

		vault.delete(note!);

		try {
			vault.create(filePath, tableHTML);
			new Notice("List synchronized successfully", 3000);
		} catch (error) {
			console.error("Failed to synchronize list", error);
			new Notice("Failed to synchronize list", 3000);
		}
	}
}
