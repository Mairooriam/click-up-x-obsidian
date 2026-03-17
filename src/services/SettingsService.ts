import { ISpace, TCreateTask } from "../interfaces/api.types";
import { ApiService } from "./ApiService";
import { Notice } from "obsidian";

export class SettingsService {
	private static instance: SettingsService;
	private apiService: ApiService;

	private constructor() {
		this.apiService = ApiService.getInstance();
	}

	public static getInstance(): SettingsService {
		if (!SettingsService.instance) {
			SettingsService.instance = new SettingsService();
		}
		return SettingsService.instance;
	}

	/**
	 * Loads all spaces for all teams
	 */
	public async loadAllSpaces(teams: any[]): Promise<ISpace[]> {
		const spaces: ISpace[] = [];

		for (const team of teams) {
			const teamSpaces = await this.apiService.getSpaces(team.id);
			teamSpaces.forEach((sp: any) =>
				spaces.push({ name: sp.name, id: sp.id })
			);
		}

		return spaces;
	}




}
