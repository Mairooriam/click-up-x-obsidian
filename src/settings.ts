import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import { createFolder, createTable } from "./utils";
import ClickUpPlugin from "./main";
import { IList, ISpace } from "./interfaces";
import {
	ApiService,
	AuthService,
	StorageService,
	TaskService,
	SettingsService,
} from "./services";

export class ClickUpSettingTab extends PluginSettingTab {
	plugin: ClickUpPlugin;
	private apiService: ApiService;
	private authService: AuthService;
	private storageService: StorageService;
	private taskService: TaskService;
	private settingsService: SettingsService;

	constructor(app: App, plugin: ClickUpPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.apiService = ApiService.getInstance();
		this.authService = AuthService.getInstance();
		this.storageService = StorageService.getInstance();
		this.taskService = TaskService.getInstance();
		this.settingsService = SettingsService.getInstance();
	}

	// loadSpaces and loadLists is being called both onLoad causing double API CALL
	async loadSpaces(): Promise<ISpace[]> {
		const { teams } = this.plugin.settings;
		return await this.settingsService.loadAllSpaces(teams);
	}

	async loadLists(): Promise<IList[]> {
		const { teams } = this.plugin.settings;
		return await this.authService.loadAllLists(teams);
	}

	async configureListsLocally() {
		const { teams } = this.plugin.settings;
		await this.authService.configureListsLocally(teams);
	}

	async display(): Promise<void> {
		if (this.authService.isAuthenticated()) {
			this.renderSettings();
		} else {
			this.renderSignIn();
		}
	}

	renderSettings() {
		const { containerEl } = this;
		containerEl.empty();
		this.renderSpaceDropdown(containerEl);
		this.renderListDropdown(containerEl);
		this.renderWorkspaceSection(containerEl);
		this.renderUserSection(containerEl);
	}

	private renderSpaceDropdown(containerEl: HTMLElement) {
		new Setting(containerEl)
			.setName("Select space")
			.addDropdown(async (dropdown) => {
				dropdown.setDisabled(true);
				try {
					const spaces = await this.loadSpaces();
					const selectedSpace =
						this.storageService.getSelectedSpace();

					spaces.forEach((space) => {
						dropdown.addOption(JSON.stringify(space), space.name);
					});

					if (selectedSpace) {
						dropdown.setValue(JSON.stringify(selectedSpace));
					}

					dropdown.onChange((value) => {
						this.storageService.setSelectedSpace(JSON.parse(value));
					});

					dropdown.setDisabled(false);
				} catch (error) {
					const errorResponse = await this.apiService.showError(
						error
					);
					if (!errorResponse.isAuth) {
						this.plugin.logOut();
					}
					dropdown.disabled = true;
					this.renderSignIn();
					dropdown.addOption("", "error");
				}
			});
	}
	private renderListDropdown(containerEl: HTMLElement) {
		new Setting(containerEl)
			.setName("Select default sheet")
			.addDropdown(async (dropdown) => {
				dropdown.setDisabled(true);
				try {
					const lists = await this.loadLists();
					const selectedList = this.storageService.getSelectedList();

					lists.forEach((list) => {
						dropdown.addOption(list.id.toString(), list.name);
					});

					if (selectedList) {
						dropdown.setValue(selectedList.id);
					}

					dropdown.onChange((value) => {
						const selectedListName =
							lists.find((l) => l.id === value)?.name || "";
						this.storageService.setSelectedList({
							name: selectedListName,
							id: value,
						});
					});

					dropdown.setDisabled(false);
				} catch (error) {
					const errorResponse = await this.apiService.showError(
						error
					);
					if (!errorResponse.isAuth) {
						this.plugin.logOut();
					}
					this.renderSignIn();
					dropdown.disabled = true;
					dropdown.addOption("", "error");
				}
			})
			.setDesc("");
	}


	private renderWorkspaceSection(containerEl: HTMLElement) {
		const { teams } = this.plugin.settings;
		new Setting(containerEl)
			.setName(`WorkSpaces: ${teams[0]?.name}`)
			.setDesc(
				`Members:[${teams[0]?.members.map(
					(member: { user: { username: string } }) =>
						`${member.user.username},`
				)}]`
			)
			.addButton((btn) => {
				btn.setButtonText("sync");
				btn.buttonEl.classList.add("sync-button");

				btn.onClick(async () => {
					new Notice(`Loading...`, 3000);
					btn.buttonEl.classList.add("forceSyncBtn");
					await this.configureListsLocally();
					createFolder({ folder: `ClickUp`, vault: this.app.vault });

					for (const team of teams) {
						createFolder({
							folder: `ClickUp/${team.name}`,
							vault: this.app.vault,
						});

						const spaces = await this.apiService.getSpaces(team.id);

						for (const space of spaces) {
							createFolder({
								folder: `ClickUp/${team.name}/${space.name} - [${space.id}]`,
								vault: this.app.vault,
							});

							const folders = await this.apiService.getFolders(
								space.id
							);

							for (const folder of folders || []) {
								createFolder({
									folder: `ClickUp/${team.name}/${space.name} - [${space.id}]/${folder.name}`,
									vault: this.app.vault,
								});
							}

							const folderlesLists =
								await this.apiService.getFolderlessList(
									space.id
								);

							for (const list of folderlesLists) {
								const vault = this.plugin.app.vault;
								const tasks = await this.apiService.getTasks(
									list.id
								);
								const rows =
									this.taskService.formatTasksForTable(tasks);
								const tableHTML = createTable(rows);
								const filePath = `/ClickUp/${team.name}/${space.name} - [${space.id}]/${list.name}[${list.id}].md`;

								try {
									vault.create(filePath, tableHTML);
								} catch (err: any) {
									if (
										err.message === "File already exists."
									) {
										const files = vault.getMarkdownFiles();
										for (let i = 0; i < files.length; i++) {
											const element = files[i];
											if (
												element.name ===
												`${list.name}[${list.id}].md`
											) {
												vault.delete(element);
												vault.create(
													filePath,
													tableHTML
												);
												new Notice(
													`Successfully updated ${list.name}`,
													3000
												);
											}
										}
									} else {
										console.error(err);
									}
								}
							}
						}
					}

					btn.buttonEl.classList.remove("forceSyncBtn");
				});
			});

	}

	private renderUserSection(containerEl: HTMLElement) {
		new Setting(containerEl)
			.setName(
				"User: " +
				(this.plugin.settings.user?.username ||
					"doesnt registration")
			)
			.addButton((btn) => {
				btn.setButtonText("Log out");
				btn.buttonEl.classList.add("logout-button");
				btn.onClick(async () => {
					this.plugin.logOut();
				});
			});
	}

	renderSignIn() {
		let { containerEl } = this;
		containerEl.empty();

		const signInContainer = containerEl.createEl("div", {
			cls: "signin-container",
		});

		new Setting(signInContainer).setName("Sign In").addButton((button) => {
			button.setButtonText("Sign In");
			button.buttonEl.classList.add("signBtn");
			button.onClick(async () => {
				this.plugin.modal.open();
			});
		});
	}


}
