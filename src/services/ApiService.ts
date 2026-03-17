import { Notice, requestUrl } from "obsidian";
import { TAllLists, TCreateTask, TMember } from "../interfaces/api.types";

export class ApiService {
	private static instance: ApiService;

	private constructor() {}

	public static getInstance(): ApiService {
		if (!ApiService.instance) {
			ApiService.instance = new ApiService();
		}
		return ApiService.instance;
	}

    private async fetcher(url: string, options: RequestInit = {}) {
        console.log({ url: `https://api.clickup.com/api/v2/${url}` });

        const token = localStorage.getItem("click_up_token");
        const mergedHeaders: Record<string, string> = {
            ...(options.headers as Record<string, string> | undefined),
        };

        if (token) {
            mergedHeaders.Authorization = token;
        }

        return requestUrl({
            url: `https://api.clickup.com/api/v2/${url}`,
            method: (options.method as string) ?? "GET",
            headers: mergedHeaders,
            body: options.body as string | undefined,
            throw: true,
        });
    }

    public async getToken(input: string): Promise<string | undefined> {
        if (!input) return "MISSING_TOKEN";

        let token = input.trim();

        // Supports full JSON pasted from your Python callback:
        // {"access_token":"...","token_type":"Bearer"}
        try {
            const parsed = JSON.parse(token) as { access_token?: string };
            if (parsed?.access_token) token = parsed.access_token;
        } catch {
            // raw token, ignore
        }

        try {
            localStorage.setItem("click_up_token", token);

            // Validate token immediately
            const user = await this.getAuthorizedUser();
            if (!user?.id) throw new Error("Invalid token");

            return token;
        } catch (error) {
            localStorage.removeItem("click_up_token");
            console.error("Error during getToken()", error);
            return undefined;
        }
    }


	public async getAuthorizedUser() {
		const resp = await this.fetcher(`user`);
		const data = await resp.json;
		return data.user;
	}

	public async getTeams() {
		const resp = await this.fetcher(`team`);
		const data = await resp.json;
		return data.teams;
	}

	public async getSpaces(team_id: string) {
		const response = await this.fetcher(`team/${team_id}/space`);
		const data = await response.json;
		return data.spaces;
	}

	public async getFolders(space_id: string) {
		const response = await this.fetcher(`space/${space_id}/folder`);
		const data = await response.json;
		return data.folders;
	}

	public async getList(folder_id: string) {
		const response = await this.fetcher(`folder/${folder_id}/list`);
		const data = await response.json;
		return data.lists;
	}

	public async getFolderlessList(space_id: string) {
		const response = await this.fetcher(`space/${space_id}/list`);
		const data = await response.json;
		return data.lists;
	}

	public async getTasks(list_id: string) {
		const response = await this.fetcher(`list/${list_id}/task`);
		const data = await response.json;
		return data.tasks;
	}

	public async getClickupLists(folderId: string): Promise<TAllLists[]> {
		const response = await this.fetcher(`folder/${folderId}/list`);
		const data = await response.json;
		return data.lists;
	}

	public async getWorkspaceUser(teamId: string, userId: string) {
		const response = await this.fetcher(`team/${teamId}/user/${userId}`);
		const data = await response.json;
		return data;
	}

	public async getAllFolders(space_id: string) {
		const response = await this.fetcher(`space/${space_id}/folder`);
		const data = await response.json;
		return data.folders;
	}

	public async getListMembers(list_id: string): Promise<TMember[]> {
		const response = await this.fetcher(`list/${list_id}/member`);
		const data = await response.json;
		return data.members;
	}

	public async createTask({
		listId,
		data,
	}: {
		listId: string;
		data: TCreateTask;
	}) {
		const response = await this.fetcher(`list/${listId}/task`, {
			method: "POST",
			body: JSON.stringify(data),
			headers: {
				"Content-Type": "application/json",
			},
		});
		const responseData = await response.json;
		return responseData;
	}
	

	public async showError(
		e: Error
	): Promise<{ isAuth: boolean; message: string }> {
		console.log(e);
		if (e.message.includes("Oauth token not found")) {
			new Notice(
				"Error related to authorization, please re-login",
				10000
			);
			console.log("Error related to authorization, please re-login");
			return { isAuth: false, message: "no auth" };
		} else {
			new Notice(`Error: ${e.message}`, 5000);
			return { isAuth: true, message: e.message };
		}
	}
}
