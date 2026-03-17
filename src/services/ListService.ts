import { TCreateTask } from "../interfaces/api.types";
import { ApiService } from "./ApiService";
import { Notice } from "obsidian";


export class ListService {
	private static instance: ListService;
	private apiService: ApiService;

	private constructor() {
		this.apiService = ApiService.getInstance();
	}

	public static getInstance(): ListService {
		if (!ListService.instance) {
			ListService.instance = new ListService();
		}
		return ListService.instance;
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





}
