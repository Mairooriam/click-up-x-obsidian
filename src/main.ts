import { CreateTaskModal } from "./components/CreateTaskModal";
import { Editor, MarkdownView, Notice, Plugin } from "obsidian";
import { MainAppModal } from "./signIn";
import "../styles.css";
import { SigninRequiredModal } from "./components/SigninRequired";
import { ClickUpSettingTab } from "./settings";
import { createTable } from "./utils";
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
			this.saveSettings();
			this.settingsTab.renderSettings();
			this.fetchUser(JSON.stringify(this.storageService.getToken()));
		}

		// ==================== OBSIDIAN COMMANDS ====================
		this.addCommand({
			id: "manual-create-task-clickUp",
			name: "Create ClickUp task",
			callback: async () => {
				//TODO: add functionality to new workflow
				console.log("Not implemented yet Miro 17.3.2026");

			},
		});

		this.addCommand({
			id: "create-task-clickUp-selection",
			name: "Create ClickUp task from selection",
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				//TODO: add functionality to new workflow
				console.log("Not implemented yet Miro 17.3.2026");
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
